import type { CompletedEncounterAttempt } from "../localEncounter";
import { validatePersistedFacultyArtifacts } from "../facultyRubric/report/artifactIntegrity";

export async function persistCompletedAttemptToServer(
  summary: CompletedEncounterAttempt,
) {
  if (!summary.serverEncounterId) return;
  const generationStatus = toGenerationStatus(
    summary.facultyReportGeneration?.status ?? "pending",
  );
  const integrity = validatePersistedFacultyArtifacts({
    caseId: summary.caseId,
    evaluation: summary.facultyRubricEvaluation,
    score: summary.facultyRubricScore,
    report: summary.facultyReport,
  });
  const hasCompleteArtifacts = integrity.status === "valid";
  const response = await fetch(
    `/api/completed-attempts/${encodeURIComponent(summary.attemptId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encounterId: summary.serverEncounterId,
        caseId: summary.caseId,
        generationStatus,
        generationError: summary.facultyReportGeneration?.error,
        integrityStatus: hasCompleteArtifacts
          ? "VALID"
          : generationStatus === "FAILED"
            ? "INVALID"
            : "PENDING",
        percentage: summary.facultyRubricScore?.percentage ?? undefined,
        passed: summary.facultyRubricScore?.passStatus === "pass",
        completedAt: summary.metadata?.completedAt,
        evaluation:
          summary.facultyRubricEvaluation?.status === "complete"
            ? summary.facultyRubricEvaluation
            : undefined,
        score: hasCompleteArtifacts ? summary.facultyRubricScore : undefined,
        report: hasCompleteArtifacts ? summary.facultyReport : undefined,
      }),
    },
  );
  if (!response.ok) throw new Error("completed_attempt_persistence_failed");
}

function toGenerationStatus(status: string) {
  if (status === "in-progress") return "IN_PROGRESS";
  if (status === "complete") return "COMPLETE";
  if (status === "failed") return "FAILED";
  return "PENDING";
}
