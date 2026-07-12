"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ChevronLeft,
  ImageIcon,
  Settings,
  Stethoscope,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EncounterKeyboardFocus } from "@/components/EncounterKeyboardFocus";
import { InteractionCharacterStage } from "@/components/InteractionCharacterStage";
import { InteractionComposer } from "@/components/InteractionComposer";
import { InteractionConversation } from "@/components/InteractionConversation";
import { InteractionExperienceShell } from "@/components/InteractionExperienceShell";
import type { OdontIQCase } from "@/lib/cases";
import {
  createCompletedEncounterAttemptId,
  readEncounterSnapshot,
  removeEncounterSnapshot,
  type CompletedEncounterAttempt,
  type EncounterLifecycleStatus,
  type LocalEncounterSnapshot,
  type MentorInterventionState,
  writeCompletedEncounterAttempt,
  writeEncounterSnapshot,
} from "@/lib/localEncounter";
import {
  type FacultyRubricEvaluationState,
} from "@/lib/facultyRubric/evaluation/state";
import { createFacultyGenerationAttempt } from "@/lib/facultyRubric/report/clientGeneration";
import {
  type ConversationMessage,
  type ConversationRole,
} from "@/lib/conversationEngine";
import {
  detectClinicalChecklistCoverage,
  detectStudentMessageChecklistCoverage,
  type ChecklistCoverageEvidence,
} from "@/lib/checklistCoverage";
import { getMentorGuidanceBullets } from "@/lib/mentorIntervention";
import { useMentorSpeechPlayback } from "@/hooks/useMentorSpeechPlayback";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesisPlayback } from "@/hooks/useSpeechSynthesisPlayback";

type EncounterExperienceProps = {
  patientCase: OdontIQCase;
};

type CommunicationMode = "voice" | "text";

type EncounterPanel = "controls" | "conversation" | "examination" | "viewer";

type EncounterEventType =
  | "student_message_sent"
  | "patient_response_generated"
  | "examination_opened"
  | "examination_viewed"
  | "conversation_opened"
  | "keyboard_mode_used"
  | "voice_placeholder_used"
  | "finish_consultation_clicked"
  | "pause_consultation_clicked";

type EncounterEvent = {
  type: EncounterEventType;
  timestamp: string;
  payload?: Record<string, unknown>;
};

type EncounterState = {
  communicationMode: CommunicationMode;
  activePanel: EncounterPanel;
  selectedExaminationId?: string;
  isSpeaking: boolean;
  isInputFocused: boolean;
  responseError?: string;
  messages: ConversationMessage[];
  coveredFacts: string[];
  coveredChecklistItems: string[];
  coverageEvidence: ChecklistCoverageEvidence[];
  encounterEvents: EncounterEvent[];
};

type EncounterAction =
  | { type: "restoreEncounter"; state: EncounterState }
  | { type: "switchToText" }
  | { type: "switchToVoice" }
  | { type: "openConversation" }
  | { type: "closeConversation" }
  | { type: "openExamination" }
  | { type: "closeExamination" }
  | { type: "openViewer"; examinationId: string }
  | { type: "closeViewerToExamination" }
  | { type: "closeViewerToEncounter" }
  | { type: "startSpeaking" }
  | { type: "stopSpeaking" }
  | { type: "setInputFocused"; focused: boolean }
  | { type: "setResponseError"; error?: string }
  | { type: "appendMessage"; message: ConversationMessage }
  | {
      type: "applyCoverage";
      facts?: string[];
      checklistItemId?: string;
      checklistItemIds?: string[];
      evidence?: ChecklistCoverageEvidence[];
    }
  | { type: "recordEvent"; event: EncounterEvent };

const initialEncounterState: EncounterState = {
  communicationMode: "voice",
  activePanel: "controls",
  isSpeaking: false,
  isInputFocused: false,
  responseError: undefined,
  messages: [],
  coveredFacts: [],
  coveredChecklistItems: [],
  coverageEvidence: [],
  encounterEvents: [],
};

const patientResponseErrorMessage =
  "The AI patient response could not be generated. Please try again.";

const initialMentorInterventionState: MentorInterventionState = {
  evaluated: false,
  shown: false,
  missingCategories: [],
  guidanceCardVisible: false,
  audioPlayed: false,
};

type ConversationApiResponse =
  | {
      success: true;
      provider: string;
      response: string;
      encounterId: string;
    }
  | {
      success: false;
      provider?: string;
      error?: string;
    };

type ServerEncounterResponse = {
  id: string;
  caseId: string;
  status: "ACTIVE" | "COMPLETED";
  version: number;
  createdAt: string;
  updatedAt: string;
};

function appendUnique(currentItems: string[], nextItems: string[] = []) {
  return Array.from(new Set([...currentItems, ...nextItems]));
}

