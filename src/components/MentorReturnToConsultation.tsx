"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  readCompletedEncounterAttempt,
  writeEncounterSnapshot,
  type LocalEncounterSnapshot,
} from "@/lib/localEncounter";

type MentorReturnToConsultationProps = {
  caseId: string;
  attemptId?: string;
};

export function MentorReturnToConsultation({
  caseId,
  attemptId,
}: MentorReturnToConsultationProps) {
  const router = useRouter();

  const returnToConsultation = () => {
    if (!attemptId) return;
    try {
      const summary = readCompletedEncounterAttempt(caseId, attemptId);
      if (!summary) return;

      const resumedAt = new Date().toISOString();
      const snapshot: LocalEncounterSnapshot = {
        ...summary,
        lifecycleStatus: "in-progress",
        savedAt: resumedAt,
        currentView: {
          communicationMode: "text",
          activePanel: "conversation",
        },
        draftQuestion: "",
        timers: {
          activeDurationMs: summary.activeDurationMs ?? 0,
          pausedDurationMs: summary.pausedDurationMs ?? 0,
          activeSegmentStartedAt: resumedAt,
        },
        metadata: {
          createdAt: summary.metadata?.createdAt ?? summary.savedAt,
          updatedAt: resumedAt,
          resumedAt,
        },
      };

      writeEncounterSnapshot(snapshot);
      router.push(`/encounter/${caseId}`);
    } catch {
      // A missing or malformed completed encounter cannot be resumed safely.
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      onClick={returnToConsultation}
      className="h-12 rounded-xl text-base font-semibold"
    >
      <ArrowLeft className="size-5" />
      Return to Consultation
    </Button>
  );
}
