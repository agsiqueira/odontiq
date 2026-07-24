import {
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  type PatientQuestionClassificationResult,
  type PatientQuestionEventId,
  type PatientQuestionEvents,
} from "./types";
import type { PatientQuestionEvidenceAlias } from "./prompt";

export function parsePatientQuestionClassification(input: {
  text: string;
  caseId: string;
  studentMessageId: string;
  allowedEvents: readonly PatientQuestionEventId[];
  evidenceAliases: readonly PatientQuestionEvidenceAlias[];
}): PatientQuestionClassificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(input.text));
  } catch {
    return failure("invalid-json", input.text);
  }
  if (!isRecord(parsed)) return failure("invalid-json", input.text);

  const safeMetadata = getSafeMetadata(parsed, input.text);
  const allowedTopLevelFields = new Set([
    "schemaVersion",
    "caseId",
    "events",
    "confidence",
    "evidence",
  ]);
  if (
    parsed.schemaVersion !== 1 ||
    Object.keys(parsed).some((key) => !allowedTopLevelFields.has(key))
  ) {
    return { success: false, reason: "unknown-field", safeMetadata };
  }
  if (parsed.caseId !== input.caseId) {
    return { success: false, reason: "case-mismatch", safeMetadata };
  }
  if (!isRecord(parsed.events)) {
    return { success: false, reason: "invalid-event-shape", safeMetadata };
  }
  const parsedEvents = parsed.events;

  const allowedEvents = new Set(input.allowedEvents);
  const suppliedEventNames = Object.keys(parsedEvents);
  if (suppliedEventNames.some((event) => !allowedEvents.has(event as PatientQuestionEventId))) {
    return { success: false, reason: "wrong-case-event", safeMetadata };
  }
  if (
    input.allowedEvents.some((event) => typeof parsedEvents[event] !== "boolean") ||
    suppliedEventNames.length !== input.allowedEvents.length
  ) {
    return { success: false, reason: "invalid-event-shape", safeMetadata };
  }
  if (
    typeof parsed.confidence !== "number" ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1
  ) {
    return { success: false, reason: "invalid-confidence", safeMetadata };
  }
  if (parsed.confidence < PATIENT_QUESTION_CONFIDENCE_THRESHOLD) {
    return { success: false, reason: "low-confidence", safeMetadata };
  }
  if (
    !Array.isArray(parsed.evidence) ||
    !parsed.evidence.every((alias) => typeof alias === "string")
  ) {
    return { success: false, reason: "invalid-evidence-alias", safeMetadata };
  }

  const aliasesByName = new Map(
    input.evidenceAliases.map((entry) => [entry.alias, entry]),
  );
  if (parsed.evidence.some((alias) => !aliasesByName.has(alias))) {
    return {
      success: false,
      reason: "invalid-evidence-alias",
      safeMetadata: { ...safeMetadata, evidenceAliasesValid: false },
    };
  }
  const assertedEventNames = suppliedEventNames.filter(
    (event) => parsedEvents[event] === true,
  );
  if (assertedEventNames.length > 0 && parsed.evidence.length === 0) {
    return { success: false, reason: "missing-evidence", safeMetadata };
  }

  const detectedEvents: Partial<PatientQuestionEvents> = {};
  for (const event of input.allowedEvents) {
    detectedEvents[event] = parsedEvents[event] as boolean;
  }
  return {
    success: true,
    classification: {
      schemaVersion: 1,
      caseId: input.caseId,
      analyzedStudentMessageId: input.studentMessageId,
      detectedEvents,
      confidence: parsed.confidence,
      evidenceAliases: [...parsed.evidence],
      evidenceMessageIds: parsed.evidence.map(
        (alias) => aliasesByName.get(alias)!.messageId,
      ),
    },
  };
}

function failure(
  reason: "invalid-json",
  text: string,
): PatientQuestionClassificationResult {
  return {
    success: false,
    reason,
    safeMetadata: { rawOutputLength: text.length },
  };
}

function getSafeMetadata(
  parsed: Record<string, unknown>,
  text: string,
) {
  const events = isRecord(parsed.events) ? parsed.events : {};
  return {
    ...(typeof parsed.confidence === "number"
      ? { confidence: parsed.confidence }
      : {}),
    assertedEventNames: Object.keys(events).filter(
      (event) => events[event] === true,
    ),
    evidenceAliases: Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((alias): alias is string => typeof alias === "string")
      : [],
    evidenceAliasesValid: undefined,
    rawOutputLength: text.length,
  };
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
