import { requireAppUser } from "@/lib/requireAppUser";
import {
  CompletedAttemptOwnershipError,
  type CompletedAttemptPersistenceInput,
} from "@/lib/persistence/services/completedAttemptService";
import { completedAttemptService } from "@/lib/persistence/services/completedAttempts";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const input = parsePersistenceInput(attemptId, body);
  if (!input) {
    return Response.json({ error: "invalid_completed_attempt" }, { status: 400 });
  }

  const user = await requireAppUser();
  try {
    await completedAttemptService.persistCompletion(user.id, input);
    return Response.json({
      success: true,
      attemptId,
      generationStatus: input.generationStatus,
    });
  } catch (error) {
    if (error instanceof CompletedAttemptOwnershipError) {
      return Response.json({ error: "completed_attempt_not_found" }, { status: 404 });
    }
    throw error;
  }
}

function parsePersistenceInput(
  attemptId: string,
  value: unknown,
): CompletedAttemptPersistenceInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof attemptId !== "string" ||
    !attemptId ||
    typeof input.encounterId !== "string" ||
    typeof input.caseId !== "string" ||
    !isGenerationStatus(input.generationStatus) ||
    !isIntegrityStatus(input.integrityStatus) ||
    typeof input.passed !== "boolean" ||
    (input.generationError !== undefined &&
      typeof input.generationError !== "string") ||
    (input.percentage !== undefined && typeof input.percentage !== "number") ||
    (input.completedAt !== undefined &&
      (typeof input.completedAt !== "string" ||
        !Number.isFinite(Date.parse(input.completedAt))))
  ) {
    return null;
  }
  return {
    attemptId,
    encounterId: input.encounterId,
    caseId: input.caseId,
    generationStatus: input.generationStatus,
    integrityStatus: input.integrityStatus,
    passed: input.passed,
    ...(input.generationError === undefined
      ? {}
      : { generationError: input.generationError }),
    ...(input.percentage === undefined
      ? {}
      : { percentage: input.percentage }),
    ...(input.completedAt === undefined
      ? {}
      : { completedAt: new Date(input.completedAt) }),
    ...(input.evaluation === undefined ? {} : { evaluation: input.evaluation }),
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(input.report === undefined ? {} : { report: input.report }),
  };
}

function isGenerationStatus(
  value: unknown,
): value is CompletedAttemptPersistenceInput["generationStatus"] {
  return ["PENDING", "IN_PROGRESS", "COMPLETE", "FAILED"].includes(
    value as string,
  );
}

function isIntegrityStatus(
  value: unknown,
): value is CompletedAttemptPersistenceInput["integrityStatus"] {
  return ["PENDING", "VALID", "INVALID"].includes(value as string);
}