function appendUniqueCoverageEvidence(
  currentItems: ChecklistCoverageEvidence[],
  nextItems: ChecklistCoverageEvidence[] = [],
) {
  const existingKeys = new Set(
    currentItems.map(
      (item) => `${item.checklistItemId}:${item.source}:${item.evidence}`,
    ),
  );
  const newItems = nextItems.filter((item) => {
    const key = `${item.checklistItemId}:${item.source}:${item.evidence}`;

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  return [...currentItems, ...newItems];
}

function encounterReducer(
  state: EncounterState,
  action: EncounterAction,
): EncounterState {
  switch (action.type) {
    case "restoreEncounter":
      return action.state;
    case "switchToText":
      return {
        ...state,
        communicationMode: "text",
      };
    case "switchToVoice":
      return {
        ...state,
        communicationMode: "voice",
        isInputFocused: false,
      };
    case "openConversation":
      return {
        ...state,
        activePanel: "conversation",
      };
    case "closeConversation":
      return {
        ...state,
        activePanel: "controls",
      };
    case "openExamination":
      return {
        ...state,
        activePanel: "examination",
        selectedExaminationId: undefined,
      };
    case "closeExamination":
      return {
        ...state,
        activePanel: "controls",
        selectedExaminationId: undefined,
      };
    case "openViewer":
      return {
        ...state,
        activePanel: "viewer",
        selectedExaminationId: action.examinationId,
      };
    case "closeViewerToExamination":
      return {
        ...state,
        activePanel: "examination",
        selectedExaminationId: undefined,
      };
    case "closeViewerToEncounter":
      return {
        ...state,
        activePanel: "controls",
        selectedExaminationId: undefined,
      };
    case "startSpeaking":
      return {
        ...state,
        isSpeaking: true,
      };
    case "stopSpeaking":
      return {
        ...state,
        isSpeaking: false,
      };
    case "setInputFocused":
      return {
        ...state,
        isInputFocused: action.focused,
      };
    case "setResponseError":
      return {
        ...state,
        responseError: action.error,
      };
    case "appendMessage":
      return {
        ...state,
        messages: [...state.messages, action.message],
      };
    case "applyCoverage":
      const checklistItemIds = appendUnique(
        action.checklistItemId ? [action.checklistItemId] : [],
        action.checklistItemIds,
      );

      return {
        ...state,
        coveredFacts: appendUnique(state.coveredFacts, action.facts),
        coveredChecklistItems: appendUnique(
          state.coveredChecklistItems,
          checklistItemIds,
        ),
        coverageEvidence: appendUniqueCoverageEvidence(
          state.coverageEvidence,
          action.evidence,
        ),
      };
    case "recordEvent":
      return {
        ...state,
        encounterEvents: [...state.encounterEvents, action.event],
      };
    default:
      return state;
  }
}

export function EncounterExperience({ patientCase }: EncounterExperienceProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    encounterReducer,
    initialEncounterState,
  );
  const [draftQuestion, setDraftQuestion] = useState("");
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [serverEncounterId, setServerEncounterId] = useState<string>();
  const [encounterSyncError, setEncounterSyncError] = useState<string>();
  const [isSyncingEncounter, setIsSyncingEncounter] = useState(false);
  const [mentorIntervention, setMentorIntervention] =
    useState<MentorInterventionState>(initialMentorInterventionState);
  const [facultyRubricEvaluation, setFacultyRubricEvaluation] =
    useState<FacultyRubricEvaluationState>();
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceSubmitRef = useRef<(transcript: string) => void>(() => {});
  const keepFocusedModeForExamination = useRef(false);
  const fullViewportHeight = useRef(0);
  const messageSequence = useRef(0);
  const responseTimer = useRef<number | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement>(null);
  const encounterCreatedAt = useRef<string | null>(null);
  const accumulatedActiveMs = useRef(0);
  const accumulatedPausedMs = useRef(0);
  const activeSegmentStartedAt = useRef<number | null>(null);
  const lastSnapshotStatus = useRef<"in-progress" | "paused">("in-progress");
  const hasRestoredSnapshot = useRef(false);
  const isCompletingRef = useRef(false);
  const isSyncingEncounterRef = useRef(false);
  const isInputFocused = state.isInputFocused;
  const isTypingMode = isInputFocused;
  const isExaminationSheetOpen = state.activePanel === "examination";
  const speechPlayback = useSpeechSynthesisPlayback({
    caseId: patientCase.id,
  });
  const mentorSpeechPlayback = useMentorSpeechPlayback();
  const isGeneratingPatientResponse = state.isSpeaking;
  const isPatientAudioPlaying = speechPlayback.isSpeaking;
  const selectedExamination = patientCase.assets.examinations.find(
    (image) => image.id === state.selectedExaminationId,
  );
  const isConversationOpen = true;

  const handleFinalVoiceTranscript = useCallback((transcript: string) => {
    voiceSubmitRef.current(transcript);
  }, []);

  const speechRecognition = useSpeechRecognition({
    onFinalTranscript: handleFinalVoiceTranscript,
  });
  const voiceInputMessage = speechRecognition.error?.message;

  useEffect(() => {
    const talkingVideo = talkingVideoRef.current;

    if (!talkingVideo) {
      return;
    }

    if (isPatientAudioPlaying) {
      try {
        talkingVideo.currentTime = 0;
      } catch {
        // Some browsers block seeking until metadata is loaded.
      }

      void talkingVideo.play().catch(() => undefined);
    } else {
      talkingVideo.pause();

      try {
        talkingVideo.currentTime = 0;
      } catch {
        // Keep the current frame if seeking is not available yet.
      }
    }
  }, [isPatientAudioPlaying]);

  const createConversationMessage = (
    role: ConversationRole,
    text: string,
  ): ConversationMessage => {
    messageSequence.current += 1;

    return {
      id: `${patientCase.id}-${Date.now()}-${messageSequence.current}`,
      role,
      text,
      timestamp: new Date().toISOString(),
    };
  };

  const createEncounterEvent = (
    type: EncounterEventType,
    payload?: Record<string, unknown>,
  ): EncounterEvent => ({
    type,
    timestamp: new Date().toISOString(),
    payload,
  });

  const getViewedExaminationIds = useCallback(
    (events: EncounterEvent[]) =>
      appendUnique(
        [],
        events
          .filter((event) => event.type === "examination_viewed")
          .map((event) => event.payload?.examinationId)
          .filter((examinationId): examinationId is string =>
            typeof examinationId === "string",
          ),
      ),
    [],
  );

  const getActiveDurationMs = useCallback(() => {
    const now = Date.now();
    const segmentStartedAt = activeSegmentStartedAt.current ?? now;

    return accumulatedActiveMs.current + (now - segmentStartedAt);
  }, []);

  const buildEncounterSnapshot = useCallback(
    (
      lifecycleStatus: Extract<
        EncounterLifecycleStatus,
        "in-progress" | "paused"
      >,
      options: {
        encounterState?: EncounterState;
        draft?: string;
        extraEvents?: EncounterEvent[];
        mentorInterventionState?: MentorInterventionState;
        facultyRubricEvaluationState?: FacultyRubricEvaluationState;
        timestamp?: string;
      } = {},
    ): LocalEncounterSnapshot => {
      const snapshotState = options.encounterState ?? state;
      const encounterEvents = [
        ...snapshotState.encounterEvents,
        ...(options.extraEvents ?? []),
      ];
      const nowIso = options.timestamp ?? new Date().toISOString();
      const activeDurationMs = getActiveDurationMs();

      return {
        caseId: patientCase.id,
        serverEncounterId,
        conversationHistory: snapshotState.messages,
        coveredFacts: snapshotState.coveredFacts,
        coveredChecklistItems: snapshotState.coveredChecklistItems,
        coverageEvidence: snapshotState.coverageEvidence,
        encounterEvents,
        examinationsViewed: getViewedExaminationIds(encounterEvents),
        savedAt: nowIso,
        lifecycleStatus,
        activeDurationMs,
        pausedDurationMs: accumulatedPausedMs.current,
        currentView: {
          communicationMode: snapshotState.communicationMode,
          activePanel: snapshotState.activePanel,
          selectedExaminationId: snapshotState.selectedExaminationId,
          isInputFocused: snapshotState.isInputFocused,
        },
        draftQuestion: options.draft ?? draftQuestion,
        mentorIntervention:
          options.mentorInterventionState ?? mentorIntervention,
        facultyRubricEvaluation:
          options.facultyRubricEvaluationState ?? facultyRubricEvaluation,
        timers: {
          activeDurationMs,
          pausedDurationMs: accumulatedPausedMs.current,
          activeSegmentStartedAt:
            lifecycleStatus === "in-progress" && activeSegmentStartedAt.current
              ? new Date(activeSegmentStartedAt.current).toISOString()
              : undefined,
          pausedAt: lifecycleStatus === "paused" ? nowIso : undefined,
        },
        metadata: {
          createdAt: encounterCreatedAt.current ?? nowIso,
          updatedAt: nowIso,
        },
      };
    },
    [
      draftQuestion,
      getActiveDurationMs,
      getViewedExaminationIds,
      facultyRubricEvaluation,
      mentorIntervention,
      patientCase.id,
      serverEncounterId,
      state,
    ],
  );

  const saveEncounterSnapshot = useCallback(
    (
      lifecycleStatus: Extract<
        EncounterLifecycleStatus,
        "in-progress" | "paused"
      >,
      options: {
        encounterState?: EncounterState;
        draft?: string;
        extraEvents?: EncounterEvent[];
        mentorInterventionState?: MentorInterventionState;
        facultyRubricEvaluationState?: FacultyRubricEvaluationState;
        timestamp?: string;
      } = {},
    ) => {
      writeEncounterSnapshot(
        buildEncounterSnapshot(lifecycleStatus, {
          encounterState: options.encounterState,
          draft: options.draft,
          extraEvents: options.extraEvents,
          mentorInterventionState: options.mentorInterventionState,
          facultyRubricEvaluationState:
            options.facultyRubricEvaluationState,
          timestamp: options.timestamp,
        }),
      );
      lastSnapshotStatus.current = lifecycleStatus;
    },
    [buildEncounterSnapshot],
  );

  const syncServerEncounter = useCallback(async () => {
    if (isSyncingEncounterRef.current) return;
    isSyncingEncounterRef.current = true;
    setIsSyncingEncounter(true);
    setEncounterSyncError(undefined);

    try {
      const response = await fetch("/api/encounters/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: patientCase.id }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok || !isServerEncounterResponse(payload)) {
        throw new Error("encounter_sync_failed");
      }
      setServerEncounterId(payload.id);
    } catch {
      setEncounterSyncError(
        "Encounter sync was interrupted. Your work is saved locally.",
      );
    } finally {
      isSyncingEncounterRef.current = false;
      setIsSyncingEncounter(false);
    }
  }, [patientCase.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncServerEncounter();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [syncServerEncounter]);

  const saveLocalEncounterSummary = (finishEvent: EncounterEvent) => {
    const encounterEvents = [...state.encounterEvents, finishEvent];
    const completedAt = finishEvent.timestamp;
    const localSummary: CompletedEncounterAttempt = {
      attemptId: createCompletedEncounterAttemptId(),
      caseId: patientCase.id,
      serverEncounterId,
      conversationHistory: state.messages,
      coveredFacts: state.coveredFacts,
      coveredChecklistItems: state.coveredChecklistItems,
      coverageEvidence: state.coverageEvidence,
      encounterEvents,
      examinationsViewed: getViewedExaminationIds(encounterEvents),
      savedAt: completedAt,
      lifecycleStatus: "completed",
      activeDurationMs: getActiveDurationMs(),
      pausedDurationMs: accumulatedPausedMs.current,
      facultyRubricEvaluation: undefined,
      facultyRubricScore: undefined,
      facultyReport: undefined,
      facultyReportGeneration: createFacultyGenerationAttempt("pending"),
      metadata: {
        createdAt: encounterCreatedAt.current ?? completedAt,
        updatedAt: completedAt,
        completedAt,
      },
    };

    writeCompletedEncounterAttempt(localSummary);
    if (process.env.NODE_ENV !== "production") {
      console.info("Canonical faculty completion persistence diagnostics.", {
        caseId: patientCase.id,
        evaluationStatus: "pending",
        evaluationCount: 0,
        scoreGenerated: false,
        reportConstructed: false,
        persistenceSucceeded: true,
      });
    }
    removeEncounterSnapshot(patientCase.id);
    return localSummary;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snapshot = readEncounterSnapshot(patientCase.id);

      if (!snapshot) {
        hasRestoredSnapshot.current = true;
        encounterCreatedAt.current = new Date().toISOString();
        activeSegmentStartedAt.current = Date.now();
        return;
      }

      if (snapshot.serverEncounterId) {
        setServerEncounterId(snapshot.serverEncounterId);
      }
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const pausedAt = snapshot.timers.pausedAt
        ? Date.parse(snapshot.timers.pausedAt)
        : NaN;
      const additionalPausedMs =
        snapshot.lifecycleStatus === "paused" && Number.isFinite(pausedAt)
          ? Math.max(0, now - pausedAt)
          : 0;

      encounterCreatedAt.current = snapshot.metadata.createdAt ?? nowIso;
      accumulatedActiveMs.current =
        snapshot.timers.activeDurationMs ?? snapshot.activeDurationMs ?? 0;
      accumulatedPausedMs.current =
        (snapshot.timers.pausedDurationMs ?? snapshot.pausedDurationMs ?? 0) +
        additionalPausedMs;
      activeSegmentStartedAt.current = now;
      messageSequence.current = snapshot.conversationHistory.length;
      lastSnapshotStatus.current = "in-progress";

      dispatch({
        type: "restoreEncounter",
        state: {
          communicationMode: snapshot.currentView.communicationMode,
          activePanel: snapshot.currentView.activePanel,
          selectedExaminationId: snapshot.currentView.selectedExaminationId,
          isSpeaking: false,
          isInputFocused: snapshot.currentView.isInputFocused ?? false,
          responseError: undefined,
          messages: snapshot.conversationHistory,
          coveredFacts: snapshot.coveredFacts,
          coveredChecklistItems: snapshot.coveredChecklistItems,
          coverageEvidence: snapshot.coverageEvidence ?? [],
          encounterEvents: snapshot.encounterEvents as EncounterEvent[],
        },
      });
      setDraftQuestion(snapshot.draftQuestion ?? "");
      setMentorIntervention(
        snapshot.mentorIntervention ?? initialMentorInterventionState,
      );
      setFacultyRubricEvaluation(snapshot.facultyRubricEvaluation);
      writeEncounterSnapshot({
        ...snapshot,
        lifecycleStatus: "in-progress",
        savedAt: nowIso,
        pausedDurationMs: accumulatedPausedMs.current,
        timers: {
          activeDurationMs: accumulatedActiveMs.current,
          pausedDurationMs: accumulatedPausedMs.current,
          activeSegmentStartedAt: nowIso,
        },
        metadata: {
          ...snapshot.metadata,
          updatedAt: nowIso,
          resumedAt: nowIso,
        },
      });
      hasRestoredSnapshot.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [patientCase.id]);

  useEffect(() => {
    if (!hasRestoredSnapshot.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (lastSnapshotStatus.current === "paused") {
        return;
      }

      saveEncounterSnapshot("in-progress");
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftQuestion, saveEncounterSnapshot, state]);

  const submitStudentMessage = async (studentMessage: string) => {
    const text = studentMessage.trim();

    if (!text || isGeneratingPatientResponse) {
      return;
    }

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
    }

    if (mentorSpeechPlayback.isSpeaking) {
      mentorSpeechPlayback.stop();
    }

    const studentConversationMessage = createConversationMessage(
      "student",
      text,
    );
    const conversationHistory = state.messages;
    const coverageResult = detectStudentMessageChecklistCoverage({
      caseData: patientCase,
      latestStudentMessage: text,
      existingCoveredChecklistIds: state.coveredChecklistItems,
      timestamp: studentConversationMessage.timestamp,
    });
    const coveredChecklistItemsForRequest = appendUnique(
      state.coveredChecklistItems,
      coverageResult.newlyCoveredChecklistIds,
    );

    dispatch({
      type: "appendMessage",
      message: studentConversationMessage,
    });
    if (coverageResult.newlyCoveredChecklistIds.length > 0) {
      dispatch({
        type: "applyCoverage",
        checklistItemIds: coverageResult.newlyCoveredChecklistIds,
        evidence: coverageResult.evidence,
      });
    }
    dispatch({ type: "setResponseError", error: undefined });
    dispatch({
      type: "recordEvent",
      event: createEncounterEvent("student_message_sent", {
        messageId: studentConversationMessage.id,
        role: studentConversationMessage.role,
        text,
        checklistCoverage: coverageResult.evidence,
      }),
    });
    dispatch({ type: "startSpeaking" });

    if (responseTimer.current) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }

    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encounterId: patientCase.id,
          caseId: patientCase.id,
          userMessage: text,
          message: text,
          conversation: conversationHistory,
          coveredChecklistItems: coveredChecklistItemsForRequest,
        }),
      });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok || !isSuccessfulConversationResponse(data)) {
        throw new Error("Conversation request failed");
      }

      const patientConversationMessage = createConversationMessage(
        "patient",
        data.response,
      );

      dispatch({
        type: "appendMessage",
        message: patientConversationMessage,
      });
      speechPlayback.speak(patientConversationMessage.text);
      dispatch({
        type: "recordEvent",
        event: createEncounterEvent("patient_response_generated", {
          messageId: patientConversationMessage.id,
          provider: data.provider,
          encounterId: data.encounterId,
        }),
      });
    } catch {
      dispatch({
        type: "setResponseError",
        error: patientResponseErrorMessage,
      });
    } finally {
      dispatch({ type: "stopSpeaking" });
    }
  };

  const toggleVoiceInput = () => {
    if (!speechRecognition.isSupported) {
      return;
    }

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
    }

    if (mentorSpeechPlayback.isSpeaking) {
      mentorSpeechPlayback.stop();
    }

    dispatch({
      type: "recordEvent",
      event: createEncounterEvent("voice_placeholder_used", {
        action: speechRecognition.isListening ? "stop" : "start",
      }),
    });
    speechRecognition.toggleListening();
  };

  useEffect(() => {
    voiceSubmitRef.current = (transcript: string) => {
      void submitStudentMessage(transcript);
    };
  });

  const openExaminationSheet = () => {
    if (isInputFocused) {
      keepFocusedModeForExamination.current = true;
    }

    dispatch({ type: "openExamination" });
    dispatch({
      type: "recordEvent",
      event: createEncounterEvent("examination_opened"),
    });
  };

  const closeExaminationSheet = () => {
    dispatch({ type: "closeExamination" });

    if (keepFocusedModeForExamination.current) {
      keepFocusedModeForExamination.current = false;
      dispatch({ type: "setInputFocused", focused: true });
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const closeViewerToEncounter = () => {
    dispatch({ type: "closeViewerToEncounter" });

    if (keepFocusedModeForExamination.current) {
      keepFocusedModeForExamination.current = false;
      dispatch({ type: "setInputFocused", focused: true });
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    }
  };

  useEffect(() => {
    const visualViewport = window.visualViewport;

    const getViewportHeight = () =>
      visualViewport?.height ?? window.innerHeight;

    fullViewportHeight.current = Math.max(
      fullViewportHeight.current,
      getViewportHeight(),
    );

    const clearFocusedTypingIfKeyboardClosed = () => {
      const currentHeight = getViewportHeight();

      fullViewportHeight.current = Math.max(
        fullViewportHeight.current,
        currentHeight,
      );

      const keyboardClosed =
        currentHeight >= fullViewportHeight.current - 48;

      if (
        isTypingMode &&
        isInputFocused &&
        keyboardClosed &&
        !keepFocusedModeForExamination.current
      ) {
        dispatch({ type: "setInputFocused", focused: false });
      }
    };

    window.addEventListener("resize", clearFocusedTypingIfKeyboardClosed);
    visualViewport?.addEventListener(
      "resize",
      clearFocusedTypingIfKeyboardClosed,
    );

    return () => {
      window.removeEventListener("resize", clearFocusedTypingIfKeyboardClosed);
      visualViewport?.removeEventListener(
        "resize",
        clearFocusedTypingIfKeyboardClosed,
      );
    };
  }, [isInputFocused, isTypingMode]);

  useEffect(() => {
    return () => {
      if (responseTimer.current) {
        window.clearTimeout(responseTimer.current);
      }
    };
  }, []);

  const requestPauseConsultation = () => {
    setIsPauseDialogOpen(true);
  };

  const continueConsultation = () => {
    setIsPauseDialogOpen(false);
  };

  const pauseAndExit = (mentorInterventionOverride?: MentorInterventionState) => {
    const pauseEvent = createEncounterEvent("pause_consultation_clicked", {
      coveredFacts: state.coveredFacts,
      coveredChecklistItems: state.coveredChecklistItems,
      coverageEvidence: state.coverageEvidence,
      mentorIntervention:
        mentorInterventionOverride ?? mentorIntervention,
    });

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
    }

    if (mentorSpeechPlayback.isSpeaking) {
      mentorSpeechPlayback.stop();
    }

    if (speechRecognition.isListening) {
      speechRecognition.toggleListening();
    }

    accumulatedActiveMs.current = getActiveDurationMs();
    activeSegmentStartedAt.current = Date.now();
    saveEncounterSnapshot("paused", {
      extraEvents: [pauseEvent],
      mentorInterventionState:
        mentorInterventionOverride ?? mentorIntervention,
      timestamp: pauseEvent.timestamp,
    });
    setIsPauseDialogOpen(false);
    router.push("/home");
  };

  const completeConsultation = async () => {
    if (isCompletingRef.current) {
      return;
    }
    isCompletingRef.current = true;
    setIsCompleting(true);

    if (!serverEncounterId) {
      setEncounterSyncError(
        "The encounter must sync before it can be completed. Please retry sync.",
      );
      isCompletingRef.current = false;
      setIsCompleting(false);
      return;
    }
    const finishEvent = createEncounterEvent("finish_consultation_clicked", {
      coveredFacts: state.coveredFacts,
      coveredChecklistItems: state.coveredChecklistItems,
      coverageEvidence: state.coverageEvidence,
      mentorIntervention,
    });

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
    }

    if (mentorSpeechPlayback.isSpeaking) {
      mentorSpeechPlayback.stop();
    }

    if (speechRecognition.isListening) {
      speechRecognition.toggleListening();
    }

    try {
      const response = await fetch(
        `/api/encounters/${encodeURIComponent(serverEncounterId)}/complete`,
        { method: "POST" },
      );
      const payload: unknown = await response.json().catch(() => undefined);
      if (
        !response.ok ||
        !isServerEncounterResponse(payload) ||
        payload.id !== serverEncounterId ||
        payload.status !== "COMPLETED"
      ) {
        throw new Error("encounter_completion_sync_failed");
      }

      dispatch({
        type: "recordEvent",
        event: finishEvent,
      });
      const completedAttempt = saveLocalEncounterSummary(finishEvent);
      router.push(
        `/mentor/${patientCase.id}?attemptId=${encodeURIComponent(completedAttempt.attemptId)}`,
      );
    } catch {
      setEncounterSyncError(
        "Encounter completion could not be synced. Your work is saved locally; please try again.",
      );
      isCompletingRef.current = false;
      setIsCompleting(false);
    }
  };

  const requestFinishConsultation = () => {
    void completeConsultation();
  };

  const dismissMentorGuidanceCard = () => {
    setMentorIntervention((current) => ({
      ...current,
      guidanceCardVisible: false,
    }));
  };

  return (
    <main
      data-typing-mode={isTypingMode ? "true" : "false"}
      data-input-focused={isInputFocused ? "true" : "false"}
      className="encounter-root min-h-dvh bg-[var(--color-background)] text-[var(--color-text-primary)]"
    >
      <EncounterKeyboardFocus />
      <div className="mx-auto flex h-dvh min-h-0 w-full max-w-[30rem] flex-col px-4 pb-3 pt-4">
        {encounterSyncError ? (
          <div
            role="alert"
            className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <span>{encounterSyncError}</span>
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-2"
              onClick={() => void syncServerEncounter()}
              disabled={isSyncingEncounter}
            >
              {isSyncingEncounter ? "Syncing..." : "Retry sync"}
            </button>
          </div>
        ) : null}
        <header className="encounter-header flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="icon-lg" className="rounded-full">
            <Link href="/home" aria-label="Back to home">
              <ChevronLeft className="size-6" />
            </Link>
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-lg font-semibold">
              {patientCase.patientName}
            </p>
          </div>
          <Button asChild variant="ghost" size="icon-lg" className="rounded-full">
            <Link href="/settings" aria-label="Settings">
              <Settings className="size-5" />
            </Link>
          </Button>
        </header>

        <InteractionExperienceShell
          className="mt-2 max-sm:mt-[calc(3.75rem+env(safe-area-inset-top))]"
          protectedHeightClassName="h-[clamp(10rem,32dvh,15.75rem)]"
          character={
            <div
              data-encounter-patient-viewport
              className="pointer-events-none relative flex h-full w-full justify-center bg-transparent"
            >
              <InteractionCharacterStage
                mode="media"
                idleSrc={patientCase.assets.rest}
                talkingSrc={patientCase.assets.talking}
                alt={`${patientCase.patientName} speaking`}
                isTalking={isPatientAudioPlaying}
                ref={talkingVideoRef}
                className="encounter-patient-viewport z-10 h-full w-full max-w-[28rem]"
              />
            </div>
          }
          conversation={
            <InteractionConversation
              messages={state.messages}
              isActive={isConversationOpen}
              roleLabels={{
                student: "Student",
                patient: "Patient",
              }}
              bottomPaddingClassName="pb-3"
              className="!max-h-none h-full min-h-0 flex-1 pt-3"
            />
          }
          conversationFooter={
            mentorIntervention.guidanceCardVisible &&
            mentorIntervention.promptText ? (
              <MentorGuidanceCard
                promptText={mentorIntervention.promptText}
                bullets={getMentorGuidanceBullets(
                  mentorIntervention.missingCategories,
                )}
                onDismiss={dismissMentorGuidanceCard}
              />
            ) : null
          }
          composer={
            <InteractionComposer
              value={draftQuestion}
              placeholder="Type your question..."
              isSubmitting={isGeneratingPatientResponse}
              isListening={speechRecognition.isListening}
              isVoiceSupported={speechRecognition.isSupported}
              errorMessage={state.responseError}
              statusMessage={!state.responseError ? voiceInputMessage : undefined}
              submitLabel="Send question"
              leftAction={
                <button
                  type="button"
                  aria-label="Perform Examination"
                  onClick={openExaminationSheet}
                  className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full border border-[var(--color-brand)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-brand)]"
                >
                  <Stethoscope className="size-4" />
                  Exam
                </button>
              }
              inputRef={inputRef}
              inputDataAttribute="encounter-keyboard-input"
              onInputFocus={() =>
                dispatch({ type: "setInputFocused", focused: true })
              }
              onInputBlur={() => {
                if (keepFocusedModeForExamination.current) {
                  return;
                }

                dispatch({ type: "setInputFocused", focused: false });
              }}
              onSendPointerDown={(event) => {
                event.preventDefault();
              }}
              onChange={setDraftQuestion}
              onSubmit={() => {
                const text = draftQuestion;

                void submitStudentMessage(text);

                if (text.trim()) {
                  setDraftQuestion("");
                }

                dispatch({ type: "setInputFocused", focused: true });
                inputRef.current?.focus({ preventScroll: true });
              }}
              onToggleVoiceInput={toggleVoiceInput}
            />
          }
          bottomAction={
            <div className="mt-2 grid grid-cols-[0.8fr_1fr] gap-2">
              <Button
                type="button"
                disabled={isCompleting}
                variant="outline"
                className="min-h-12 touch-manipulation rounded-xl border-[var(--color-brand)] bg-[var(--color-surface)] text-base font-semibold text-[var(--color-brand)]"
                onClick={requestPauseConsultation}
              >
                Pause
              </Button>
              <Button
                type="button"
                className="min-h-12 touch-manipulation rounded-xl bg-[var(--color-action)] text-base font-semibold text-white shadow-[0_8px_20px_rgba(63,166,107,0.18)] hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
                onClick={requestFinishConsultation}
              >
                {isCompleting ? "Finishing…" : "Finish Consultation"}
              </Button>
            </div>
          }
        />
      </div>

      {isPauseDialogOpen ? (
        <section className="fixed inset-0 z-[150] grid place-items-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-consultation-title"
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)]"
          >
            <h2
              id="pause-consultation-title"
              className="text-xl font-semibold"
            >
              Pause Consultation?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              Your progress will be saved.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              You can continue this consultation later exactly where you left
              off.
            </p>
            <div className="mt-5 grid gap-2">
              <Button
                type="button"
                className="h-11 rounded-xl bg-[var(--color-action)] text-white"
                onClick={() => pauseAndExit()}
              >
                Pause &amp; Exit
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl bg-[var(--color-surface)]"
                onClick={continueConsultation}
              >
                Continue Consultation
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="examination-sheet"
        className={`pointer-events-auto fixed inset-0 z-[120] bg-black/30 ${
          isExaminationSheetOpen && !selectedExamination ? "block" : "hidden"
        }`}
      >
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[30rem] rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--elevation-subtle)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Examination</h2>
            <button
              type="button"
              aria-label="Close examination sheet"
              onClick={closeExaminationSheet}
              className="inline-flex size-11 touch-manipulation items-center justify-center rounded-full text-[var(--color-text-primary)]"
            >
              <X className="size-5" />
            </button>
          </div>

          {patientCase.assets.examinations.length > 0 ? (
            <div className="space-y-3">
              {patientCase.assets.examinations.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  data-examination-id={image.id}
                  onClick={() => {
                    const examinationViewedEvent = createEncounterEvent(
                      "examination_viewed",
                      {
                        examinationId: image.id,
                        label: image.label,
                      },
                    );
                    const encounterEvents = [
                      ...state.encounterEvents,
                      examinationViewedEvent,
                    ];
                    const clinicalCoverageResult =
                      detectClinicalChecklistCoverage({
                        caseData: patientCase,
                        encounterEvents,
                        examinationsViewed:
                          getViewedExaminationIds(encounterEvents),
                        existingCoveredChecklistIds:
                          state.coveredChecklistItems,
                      });

                    dispatch({
                      type: "openViewer",
                      examinationId: image.id,
                    });
                    dispatch({
                      type: "recordEvent",
                      event: examinationViewedEvent,
                    });
                    if (
                      clinicalCoverageResult.newlyCoveredChecklistIds.length > 0
                    ) {
                      dispatch({
                        type: "applyCoverage",
                        checklistItemIds:
                          clinicalCoverageResult.newlyCoveredChecklistIds,
                        evidence: clinicalCoverageResult.evidence,
                      });
                    }
                  }}
                  className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-left font-semibold text-[var(--color-text-primary)]"
                >
                  <ImageIcon className="size-5 text-[var(--color-brand)]" />
                  {image.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-secondary)]">
              No examination images are available for this case yet.
            </p>
          )}
        </div>
      </section>

      {selectedExamination ? (
        <section
          id={`${patientCase.id}-${selectedExamination.id}`}
          className="pointer-events-auto fixed inset-0 z-[130] block bg-black"
        >
          <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-black/70 p-4 text-white">
            <button
              type="button"
              onClick={() => dispatch({ type: "closeViewerToExamination" })}
              className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1 rounded-full px-3 text-white"
            >
              <ChevronLeft className="size-5" />
              Back
            </button>
            <p className="truncate text-center font-semibold">
              {selectedExamination.label}
            </p>
            <button
              type="button"
              aria-label="Close examination viewer"
              onClick={closeViewerToEncounter}
              className="inline-flex size-11 touch-manipulation items-center justify-center rounded-full text-white"
            >
              <X className="size-5" />
            </button>
          </div>
          <div
            className="size-full overflow-auto pt-20"
            style={{ touchAction: "pinch-zoom" }}
          >
            <Image
              src={selectedExamination.file}
              alt={selectedExamination.label}
              width={1600}
              height={1200}
              unoptimized
              className="mx-auto block min-h-full max-w-none object-contain"
              style={{ width: "140vw" }}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}

function MentorGuidanceCard({
  promptText,
  bullets,
  onDismiss,
}: {
  promptText: string;
  bullets: string[];
  onDismiss: () => void;
}) {
  return (
    <aside className="mx-3 mb-2 rounded-2xl border border-[color-mix(in_srgb,var(--color-brand)_28%,white)] bg-[color-mix(in_srgb,var(--color-brand)_7%,white)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-brand)]">
            Mentor Guidance
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {promptText}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss mentor guidance"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)]"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
      </div>
      {bullets.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {bullets.map((bullet) => (
            <li key={bullet}>- {bullet}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function isSuccessfulConversationResponse(
  response: unknown,
): response is Extract<ConversationApiResponse, { success: true }> {
  if (!response || typeof response !== "object") {
    return false;
  }

  const candidate = response as Record<string, unknown>;

  return (
    candidate.success === true &&
    typeof candidate.provider === "string" &&
    typeof candidate.response === "string" &&
    candidate.response.trim().length > 0 &&
    typeof candidate.encounterId === "string"
  );
}

function isServerEncounterResponse(
  value: unknown,
): value is ServerEncounterResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ServerEncounterResponse>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.caseId === "string" &&
    (candidate.status === "ACTIVE" || candidate.status === "COMPLETED") &&
    typeof candidate.version === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}
