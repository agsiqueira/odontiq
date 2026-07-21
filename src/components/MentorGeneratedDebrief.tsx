"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { InteractionCharacterStage } from "@/components/InteractionCharacterStage";
import { InteractionConversation } from "@/components/InteractionConversation";
import { InteractionComposer } from "@/components/InteractionComposer";
import { InteractionExperienceShell } from "@/components/InteractionExperienceShell";
import {
  readCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "@/lib/localEncounter";
import { Button } from "@/components/ui/button";
import { useMentorSpeechPlayback } from "@/hooks/useMentorSpeechPlayback";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { persistCompletedAttemptToServer } from "@/lib/persistence/completedAttemptClient";

type DebriefOutput = {
  summary: string;
  openingMessage?: string;
  strengths: string[];
  missedOrIncompleteAreas: string[];
  improvementSuggestions: string[];
  evidenceNotes: Array<{
    point: string;
    transcriptEvidence: string | null;
  }>;
  cautionFlags: string[];
};

type ChecklistSection = {
  completed: number;
  total: number;
  missed: string[];
  score: number;
};

type DebriefChecklist = {
  patient: ChecklistSection;
  clinical: ChecklistSection;
  overall: number;
};

type DebriefApiResponse =
  | {
      success: true;
      debrief: DebriefOutput;
      checklist: DebriefChecklist;
    }
  | {
      success: false;
      error?: string;
    };

type MentorChatMessage = {
  id: string;
  role: "student" | "mentor";
  text: string;
};

type MentorChatApiResponse =
  | {
      success: true;
      response: string;
    }
  | {
      success: false;
      error?: string;
    };

type MentorGeneratedDebriefProps = {
  caseId: string;
  attemptId?: string;
};

const SUGGESTED_QUESTIONS = [
  {
    label: "What did I do well?",
    question: "What did I do well?",
  },
  {
    label: "What should I improve?",
    question: "What should I improve?",
  },
  {
    label: "Best diagnosis?",
    question: "What diagnosis best fits this case?",
  },
  {
    label: "Next time?",
    question: "What should I do differently next time?",
  },
];

export function MentorGeneratedDebrief({
  caseId,
  attemptId,
}: MentorGeneratedDebriefProps) {
  const [status, setStatus] = useState<
    "loading-summary" | "empty" | "loading-debrief" | "ready" | "error"
  >("loading-summary");
  const [localSummary, setLocalSummary] = useState<CompletedEncounterAttempt | null>(
    null,
  );
  const [debrief, setDebrief] = useState<DebriefOutput | null>(null);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<MentorChatMessage[]>([]);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [chatError, setChatError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const requestKeyRef = useRef<string | null>(null);
  const chatRequestIdRef = useRef(0);
  const chatAbortRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);
  const spokenOpeningKeyRef = useRef<string | null>(null);
  const mentorVideoRef = useRef<HTMLVideoElement>(null);
  const mentorSpeechPlayback = useMentorSpeechPlayback();
  const {
    isSpeaking: isMentorSpeaking,
    speak: speakMentorMessage,
  } = mentorSpeechPlayback;

  useEffect(() => {
    if (!attemptId) return;
    const summary = readCompletedEncounterAttempt(caseId, attemptId);
    if (summary?.persistence.status === "pending-sync") {
      void persistCompletedAttemptToServer(summary)
        .then((synced) => setLocalSummary(synced))
        .catch(() => {
          // The visible pending state remains available for a later retry.
        });
    }
  }, [attemptId, caseId]);

  useEffect(() => {
    const mentorVideo = mentorVideoRef.current;

    if (!mentorVideo) {
      return;
    }

    if (isMentorSpeaking) {
      try {
        mentorVideo.currentTime = 0;
      } catch {
        // Some browsers block seeking until metadata is loaded.
      }

      void mentorVideo.play().catch(() => undefined);
    } else {
      mentorVideo.pause();

      try {
        mentorVideo.currentTime = 0;
      } catch {
        // Keep the current frame if seeking is not available yet.
      }
    }
  }, [isMentorSpeaking]);

  useEffect(() => {
    let controller: AbortController | null = null;
    const timer = window.setTimeout(() => {
      const summary = attemptId
        ? readCompletedEncounterAttempt(caseId, attemptId)
        : null;

      if (!summary || summary.caseId !== caseId) {
        setStatus("empty");
        setMessage(
          "No completed encounter was found for this case. Finish a consultation first to generate a debrief.",
        );
        return;
      }

      if (summary.conversationHistory.length === 0) {
        setStatus("empty");
        setMessage(
          "This saved encounter does not include a transcript, so a debrief cannot be generated yet.",
        );
        return;
      }

      const requestKey = `${summary.caseId}:${summary.savedAt}:${summary.conversationHistory.length}`;

      if (requestKeyRef.current === requestKey) {
        return;
      }

      requestKeyRef.current = requestKey;
      controller = new AbortController();

      setLocalSummary(summary);
      setStatus("loading-debrief");
      setMessage("");
      setChatError("");
      setChatMessages([]);
      setIsSending(false);
      isSendingRef.current = false;
      spokenOpeningKeyRef.current = null;

      void generateDebrief({ summary, controller })
        .then((response) => {
          if (!controller || controller.signal.aborted) {
            return;
          }

          if (!response.success) {
            throw new Error(response.error || "debrief_generation_failed");
          }

          setDebrief(response.debrief);
          setStatus("ready");
        })
        .catch((error) => {
          if (!controller || controller.signal.aborted) {
            return;
          }

          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "The mentor debrief could not be generated.",
          );
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      chatAbortRef.current?.abort();
    };
  }, [attemptId, caseId]);

  const submitQuestion = useCallback(
    async (question: string) => {
      const trimmedQuestion = question.trim();

      if (!trimmedQuestion || isSendingRef.current || !debrief || !localSummary) {
        return;
      }

      chatAbortRef.current?.abort();

      const requestId = chatRequestIdRef.current + 1;
      const controller = new AbortController();
      const studentMessage: MentorChatMessage = {
        id: `student-${Date.now()}-${requestId}`,
        role: "student",
        text: trimmedQuestion,
      };

      chatRequestIdRef.current = requestId;
      chatAbortRef.current = controller;
      isSendingRef.current = true;
      setIsSending(true);
      setChatError("");
      setDraftQuestion("");
      setChatMessages((currentMessages) => [...currentMessages, studentMessage]);

      try {
        const priorMentorMessages = chatMessages.map(({ role, text }) => ({
          role,
          text,
        }));
        const response = await sendMentorQuestion({
          summary: localSummary,
          debrief,
          mentorMessages: priorMentorMessages,
          question: trimmedQuestion,
          controller,
        });

        if (controller.signal.aborted || chatRequestIdRef.current !== requestId) {
          return;
        }

        if (!response.success) {
          throw new Error(response.error || "mentor_chat_failed");
        }

        setChatMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `mentor-${Date.now()}-${requestId}`,
            role: "mentor",
            text: response.response,
          },
        ]);
        void speakMentorMessage(response.response);
      } catch (error) {
        if (controller.signal.aborted || chatRequestIdRef.current !== requestId) {
          return;
        }

        setChatError(
          error instanceof Error
            ? error.message
            : "The mentor could not answer that question. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted && chatRequestIdRef.current === requestId) {
          isSendingRef.current = false;
          setIsSending(false);
        }
      }
    },
    [chatMessages, debrief, localSummary, speakMentorMessage],
  );
  const submitVoiceQuestion = useCallback(
    (transcript: string) => {
      void submitQuestion(transcript);
    },
    [submitQuestion],
  );

  const speechRecognition = useSpeechRecognition({
    onFinalTranscript: submitVoiceQuestion,
  });
  const voiceInputMessage = speechRecognition.error?.message;

  useEffect(() => {
    if (status !== "ready" || !debrief || !localSummary) {
      return;
    }

    const openingMessage = debrief.openingMessage || debrief.summary;
    const openingKey = `${localSummary.caseId}:${localSummary.savedAt}:${openingMessage}`;

    if (spokenOpeningKeyRef.current === openingKey) {
      return;
    }

    spokenOpeningKeyRef.current = openingKey;
    void speakMentorMessage(openingMessage);
  }, [debrief, localSummary, speakMentorMessage, status]);

  const toggleVoiceInput = () => {
    if (!speechRecognition.isSupported || isSending) {
      return;
    }

    speechRecognition.toggleListening();
  };

  if (status === "loading-summary" || status === "loading-debrief") {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <p className="text-sm font-semibold text-[var(--color-brand)]">
          Mentor debrief
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          Generating a transcript-grounded debrief...
        </p>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <p className="text-sm font-semibold text-[var(--color-brand)]">
          Mentor debrief
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          {message}
        </p>
      </section>
    );
  }

  if (status === "error" || !debrief || !localSummary) {
    return (
      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700">Mentor debrief</p>
        <p className="mt-3 text-sm leading-6 text-red-700">
          The AI mentor debrief could not be generated. Please try finishing the
          encounter again.
        </p>
        {message ? (
          <p className="mt-2 text-xs leading-5 text-red-600">Reason: {message}</p>
        ) : null}
      </section>
    );
  }

  const visibleMessages = [
    {
      id: "mentor-opening",
      role: "mentor",
      text: debrief.openingMessage || debrief.summary,
    },
    ...chatMessages,
  ];

  return (
    <InteractionExperienceShell
      character={
        <MentorCharacter
          isTalking={isMentorSpeaking}
          videoRef={mentorVideoRef}
        />
      }
      conversation={
        <InteractionConversation
          messages={visibleMessages}
          roleLabels={{
            student: "Student",
            mentor: "Mentor",
          }}
          compactFirstMessage
          bottomPaddingClassName="pb-3"
          className="h-full min-h-0 flex-1 pt-3"
          hideRoleLabelsFor={["mentor"]}
          renderAfterMessage={(visibleMessage, index) =>
            visibleMessage.role === "mentor" && index === 0 ? (
              <SuggestedQuestions
                isDisabled={isSending}
                onSelect={submitQuestion}
              />
            ) : null
          }
        />
      }
      conversationFooter={
        <div className="px-5 pb-2">
          {localSummary.persistence.status !== "synced" ? (
            <p
              role="status"
              className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            >
              {localSummary.persistence.status === "conflict"
                ? "This attempt is saved on this device, but a server conflict needs resolution. Server data was not overwritten."
                : "This attempt is saved on this device and is pending secure server synchronization."}
            </p>
          ) : null}
          {isSending ? (
            <p className="mt-1 px-1 text-xs font-medium text-[var(--color-text-secondary)]">
              Mentor is thinking...
            </p>
          ) : null}
        </div>
      }
      composer={
        <InteractionComposer
          value={draftQuestion}
          placeholder="Ask the mentor a follow-up question..."
          isSubmitting={isSending}
          isListening={speechRecognition.isListening}
          isVoiceSupported={speechRecognition.isSupported}
          errorMessage={
            chatError
              ? "The mentor response could not be generated. Please try again."
              : undefined
          }
          statusMessage={!chatError ? voiceInputMessage : undefined}
          submitLabel="Send mentor question"
          onChange={setDraftQuestion}
          onSubmit={() => void submitQuestion(draftQuestion)}
          onToggleVoiceInput={toggleVoiceInput}
        />
      }
    />
  );
}

