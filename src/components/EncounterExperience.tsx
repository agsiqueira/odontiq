"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ChevronLeft,
  ImageIcon,
  Keyboard,
  Mic,
  Send,
  Settings,
  Square,
  Stethoscope,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EncounterConversation } from "@/components/EncounterConversation";
import { EncounterKeyboardFocus } from "@/components/EncounterKeyboardFocus";
import type { OdontIQCase } from "@/lib/cases";
import {
  LAST_ENCOUNTER_STORAGE_KEY,
  type LocalEncounterSummary,
} from "@/lib/localEncounter";
import {
  type ConversationMessage,
  type ConversationRole,
} from "@/lib/conversationEngine";
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
  | "finish_consultation_clicked";

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
  encounterEvents: EncounterEvent[];
};

type EncounterAction =
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
  encounterEvents: [],
};

const patientResponseErrorMessage =
  "The AI patient response could not be generated. Please try again.";

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

function appendUnique(currentItems: string[], nextItems: string[] = []) {
  return Array.from(new Set([...currentItems, ...nextItems]));
}

function encounterReducer(
  state: EncounterState,
  action: EncounterAction,
): EncounterState {
  switch (action.type) {
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
      return {
        ...state,
        coveredFacts: appendUnique(state.coveredFacts, action.facts),
        coveredChecklistItems: action.checklistItemId
          ? appendUnique(state.coveredChecklistItems, [action.checklistItemId])
          : state.coveredChecklistItems,
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
  const [state, dispatch] = useReducer(
    encounterReducer,
    initialEncounterState,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceSubmitRef = useRef<(transcript: string) => void>(() => {});
  const keepFocusedModeForExamination = useRef(false);
  const fullViewportHeight = useRef(0);
  const messageSequence = useRef(0);
  const responseTimer = useRef<number | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement>(null);
  const isTypingMode = state.communicationMode === "text";
  const isInputFocused = state.isInputFocused;
  const isExaminationSheetOpen = state.activePanel === "examination";
  const speechPlayback = useSpeechSynthesisPlayback({
    caseId: patientCase.id,
  });
  const isGeneratingPatientResponse = state.isSpeaking;
  const isPatientAudioPlaying = speechPlayback.isSpeaking;
  const selectedExamination = patientCase.assets.examinations.find(
    (image) => image.id === state.selectedExaminationId,
  );
  const isConversationOpen = state.activePanel === "conversation";

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

  const getViewedExaminationIds = (events: EncounterEvent[]) =>
    appendUnique(
      [],
      events
        .filter((event) => event.type === "examination_viewed")
        .map((event) => event.payload?.examinationId)
        .filter((examinationId): examinationId is string =>
          typeof examinationId === "string",
        ),
    );

  const saveLocalEncounterSummary = (finishEvent: EncounterEvent) => {
    const encounterEvents = [...state.encounterEvents, finishEvent];
    const localSummary: LocalEncounterSummary = {
      caseId: patientCase.id,
      conversationHistory: state.messages,
      coveredFacts: state.coveredFacts,
      coveredChecklistItems: state.coveredChecklistItems,
      encounterEvents,
      examinationsViewed: getViewedExaminationIds(encounterEvents),
      savedAt: finishEvent.timestamp,
    };

    window.localStorage.setItem(
      LAST_ENCOUNTER_STORAGE_KEY,
      JSON.stringify(localSummary),
    );
  };

  const submitStudentMessage = async (studentMessage: string) => {
    const text = studentMessage.trim();

    if (!text || isGeneratingPatientResponse) {
      return;
    }

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
    }

    const studentConversationMessage = createConversationMessage(
      "student",
      text,
    );
    const conversationHistory = state.messages;

    dispatch({
      type: "appendMessage",
      message: studentConversationMessage,
    });
    dispatch({ type: "setResponseError", error: undefined });
    dispatch({
      type: "recordEvent",
      event: createEncounterEvent("student_message_sent", {
        messageId: studentConversationMessage.id,
        role: studentConversationMessage.role,
        text,
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
          coveredChecklistItems: state.coveredChecklistItems,
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

  const switchToTypingMode = () => {
    speechRecognition.stopListening();
    dispatch({ type: "switchToText" });
    dispatch({
      type: "recordEvent",
      event: createEncounterEvent("keyboard_mode_used"),
    });
  };

  const switchToVoiceMode = () => {
    keepFocusedModeForExamination.current = false;
    dispatch({ type: "switchToVoice" });
  };

  const toggleVoiceInput = () => {
    if (!speechRecognition.isSupported) {
      return;
    }

    if (speechPlayback.isSpeaking) {
      speechPlayback.stop();
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

  return (
    <main
      data-typing-mode={isTypingMode ? "true" : "false"}
      data-input-focused={isInputFocused ? "true" : "false"}
      className="encounter-root min-h-dvh bg-[var(--color-background)] text-[var(--color-text-primary)]"
    >
      <EncounterKeyboardFocus />
      <div className="encounter-stage mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 pb-60 pt-4">
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

        <section
          id="keyboard-panel"
          className="encounter-patient-layer mt-2 scroll-mt-2"
        >
          <div
            data-encounter-patient-viewport
            className="encounter-patient-viewport relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black shadow-[var(--elevation-subtle)]"
          >
            <Image
              src={patientCase.assets.rest}
              alt={`${patientCase.patientName} at rest`}
              fill
              priority
              sizes="(max-width: 480px) 100vw, 480px"
              className={`object-cover transition-opacity duration-200 ${
                isPatientAudioPlaying ? "opacity-0" : "opacity-100"
              }`}
            />
            <video
              ref={talkingVideoRef}
              src={patientCase.assets.talking}
              poster={patientCase.assets.rest}
              aria-label={`${patientCase.patientName} speaking`}
              loop
              muted
              playsInline
              preload="auto"
              className={`absolute inset-0 size-full object-cover transition-opacity duration-200 ${
                isPatientAudioPlaying ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </section>
      </div>

      <section
        id="conversation"
        className={`conversation-panel pointer-events-auto fixed inset-x-0 z-30 mx-auto max-w-[30rem] overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--elevation-subtle)] ${
          isConversationOpen ? "flex flex-col" : "hidden"
        }`}
      >
        <EncounterConversation
          messages={state.messages}
          isOpen={isConversationOpen}
        />
      </section>

      <section
        id="controls"
        className="encounter-controls pointer-events-auto fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[30rem] rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--elevation-subtle)]"
      >
        <a
          href={isConversationOpen ? "#controls" : "#conversation"}
          onClick={(event) => {
            event.preventDefault();
            const nextType = isConversationOpen
              ? "closeConversation"
              : "openConversation";

            dispatch({
              type: nextType,
            });

            if (nextType === "openConversation") {
              dispatch({
                type: "recordEvent",
                event: createEncounterEvent("conversation_opened"),
              });
            }
          }}
          className="conversation-toggle mb-3 flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm font-semibold text-[var(--color-brand)]"
          aria-label={
            isConversationOpen ? "Collapse conversation" : "Expand conversation"
          }
        >
          <span aria-hidden="true">{isConversationOpen ? "▼ " : "▲ "}</span>
          Conversation
        </a>

        {state.responseError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.responseError}
          </p>
        ) : null}

        {!state.responseError && voiceInputMessage ? (
          <p
            role="status"
            className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {voiceInputMessage}
          </p>
        ) : null}

        <div className="encounter-voice-mode grid min-h-[7.25rem] grid-rows-[6rem_1.25rem] place-items-center">
          <button
            type="button"
            aria-label={
              speechRecognition.isListening
                ? "Stop listening"
                : "Start voice input"
            }
            disabled={
              isGeneratingPatientResponse || !speechRecognition.isSupported
            }
            onClick={toggleVoiceInput}
            className="inline-flex size-24 touch-manipulation items-center justify-center rounded-full bg-[var(--color-action)] text-white shadow-[0_10px_24px_rgba(63,166,107,0.22)] disabled:opacity-45"
          >
            {speechRecognition.isListening ? (
              <Square className="size-9" />
            ) : (
              <Mic className="size-10" />
            )}
          </button>
          <p
            aria-live="polite"
            className="h-5 text-sm font-medium text-[var(--color-brand)]"
          >
            {speechRecognition.isListening ? "Listening..." : ""}
          </p>
        </div>

        <div className="encounter-typing-mode hidden">
          <div className="encounter-typing-row grid grid-cols-[1fr_3rem] gap-2">
            <input
              ref={inputRef}
              data-encounter-keyboard-input
              type="text"
              placeholder="Type your question..."
              onFocus={() =>
                dispatch({ type: "setInputFocused", focused: true })
              }
              onBlur={() => {
                if (keepFocusedModeForExamination.current) {
                  return;
                }

                dispatch({ type: "setInputFocused", focused: false });
              }}
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base outline-none transition focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand)_14%,white)]"
            />
            <button
              type="button"
              data-encounter-send
              aria-label="Send question"
              disabled={isGeneratingPatientResponse}
              onPointerDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                const text = inputRef.current?.value ?? "";

                submitStudentMessage(text);

                if (inputRef.current && text.trim()) {
                  inputRef.current.value = "";
                }

                dispatch({ type: "setInputFocused", focused: true });
                inputRef.current?.focus({ preventScroll: true });
              }}
              className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-[var(--color-action)] text-white shadow-[0_8px_20px_rgba(63,166,107,0.18)]"
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Open keyboard input"
            onClick={switchToTypingMode}
            className="encounter-keyboard-switch inline-flex size-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)]"
          >
            <Keyboard className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Return to microphone input"
            onClick={switchToVoiceMode}
            className="encounter-microphone-switch hidden size-12 touch-manipulation items-center justify-center rounded-xl border border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)]"
          >
            <Mic className="size-6" />
          </button>
          <button
            type="button"
            onClick={openExaminationSheet}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border border-[var(--color-brand)] bg-[var(--color-surface)] px-5 text-sm font-medium text-[var(--color-brand)]"
          >
            <Stethoscope className="size-4" />
            Perform Examination
          </button>
        </div>

        <Button
          asChild
          className="mt-2 min-h-12 w-full touch-manipulation rounded-xl bg-[var(--color-action)] text-base font-semibold text-white shadow-[0_8px_20px_rgba(63,166,107,0.18)] hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
        >
          <Link
            href={`/mentor/${patientCase.id}`}
            onClick={() => {
              const finishEvent = createEncounterEvent(
                "finish_consultation_clicked",
                {
                  coveredFacts: state.coveredFacts,
                  coveredChecklistItems: state.coveredChecklistItems,
                },
              );

              dispatch({
                type: "recordEvent",
                event: finishEvent,
              });
              saveLocalEncounterSummary(finishEvent);
            }}
          >
            Finish Consultation
          </Link>
        </Button>
      </section>

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
                    dispatch({
                      type: "openViewer",
                      examinationId: image.id,
                    });
                    dispatch({
                      type: "recordEvent",
                      event: createEncounterEvent("examination_viewed", {
                        examinationId: image.id,
                        label: image.label,
                      }),
                    });
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
