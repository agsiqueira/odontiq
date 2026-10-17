import { isEncounterDocument } from "@/lib/encounter/encounterDocument";
import { requireAppUser } from "@/lib/requireAppUser";
import {
  CompletedAttemptReconciliationConflictError,
  completedAttemptRepository,
} from "@/lib/persistence/repositories/completedAttemptRepository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  const correlationId = request.headers.get("x-correlation-id") ?? attemptId;
  const body: unknown = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_reconciliation" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    typeof attemptId !== "string" ||
    !attemptId ||
    typeof input.caseId !== "string" ||
    !isEncounterDocument(input.document) ||
    input.document.attemptId !== attemptId ||
    input.document.caseId !== input.caseId ||
    typeof input.completedAt !== "string" ||
    !Number.isFinite(Date.parse(input.completedAt)) ||
    (input.serverEncounterId !== undefined &&
      typeof input.serverEncounterId !== "string")
  ) {
    return Response.json({ error: "invalid_reconciliation" }, { status: 400 });
  }

  const user = await requireAppUser();
  try {
    const result = await completedAttemptRepository.reconcileLocalCompletion({
      userId: user.id,
      attemptId,
      caseId: input.caseId,
      preferredEncounterId: input.serverEncounterId as string | undefined,
      completedAt: new Date(input.completedAt),
      document: input.document,
    });
    console.info("Completed attempt reconciliation succeeded.", {
      event: result.duplicate
        ? "completed_attempt_duplicate_prevented"
        : "completed_attempt_reconciled",
      caseId: input.caseId,
      attemptId,
      correlationId,
      duplicate: result.duplicate,
    });
    return Response.json({
      success: true,
      encounterId: result.attempt.encounterId,
      duplicate: result.duplicate,
    });
  } catch (error) {
    if (error instanceof CompletedAttemptReconciliationConflictError) {
      console.warn("Completed attempt reconciliation revision conflict.", {
        event: "completed_attempt_reconciliation_conflict",
        caseId: input.caseId,
        attemptId,
        correlationId,
      });
      return Response.json({ error: "reconciliation_conflict" }, { status: 409 });
    }
    console.error("Completed attempt reconciliation failed.", {
      event: "completed_attempt_reconciliation_failed",
      caseId: input.caseId,
      attemptId,
      correlationId,
      error: error instanceof Error ? error.name : "unknown_error",
    });
    throw error;
  }
}