function MentorCharacter({
  isTalking,
  videoRef,
}: {
  isTalking: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const mentorIdleSrc = "/mentor/idle.png";
  const mentorTalkingSrc = "/mentor/talking.mp4";

  return (
    <div className="pointer-events-none relative flex h-full w-full justify-center bg-transparent">
      <InteractionCharacterStage
        ref={videoRef}
        mode="media"
        idleSrc={mentorIdleSrc}
        talkingSrc={mentorTalkingSrc}
        alt="odontIQ mentor"
        isTalking={isTalking}
        fallback={<MentorPlaceholder />}
        className="z-10 h-full w-[min(25.5rem,92vw)] border-0 bg-transparent shadow-none"
        mediaClassName="object-contain object-top"
      />
    </div>
  );
}

function MentorPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 mx-auto h-full w-24"
    >
      <div className="absolute left-1/2 top-[4%] size-10 -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--color-brand)_16%,#f8f4ef)] shadow-[inset_0_-10px_16px_rgba(0,0,0,0.06)]" />
      <div className="absolute left-1/2 top-[42%] h-[60%] w-24 -translate-x-1/2 rounded-t-[3rem] bg-[var(--color-brand)] shadow-[0_12px_22px_rgba(42,84,92,0.12)]" />
      <div className="absolute left-1/2 top-[49%] h-[45%] w-16 -translate-x-1/2 rounded-t-[2.5rem] bg-white/95" />
      <div className="absolute left-1/2 top-[56%] h-[36%] w-12 -translate-x-1/2 rounded-t-[2rem] bg-[color-mix(in_srgb,var(--color-action)_22%,white)]" />
      <div className="absolute left-1/2 top-[20%] h-1.5 w-6 -translate-x-1/2 rounded-full bg-[var(--color-text-secondary)] opacity-35" />
    </div>
  );
}

