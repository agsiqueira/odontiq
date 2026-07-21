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

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  const user = await requireAppUser();
  try {
    return Response.json(await reportsService.getReport(user.id, attemptId));
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
  if (attempt.generationStatus === "COMPLETE" && attempt.facultyEvaluation && attempt.facultyScore && attempt.facultyReport) {
    return Response.json(await reportsService.getReport(user.id, attemptId));
  }
  const document = isEncounterDocument(attempt.encounter.encounterData)
    ? attempt.encounter.encounterData
    : null;
  if (!document) return Response.json({ error: "invalid_encounter_document" }, { status: 422 });

  const stage = { current: "evaluation" };
  try {
    await completedAttemptRepository.persistBundle({
      userId: user.id, encounterId: attempt.encounterId, caseId: attempt.caseId,
      attemptId, generationStatus: "IN_PROGRESS", integrityStatus: "PENDING",
      passed: false, completedAt: attempt.completedAt ?? undefined,
    });
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
    await completedAttemptRepository.persistBundle({
      userId: user.id, encounterId: attempt.encounterId, caseId: attempt.caseId,
      attemptId, generationStatus: "COMPLETE", integrityStatus: "VALID",
      percentage: score.percentage ?? undefined, passed: score.passStatus === "pass",
      completedAt: attempt.completedAt ?? undefined, evaluation, score, report,
    });
    return Response.json(await reportsService.getReport(user.id, attemptId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "faculty_generation_failed";
    await completedAttemptRepository.persistBundle({
      userId: user.id, encounterId: attempt.encounterId, caseId: attempt.caseId,
      attemptId, generationStatus: "FAILED", generationError: message,
      integrityStatus: "INVALID", passed: false, completedAt: attempt.completedAt ?? undefined,
    }).catch(() => undefined);
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

function classifyFailure(message: string) {
  if (message.includes("invalid_top_level_response")) return "model-output-parsing";
  if (message.includes("request_failed") || message.includes("timeout")) return "upstream-model";
  if (message.includes("artifact") || message.includes("score")) return "artifact-validation";
  return "report-generation";
}
