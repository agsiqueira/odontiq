import { PATIENT_QUESTION_CATALOG } from "./catalog";
import {
  EMPTY_PATIENT_QUESTION_EVENTS,
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  type PatientQuestionClassification,
  type PatientQuestionEvents,
  type PatientQuestionId,
} from "./types";

const questionIds = new Set(PATIENT_QUESTION_CATALOG.map((item) => item.id));
const eventIds = Object.keys(EMPTY_PATIENT_QUESTION_EVENTS) as Array<
  keyof PatientQuestionEvents
>;

export function parsePatientQuestionClassification(input: {
  text: string;
  caseId: string;
  studentMessageId: string;
  validMessageIds: readonly string[];
}): PatientQuestionClassification | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(input.text));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 1) return undefined;
  const allowedTopLevelFields = new Set([
    "schemaVersion",
    "caseId",
    "analyzedStudentMessageId",
    "detectedEvents",
    "eligibleQuestionId",
    "confidence",
    "evidenceMessageIds",
  ]);
  if (Object.keys(parsed).some((key) => !allowedTopLevelFields.has(key))) {
    return undefined;
  }
  if (
    parsed.caseId !== input.caseId ||
    parsed.analyzedStudentMessageId !== input.studentMessageId ||
    !isRecord(parsed.detectedEvents) ||
    typeof parsed.confidence !== "number" ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < PATIENT_QUESTION_CONFIDENCE_THRESHOLD ||
    parsed.confidence > 1 ||
    !Array.isArray(parsed.evidenceMessageIds) ||
    !parsed.evidenceMessageIds.every((id) => typeof id === "string")
  ) {
    return undefined;
  }
  const validIds = new Set(input.validMessageIds);
  if (!parsed.evidenceMessageIds.every((id) => validIds.has(id))) return undefined;

  const events = {} as PatientQuestionEvents;
  for (const eventId of eventIds) {
    if (typeof parsed.detectedEvents[eventId] !== "boolean") return undefined;
    events[eventId] = parsed.detectedEvents[eventId];
  }
  if (Object.keys(parsed.detectedEvents).some((key) => !eventIds.includes(key as keyof PatientQuestionEvents))) {
    return undefined;
  }

  const eligible = parsed.eligibleQuestionId;
  if (eligible !== null && (typeof eligible !== "string" || !questionIds.has(eligible as PatientQuestionId))) {
    return undefined;
  }
  const definition = eligible === null
    ? undefined
    : PATIENT_QUESTION_CATALOG.find((item) => item.id === eligible);
  if (definition && definition.caseId !== input.caseId) return undefined;
  if (definition && parsed.evidenceMessageIds.length === 0) return undefined;
  if (definition && !definition.semanticPrerequisites.every((event) => events[event])) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    caseId: input.caseId,
    analyzedStudentMessageId: input.studentMessageId,
    detectedEvents: events,
    eligibleQuestionId: eligible as PatientQuestionId | null,
    confidence: parsed.confidence,
    evidenceMessageIds: [...parsed.evidenceMessageIds],
  };
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