function SuggestedQuestions({
  isDisabled,
  onSelect,
}: {
  isDisabled: boolean;
  onSelect: (question: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {SUGGESTED_QUESTIONS.map(({ label, question }) => (
        <Button
          key={question}
          type="button"
          variant="outline"
          size="sm"
          className="h-full min-h-10 rounded-full bg-[var(--color-surface)] px-3 py-2 text-center text-xs font-semibold"
          disabled={isDisabled}
          onClick={() => void onSelect(question)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

async function generateDebrief({
  summary,
  controller,
}: {
  summary: CompletedEncounterAttempt;
  controller: AbortController;
}): Promise<DebriefApiResponse> {
  const response = await fetch("/api/debrief", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      caseId: summary.caseId,
      conversationHistory: summary.conversationHistory,
      coveredChecklistItems: summary.coveredChecklistItems,
      coveredFacts: summary.coveredFacts,
      examinationsViewed: summary.examinationsViewed,
    }),
    signal: controller.signal,
  });
  const data = (await response.json().catch(() => undefined)) as
    | DebriefApiResponse
    | undefined;

  if (!response.ok || !data) {
    return {
      success: false,
      error: "debrief_request_failed",
    };
  }

  return data;
}

async function sendMentorQuestion({
  summary,
  debrief,
  mentorMessages,
  question,
  controller,
}: {
  summary: CompletedEncounterAttempt;
  debrief: DebriefOutput;
  mentorMessages: Array<{
    role: "student" | "mentor";
    text: string;
  }>;
  question: string;
  controller: AbortController;
}): Promise<MentorChatApiResponse> {
  const response = await fetch("/api/debrief/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      caseId: summary.caseId,
      conversationHistory: summary.conversationHistory,
      debrief: {
        summary: debrief.summary,
        strengths: debrief.strengths,
        missedOrIncompleteAreas: debrief.missedOrIncompleteAreas,
        improvementSuggestions: debrief.improvementSuggestions,
        evidenceNotes: debrief.evidenceNotes,
        cautionFlags: debrief.cautionFlags,
      },
      mentorMessages,
      latestQuestion: question,
      examinationsViewed: summary.examinationsViewed,
      coveredChecklistItems: summary.coveredChecklistItems,
    }),
    signal: controller.signal,
  });
  const data = (await response.json().catch(() => undefined)) as
    | MentorChatApiResponse
    | undefined;

  if (!response.ok || !data) {
    return {
      success: false,
      error: "mentor_chat_request_failed",
    };
  }

  return data;
}
