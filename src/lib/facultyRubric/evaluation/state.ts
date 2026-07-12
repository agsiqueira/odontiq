import type { ConversationMessage } from "@/lib/conversationEngine";
import type { FacultyCriterionEvaluation } from "./types";

export const FACULTY_RUBRIC_VERSION = "faculty-rubric-3b-4-v1";

export type FacultyRubricEvaluationStatus =
  | "not-started"
  | "pending"
  | "complete"
  | "partial"
  | "failed"
  | "stale";

export type FacultyRubricEvaluationState = {
  caseId: string;
  rubricVersion: string;
  transcriptRevision: string;
  status: FacultyRubricEvaluationStatus;
  evaluations: FacultyCriterionEvaluation[];
  evaluatedAt?: string;
  lastAttemptedAt?: string;
  error?: string;
};

export type FacultyRubricEncounterEventInput = {
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
};

export type FacultyRubricEncounterEvaluationInput = {
  caseId: string;
  conversationHistory: ConversationMessage[];
  encounterEvents: FacultyRubricEncounterEventInput[];
  coveredChecklistItems: string[];
};

export function createFacultyRubricTranscriptRevision({
  conversationHistory,
  encounterEvents,
  coveredChecklistItems,
}: Omit<FacultyRubricEncounterEvaluationInput, "caseId">) {
  return `rev-${stableHash(
    stableStringify({
      messages: conversationHistory.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
      })),
      events: encounterEvents.map((event, index) => ({
        event,
        index,
      }))
        .filter(({ event }) => isEvaluationRelevantEvent(event))
        .map(({ event, index }) => ({
          id: createEvaluationEventId(event, index),
          type: event.type,
          payload: event.payload ?? {},
        })),
      coveredChecklistItems: [...coveredChecklistItems].sort(),
    }),
  )}`;
}

function isEvaluationRelevantEvent(event: FacultyRubricEncounterEventInput) {
  return !/(mentor|system|report|feedback|evaluation|evaluator|ai[-_]?feedback)/i.test(
    event.type,
  );
}

export function isFacultyRubricEvaluationStateStale(
  state: FacultyRubricEvaluationState | undefined,
  transcriptRevision: string,
  rubricVersion = FACULTY_RUBRIC_VERSION,
) {
  return Boolean(
    state &&
      (state.rubricVersion !== rubricVersion ||
        state.transcriptRevision !== transcriptRevision),
  );
}

export function createEvaluationEventId(
  event: FacultyRubricEncounterEventInput,
  index: number,
) {
  const explicitId = event.payload?.eventId;

  return typeof explicitId === "string" && explicitId
    ? explicitId
    : `${event.type}-${index + 1}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
