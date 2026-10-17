import { buildEncounterDocument } from "../encounter/encounterDocumentBuilder";
import type { CompletedEncounterAttempt } from "../localEncounter";
import {
  readCompletedEncounterAttempt,
  writeCompletedEncounterAttempt,
} from "../localEncounter";
import { validatePersistedFacultyArtifacts } from "../facultyRubric/report/artifactIntegrity";

const inFlight = new Map<string, Promise<CompletedEncounterAttempt>>();

export function persistCompletedAttemptToServer(
  summary: CompletedEncounterAttempt,
) {
  const active = inFlight.get(summary.attemptId);
  if (active) {
    console.info("Duplicate completed-attempt submission was coalesced.", {
      event: "completed_attempt_duplicate_submission_prevented",
      caseId: summary.caseId,
      attemptId: summary.attemptId,
      correlationId: summary.attemptId,
    });
    return active;
  }

  const operation = reconcile(summary);
  inFlight.set(summary.attemptId, operation);
  const clearOperation = () => {
    if (inFlight.get(summary.attemptId) === operation) {
      inFlight.delete(summary.attemptId);
    }
  };
  void operation.then(clearOperation, clearOperation);
  return operation;
}

async function reconcile(
  inputSummary: CompletedEncounterAttempt,
): Promise<CompletedEncounterAttempt> {
  const startedAt = new Date().toISOString();
  const pendingSummary = updateLatest(inputSummary, {
    persistence: {
      status: "pending-sync",
      attempts: inputSummary.persistence.attempts + 1,
      updatedAt: startedAt,
    },
  });
  console.info("Pending completed attempt synchronization started.", {
    event: "completed_attempt_pending_sync",
    caseId: pendingSummary.caseId,
    attemptId: pendingSummary.attemptId,
    correlationId: pendingSummary.attemptId,
    syncAttempt: pendingSummary.persistence.attempts,
  });

  try {
    const document = buildEncounterDocument({
      serverEncounterId: pendingSummary.serverEncounterId,
      caseId: pendingSummary.caseId,
      attemptId: pendingSummary.attemptId,
      encounterVersion: pendingSummary.serverEncounterRevision ?? 1,
      messages: pendingSummary.conversationHistory,
      examinationIds: pendingSummary.examinationsViewed,
      lifecycleEvents: pendingSummary.encounterEvents,
      disclosedFacts: pendingSummary.coveredFacts,
      coveredChecklistItemIds: pendingSummary.coveredChecklistItems,
      coverageEvidence: pendingSummary.coverageEvidence,
      activeDurationMs: pendingSummary.activeDurationMs,
      pausedDurationMs: pendingSummary.pausedDurationMs,
      startedAt: pendingSummary.metadata?.createdAt,
      completedAt: pendingSummary.metadata?.completedAt,
      createdAt: pendingSummary.metadata?.createdAt ?? pendingSummary.savedAt,
      updatedAt: pendingSummary.metadata?.updatedAt ?? pendingSummary.savedAt,
    });
    const reconcileResponse = await fetch(
      `/api/completed-attempts/${encodeURIComponent(pendingSummary.attemptId)}/reconcile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": pendingSummary.attemptId,
        },
        body: JSON.stringify({
          caseId: pendingSummary.caseId,
          serverEncounterId: pendingSummary.serverEncounterId,
          completedAt: pendingSummary.metadata?.completedAt ?? pendingSummary.savedAt,
          document,
        }),
      },
    );
    if (reconcileResponse.status === 409) {
      throw new ReconciliationConflictError();
    }
    const reconciliation: unknown = await reconcileResponse
      .json()
      .catch(() => undefined);
    if (!reconcileResponse.ok || !isReconciliationResponse(reconciliation)) {
      throw new Error("completed_attempt_reconciliation_failed");
    }

    const reconciledSummary = updateLatest(pendingSummary, {
      serverEncounterId: reconciliation.encounterId,
    });
    await persistArtifacts(reconciledSummary);
    const synced = updateLatest(reconciledSummary, {
      persistence: {
        status: "synced",
        attempts: reconciledSummary.persistence.attempts,
        updatedAt: new Date().toISOString(),
      },
    });
    console.info("Completed attempt synchronization succeeded.", {
      event: "completed_attempt_sync_succeeded",
      caseId: synced.caseId,
      attemptId: synced.attemptId,
      correlationId: synced.attemptId,
      duplicate: reconciliation.duplicate,
    });
    return synced;
  } catch (error) {
    const conflict = error instanceof ReconciliationConflictError;
    const failed = updateLatest(pendingSummary, {
      persistence: {
        status: conflict ? "conflict" : "pending-sync",
        attempts: pendingSummary.persistence.attempts,
        updatedAt: new Date().toISOString(),
        lastError: conflict ? "revision_conflict" : "sync_unavailable",
      },
    });
    console.warn("Completed attempt synchronization did not complete.", {
      event: conflict
        ? "completed_attempt_sync_conflict"
        : "completed_attempt_sync_failed",
      caseId: failed.caseId,
      attemptId: failed.attemptId,
      correlationId: failed.attemptId,
      syncAttempt: failed.persistence.attempts,
    });
    throw error;
  }
}

async function persistArtifacts(summary: CompletedEncounterAttempt) {
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
        percentage: summary.facultyRubricScore?.percentage,
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

function updateLatest(
  fallback: CompletedEncounterAttempt,
  patch: Partial<CompletedEncounterAttempt>,
) {
  const latest =
    readCompletedEncounterAttempt(fallback.caseId, fallback.attemptId) ?? fallback;
  const updated = { ...latest, ...patch };
  writeCompletedEncounterAttempt(updated);
  return updated;
}

function isReconciliationResponse(
  value: unknown,
): value is { success: true; encounterId: string; duplicate: boolean } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { success?: unknown }).success === true &&
      typeof (value as { encounterId?: unknown }).encounterId === "string" &&
      typeof (value as { duplicate?: unknown }).duplicate === "boolean",
  );
}

function toGenerationStatus(status: string) {
  if (status === "in-progress") return "IN_PROGRESS";
  if (status === "complete") return "COMPLETE";
  if (status === "failed") return "FAILED";
  return "PENDING";
}

class ReconciliationConflictError extends Error {}
