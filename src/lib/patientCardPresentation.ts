import type { OdontIQCase } from "./cases";
import { getCaseDisplayLabel } from "./caseDisplay";
import { isCompletedAttemptPassing } from "./homeProgression";
import type {
  CompletedEncounterAttempt,
  LocalEncounterSnapshot,
} from "./localEncounter";

export type PatientCardPresentation = {
  patientCase: OdontIQCase;
  caseLabel: string;
  openingStatement: string;
  urgency: OdontIQCase["urgency"];
  duration: string;
  statusLabel: "Not Started" | "In Progress" | "Completed" | "Not Passed";
  lastUpdated?: string;
  actionLabel: "Start Case" | "Resume Case" | "View Report" | "Retry Case";
  href: string;
};

export function buildPatientCardPresentation({
  patientCase,
  snapshot,
  attempts = [],
  preferredAction,
}: {
  patientCase: OdontIQCase;
  snapshot?: LocalEncounterSnapshot | null;
  attempts?: CompletedEncounterAttempt[];
  preferredAction?: "start" | "resume" | "retry";
}): PatientCardPresentation {
  const active =
    preferredAction === "resume" ||
    snapshot?.lifecycleStatus === "paused" ||
    snapshot?.lifecycleStatus === "in-progress";
  if (active) {
    return basePresentation(patientCase, {
      statusLabel: "In Progress",
      actionLabel: "Resume Case",
      href: `/encounter/${patientCase.id}`,
      lastUpdated: snapshot?.metadata.updatedAt ?? snapshot?.savedAt,
    });
  }

  const completedAttempt = attempts.find((attempt) =>
    isCompletedAttemptPassing(attempt),
  );
  if (completedAttempt && preferredAction !== "retry") {
    return basePresentation(patientCase, {
      statusLabel: "Completed",
      actionLabel: "View Report",
      href: `/reports/${patientCase.id}?attemptId=${encodeURIComponent(
        completedAttempt.attemptId,
      )}`,
      lastUpdated:
        completedAttempt.metadata?.completedAt ?? completedAttempt.savedAt,
    });
  }

  if (preferredAction === "retry" || attempts.length > 0) {
    return basePresentation(patientCase, {
      statusLabel: "Not Passed",
      actionLabel: "Retry Case",
      href: `/encounter/${patientCase.id}`,
    });
  }

  return basePresentation(patientCase, {
    statusLabel: "Not Started",
    actionLabel: "Start Case",
    href: `/encounter/${patientCase.id}`,
  });
}

function basePresentation(
  patientCase: OdontIQCase,
  progress: Pick<
    PatientCardPresentation,
    "statusLabel" | "actionLabel" | "href" | "lastUpdated"
  >,
): PatientCardPresentation {
  return {
    patientCase,
    caseLabel: getCaseDisplayLabel(patientCase.id),
    openingStatement: patientCase.openingStatement,
    urgency: patientCase.urgency,
    duration: patientCase.estimatedTime,
    ...progress,
  };
}
