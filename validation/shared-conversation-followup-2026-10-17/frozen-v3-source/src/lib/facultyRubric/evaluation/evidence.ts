import type {
  FacultyEvaluationEvent,
  FacultyEvaluationInput,
  FacultyEvaluationMessage,
  NormalizedFacultyEvaluationInput,
} from "./types";

const ineligibleEventTypePattern =
  /\b(mentor|system|report|feedback|evaluation|evaluator|ai-feedback)\b/i;

export function normalizeFacultyEvaluationInput(
  input: FacultyEvaluationInput,
): NormalizedFacultyEvaluationInput {
  return {
    caseId: input.caseId,
    messages: input.messages
      .filter((message) => message.id && message.content)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    events: input.events
      .filter((event) => event.id && event.type)
      .map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        metadata: event.metadata ? { ...event.metadata } : undefined,
      })),
    coveredChecklistItems: Array.from(new Set(input.coveredChecklistItems)),
  };
}

export function getEligibleLearnerMessages(
  input: FacultyEvaluationInput,
): FacultyEvaluationMessage[] {
  return normalizeFacultyEvaluationInput(input).messages.filter(
    (message) => message.role === "student",
  );
}

export function getContextualPatientMessages(
  input: FacultyEvaluationInput,
): FacultyEvaluationMessage[] {
  return normalizeFacultyEvaluationInput(input).messages.filter(
    (message) => message.role === "patient",
  );
}

export function getEligibleEncounterEvents(
  input: FacultyEvaluationInput,
): FacultyEvaluationEvent[] {
  return normalizeFacultyEvaluationInput(input).events.filter(
    (event) => !ineligibleEventTypePattern.test(event.type),
  );
}

export function isExaminationEvent(event: FacultyEvaluationEvent) {
  return /(^|[-_])(exam|examination|image)([-_]|$)|radiograph/i.test(
    event.type,
  );
}

export function isWorkflowEvent(event: FacultyEvaluationEvent) {
  return !isExaminationEvent(event);
}
