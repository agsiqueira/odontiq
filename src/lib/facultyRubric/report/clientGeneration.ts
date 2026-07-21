import { facultyRubrics } from "../caseRubrics";
import type { FacultyRubricEvaluationState } from "../evaluation/state";
import { scoreFacultyRubricEvaluations } from "../scoring";
import {
  readCompletedEncounterAttempt,
  writeCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "../../localEncounter";
import { validatePersistedFacultyArtifacts } from "./artifactIntegrity";
import { buildFacultyReport } from "./builder";
import { persistCompletedAttemptToServer } from "../../persistence/completedAttemptClient";

const GENERATION_LEASE_MS = 60_000;
const inFlightByCase = new Map<
  string,
  Promise<CanonicalFacultyGenerationResult>
>();

export type CanonicalFacultyGenerationResult =
  | { status: "complete"; summary: CompletedEncounterAttempt }
  | { status: "in-progress"; summary: CompletedEncounterAttempt }
  | { status: "failed"; summary: CompletedEncounterAttempt; error: string };

type EvaluateFacultyRubric = (
  summary: CompletedEncounterAttempt,
) => Promise<FacultyRubricEvaluationState>;

export function createFacultyGenerationAttempt(status: "pending" | "in-progress" = "pending") {
  const now = new Date().toISOString();
  return {
    status,
    attemptId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `faculty-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startedAt: now,
    updatedAt: now,
  } as const;
}

export function ensureCanonicalFacultyArtifacts({
  caseId,
  attemptId,
  forceRetry = false,
  evaluate = requestFacultyEvaluation,
}: {
  caseId: string;
  attemptId: string;
  forceRetry?: boolean;
  evaluate?: EvaluateFacultyRubric;
}): Promise<CanonicalFacultyGenerationResult> {
  const operationKey = `${caseId}:${attemptId}`;
  const active = inFlightByCase.get(operationKey);
  if (active) return active;

  const summary = readCompletedEncounterAttempt(caseId, attemptId);
  if (!summary) {
    return Promise.reject(new Error("completed_encounter_missing"));
  }
  if (hasValidCanonicalArtifacts(summary)) {
    return Promise.resolve({ status: "complete", summary });
  }
  if (summary.facultyReportGeneration?.status === "failed" && !forceRetry) {
    return Promise.resolve({
      status: "failed",
      summary,
      error: summary.facultyReportGeneration.error ?? "faculty_generation_failed",
    });
  }

  const generation = summary.facultyReportGeneration;
  const leaseRemaining =
    !forceRetry && generation?.status === "in-progress"
      ? Math.max(
          0,
          GENERATION_LEASE_MS -
            (Date.now() - Date.parse(generation.updatedAt || generation.startedAt)),
        )
      : 0;
  const operation =
    leaseRemaining > 0
      ? waitForExistingGeneration({
          caseId,
          attemptId,
          leaseRemaining,
          evaluate,
        })
      : runCanonicalFacultyGeneration({
          summary,
          evaluate,
          forceRetry,
        });

  inFlightByCase.set(operationKey, operation);
  const clearOperation = () => {
    if (inFlightByCase.get(operationKey) === operation) {
      inFlightByCase.delete(operationKey);
    }
  };
  void operation.then(clearOperation, clearOperation);
  return operation;
}

async function waitForExistingGeneration({
  caseId,
  attemptId,
  leaseRemaining,
  evaluate,
}: {
  caseId: string;
  attemptId: string;
  leaseRemaining: number;
  evaluate: EvaluateFacultyRubric;
}) {
  await new Promise((resolve) => window.setTimeout(resolve, leaseRemaining));
  const latest = readCompletedEncounterAttempt(caseId, attemptId);
  if (!latest) throw new Error("completed_encounter_missing");
  if (hasValidCanonicalArtifacts(latest)) {
    return { status: "complete" as const, summary: latest };
  }
  if (latest.facultyReportGeneration?.status === "failed") {
    return {
      status: "failed" as const,
      summary: latest,
      error: latest.facultyReportGeneration.error ?? "faculty_generation_failed",
    };
  }
  return runCanonicalFacultyGeneration({
    summary: latest,
    evaluate,
    forceRetry: true,
  });
}

async function runCanonicalFacultyGeneration({
  summary,
  evaluate,
  forceRetry,
}: {
  summary: CompletedEncounterAttempt;
  evaluate: EvaluateFacultyRubric;
  forceRetry: boolean;
}): Promise<CanonicalFacultyGenerationResult> {
  const attempt =
    forceRetry || !summary.facultyReportGeneration
      ? createFacultyGenerationAttempt("in-progress")
      : {
          ...summary.facultyReportGeneration,
          status: "in-progress" as const,
          updatedAt: new Date().toISOString(),
          error: undefined,
        };
  const startedSummary = {
    ...summary,
    facultyRubricEvaluation: forceRetry
      ? summary.facultyRubricEvaluation
      : undefined,
    facultyRubricScore: undefined,
    facultyReport: undefined,
    facultyReportGeneration: attempt,
  };
  await writeCompletedSummary(startedSummary);

  try {
    const evaluation = await evaluate(startedSummary);
    if (evaluation.status !== "complete") {
      throw new Error(evaluation.error || "faculty_evaluation_incomplete");
    }
    const rubric = facultyRubrics.find((item) => item.caseId === summary.caseId);
    if (!rubric) throw new Error("faculty_rubric_missing");
    const score = scoreFacultyRubricEvaluations({
      caseId: summary.caseId,
      evaluations: evaluation.evaluations,
    });
    if (score.passStatus === "technical-invalid") {
      throw new Error("faculty_score_invalid");
    }
    const report = buildFacultyReport({
      rubric,
      completedEvaluations: evaluation.evaluations,
      score,
      generatedAt: new Date().toISOString(),
    });
    const integrity = validatePersistedFacultyArtifacts({
      caseId: summary.caseId,
      evaluation,
      score,
      report,
    });
    if (integrity.status !== "valid") {
      throw new Error(`faculty_artifact_${integrity.status}`);
    }

    const latest = readCompletedEncounterAttempt(summary.caseId, summary.attemptId);
    if (!latest) throw new Error("completed_encounter_missing");
    if (hasValidCanonicalArtifacts(latest)) {
      return { status: "complete", summary: latest };
    }
    if (latest.facultyReportGeneration?.attemptId !== attempt.attemptId) {
      return { status: "in-progress", summary: latest };
    }
    const completedSummary: CompletedEncounterAttempt = {
      ...latest,
      facultyRubricEvaluation: evaluation,
      facultyRubricScore: score,
      facultyReport: report,
      facultyReportGeneration: {
        ...attempt,
        status: "complete",
        updatedAt: new Date().toISOString(),
      },
    };
    await writeCompletedSummary(completedSummary);
    return { status: "complete", summary: completedSummary };
  } catch (error) {
    const latest =
      readCompletedEncounterAttempt(summary.caseId, summary.attemptId) ??
      startedSummary;
    if (hasValidCanonicalArtifacts(latest)) {
      return { status: "complete", summary: latest };
    }
    const message = error instanceof Error ? error.message : "faculty_generation_failed";
    if (latest.facultyReportGeneration?.attemptId === attempt.attemptId) {
      const failedSummary: CompletedEncounterAttempt = {
        ...latest,
        facultyRubricScore: undefined,
        facultyReport: undefined,
        facultyReportGeneration: {
          ...attempt,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: message,
        },
      };
      await writeCompletedSummary(failedSummary);
      return { status: "failed", summary: failedSummary, error: message };
    }
    return { status: "in-progress", summary: latest };
  }
}

async function requestFacultyEvaluation(summary: CompletedEncounterAttempt) {
  const response = await fetch("/api/faculty-rubric/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: summary.caseId,
      conversationHistory: summary.conversationHistory,
      encounterEvents: summary.encounterEvents,
      coveredChecklistItems: summary.coveredChecklistItems,
      existingState: summary.facultyRubricEvaluation,
      forceRefresh: true,
    }),
  });
  const payload = (await response.json()) as {
    success?: boolean;
    state?: FacultyRubricEvaluationState;
    error?: string;
  };
  if (!response.ok || !payload.success || !payload.state) {
    throw new Error(payload.error || "faculty_evaluation_request_failed");
  }
  return payload.state;
}

function hasValidCanonicalArtifacts(summary: CompletedEncounterAttempt) {
  return (
    validatePersistedFacultyArtifacts({
      caseId: summary.caseId,
      evaluation: summary.facultyRubricEvaluation,
      score: summary.facultyRubricScore,
      report: summary.facultyReport,
    }).status === "valid"
  );
}

async function writeCompletedSummary(summary: CompletedEncounterAttempt) {
  writeCompletedEncounterAttempt(summary);
  await persistCompletedAttemptToServer(summary);
}
