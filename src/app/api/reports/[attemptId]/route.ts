import { requireAppUser } from "@/lib/requireAppUser";
import {
  ReportAttemptNotFoundError,
} from "@/lib/persistence/services/reportsService";
import { reportsService } from "@/lib/persistence/services/reports";
import { completedAttemptRepository } from "@/lib/persistence/repositories/completedAttemptRepository";
import { isEncounterDocument } from "@/lib/encounter/encounterDocument";
import { evaluateFacultyRubricForEncounter } from "@/lib/facultyRubric/evaluation";
import { facultyRubrics } from "@/lib/facultyRubric/caseRubrics";
import { scoreFacultyRubricEvaluations } from "@/lib/facultyRubric/scoring";
import { buildFacultyReport } from "@/lib/facultyRubric/report";
import { validatePersistedFacultyArtifacts } from "@/lib/facultyRubric/report/artifactIntegrity";
import type { CompletedEncounterAttempt } from "@/lib/localEncounter";
import {
  getGenerationDisposition,
  isGenerationLeaseActive,
  runWithGenerationOwnership,
} from "@/lib/facultyRubric/report/generationOwnership";

export const runtime = "nodejs";
const REPORT_GENERATION_LEASE_MS = 5 * 60_000;

export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  const user = await requireAppUser();
  try {
    return reportStateResponse(await reportsService.getReport(user.id, attemptId));
  } catch (error) {
    if (error instanceof ReportAttemptNotFoundError) {
      return Response.json({ error: "report_not_found" }, { status: 404 });
    }
    throw error;
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  const user = await requireAppUser();
  const attempt = await completedAttemptRepository.findOwnedByAttemptId(user.id, attemptId);
  if (!attempt) return Response.json({ error: "report_not_found" }, { status: 404 });
  const existingArtifacts = getPersistedArtifacts(attempt);
  const existingIntegrity = validatePersistedFacultyArtifacts({
    caseId: attempt.caseId,
    ...existingArtifacts,
  });
  const disposition = getGenerationDisposition({
    artifactsValid: existingIntegrity.status === "valid",
    status: attempt.generationStatus,
    startedAt: attempt.generationStartedAt,
    now: Date.now(),
    leaseMs: REPORT_GENERATION_LEASE_MS,
  });
  if (disposition === "complete") {
    return reportStateResponse(await reportsService.getReport(user.id, attemptId));
  }
  if (disposition === "in-progress") {
    return inProgressResponse();
  }
  const document = isEncounterDocument(attempt.encounter.encounterData)
    ? attempt.encounter.encounterData
    : null;
  if (!document) return Response.json({ error: "invalid_encounter_document" }, { status: 422 });

  const generationAttemptId = crypto.randomUUID();
  const stage = { current: "evaluation" };
  try {
    const ownership = await runWithGenerationOwnership({
      claim: () => completedAttemptRepository.claimReportGeneration({
        userId: user.id,
        attemptId,
        generationAttemptId,
        expectedUpdatedAt: attempt.updatedAt,
        staleBefore: new Date(Date.now() - REPORT_GENERATION_LEASE_MS),
        allowInvalidCompleteReclaim: attempt.generationStatus === "COMPLETE",
      }),
      generate: async () => {
        const evaluation = await evaluateFacultyRubricForEncounter({
          caseId: attempt.caseId,
          conversationHistory: document.messages,
          encounterEvents: document.lifecycleEvents,
          coveredChecklistItems: document.checklistCoverage.itemIds,
          forceRefresh: true,
        });
        if (evaluation.status !== "complete") throw new Error(evaluation.error || "faculty_evaluation_incomplete");
        stage.current = "scoring";
        const rubric = facultyRubrics.find((candidate) => candidate.caseId === attempt.caseId);
        if (!rubric) throw new Error("faculty_rubric_missing");
        const score = scoreFacultyRubricEvaluations({ caseId: attempt.caseId, evaluations: evaluation.evaluations });
        if (score.passStatus === "technical-invalid") throw new Error("faculty_score_invalid");
        stage.current = "report-building";
        const report = buildFacultyReport({ rubric, completedEvaluations: evaluation.evaluations, score, generatedAt: new Date().toISOString() });
        const integrity = validatePersistedFacultyArtifacts({ caseId: attempt.caseId, evaluation, score, report });
        if (integrity.status !== "valid") throw new Error(`faculty_artifact_${integrity.status}`);
        stage.current = "persistence";
        const completed = await completedAttemptRepository.completeClaimedReportGeneration({
          userId: user.id, encounterId: attempt.encounterId, caseId: attempt.caseId,
          generationAttemptId,
          attemptId, generationStatus: "COMPLETE", integrityStatus: "VALID",
          percentage: score.percentage ?? undefined, passed: score.passStatus === "pass",
          completedAt: attempt.completedAt ?? undefined, evaluation, score, report,
        });
        return completed;
      },
      releaseAfterFailure: async (error) => {
        const message = error instanceof Error ? error.message : "faculty_generation_failed";
        await completedAttemptRepository.failClaimedReportGeneration({
          userId: user.id,
          attemptId,
          generationAttemptId,
          error: message,
        });
      },
    });
    if (ownership.status === "in-progress" || !ownership.value) {
      return reportStateResponse(await reportsService.getReport(user.id, attemptId), true);
    }
    return reportStateResponse(await reportsService.getReport(user.id, attemptId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "faculty_generation_failed";
    if (process.env.NODE_ENV !== "production") {
      console.error("Faculty report generation failed.", {
        attemptId, caseId: attempt.caseId, stage: stage.current,
        category: classifyFailure(message), error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return Response.json({ error: "faculty_report_generation_failed", stage: stage.current }, { status: 502 });
  }
}

type PersistedReportState = Awaited<ReturnType<typeof reportsService.getReport>>;

function reportStateResponse(state: PersistedReportState, contested = false) {
  const integrity = validatePersistedFacultyArtifacts({
    caseId: state.caseId,
    evaluation: state.evaluation as CompletedEncounterAttempt["facultyRubricEvaluation"],
    score: state.score as CompletedEncounterAttempt["facultyRubricScore"],
    report: state.report as CompletedEncounterAttempt["facultyReport"],
  });
  if (integrity.status === "valid") {
    return Response.json({ ...state, status: "complete" as const });
  }
  if (
    state.generationStatus === "IN_PROGRESS" &&
    generationStartedWithinLease(state.generationStartedAt)
  ) {
    return inProgressResponse();
  }
  if (contested) return inProgressResponse();
  return Response.json({
    ...state,
    status: state.generationStatus === "FAILED" ? "failed" as const : "pending" as const,
  });
}

function inProgressResponse() {
  return Response.json(
    {
      status: "in-progress" as const,
      stage: "evaluating" as const,
      retryAfterMs: 2_500,
    },
    { status: 202 },
  );
}

function generationStartedWithinLease(startedAt: string | null) {
  return isGenerationLeaseActive({
    status: "IN_PROGRESS",
    startedAt,
    now: Date.now(),
    leaseMs: REPORT_GENERATION_LEASE_MS,
  });
}

function getPersistedArtifacts(attempt: {
  facultyEvaluation: { data: unknown } | null;
  facultyScore: { data: unknown } | null;
  facultyReport: { data: unknown } | null;
}) {
  return {
    evaluation: attempt.facultyEvaluation?.data as CompletedEncounterAttempt["facultyRubricEvaluation"],
    score: attempt.facultyScore?.data as CompletedEncounterAttempt["facultyRubricScore"],
    report: attempt.facultyReport?.data as CompletedEncounterAttempt["facultyReport"],
  };
}

function classifyFailure(message: string) {
  if (message.includes("invalid_top_level_response")) return "model-output-parsing";
  if (message.includes("request_failed") || message.includes("timeout")) return "upstream-model";
  if (message.includes("artifact") || message.includes("score")) return "artifact-validation";
  return "report-generation";
}
