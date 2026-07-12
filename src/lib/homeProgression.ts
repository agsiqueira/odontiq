import type { OdontIQCase } from "./cases";
import type {
  CompletedEncounterAttempt,
  CompletedEncounterStore,
  EncounterSnapshotIndex,
} from "./localEncounter";
import { validatePersistedFacultyArtifacts } from "./facultyRubric/report/artifactIntegrity";

export type HomeProgression =
  | {
      kind: "resume";
      patientCase: OdontIQCase;
      snapshotUpdatedAt: string;
    }
  | {
      kind: "recommend";
      patientCase: OdontIQCase;
      action: "start" | "retry";
    }
  | {
      kind: "complete";
      latestCompletedCase?: OdontIQCase;
    };

export function getHomeProgression({
  cases,
  snapshots,
  completedStore,
  isPassed = isCompletedAttemptPassing,
}: {
  cases: OdontIQCase[];
  snapshots: EncounterSnapshotIndex;
  completedStore: CompletedEncounterStore;
  isPassed?: (attempt: CompletedEncounterAttempt) => boolean;
}): HomeProgression {
  const activeSnapshot = Object.values(snapshots)
    .filter(
      (snapshot) =>
        snapshot.lifecycleStatus === "in-progress" ||
        snapshot.lifecycleStatus === "paused",
    )
    .sort(
      (left, right) =>
        Date.parse(right.metadata.updatedAt ?? right.savedAt) -
        Date.parse(left.metadata.updatedAt ?? left.savedAt),
    )[0];
  if (activeSnapshot) {
    const patientCase = cases.find((item) => item.id === activeSnapshot.caseId);
    if (patientCase) {
      return {
        kind: "resume",
        patientCase,
        snapshotUpdatedAt: activeSnapshot.metadata.updatedAt,
      };
    }
  }

  const firstUnpassed = cases.find(
    (patientCase) =>
      !(completedStore[patientCase.id] ?? []).some(isPassed),
  );
  if (firstUnpassed) {
    return {
      kind: "recommend",
      patientCase: firstUnpassed,
      action: (completedStore[firstUnpassed.id]?.length ?? 0) > 0 ? "retry" : "start",
    };
  }

  const latestAttempt = Object.values(completedStore)
    .flat()
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))[0];
  return {
    kind: "complete",
    latestCompletedCase: latestAttempt
      ? cases.find((item) => item.id === latestAttempt.caseId)
      : undefined,
  };
}

export function isCompletedAttemptPassing(
  attempt: CompletedEncounterAttempt,
  hasValidArtifacts: (attempt: CompletedEncounterAttempt) => boolean =
    hasValidCanonicalArtifacts,
) {
  if (
    attempt.facultyReportGeneration?.status !== "complete" ||
    attempt.facultyRubricEvaluation?.status !== "complete" ||
    attempt.facultyRubricScore?.status !== "complete" ||
    attempt.facultyRubricScore.percentage === null ||
    attempt.facultyRubricScore.percentage < 84 ||
    !attempt.facultyReport
  ) {
    return false;
  }

  return hasValidArtifacts(attempt);
}

function hasValidCanonicalArtifacts(attempt: CompletedEncounterAttempt) {
  return validatePersistedFacultyArtifacts({
    caseId: attempt.caseId,
    evaluation: attempt.facultyRubricEvaluation,
    score: attempt.facultyRubricScore,
    report: attempt.facultyReport,
  }).status === "valid";
}
