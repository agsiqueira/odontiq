import { getPatientQuestion, patientQuestionsForCase } from "./catalog";
import {
  createEmptyPatientQuestionState,
  type PatientQuestionClassification,
  type PatientQuestionId,
  type PatientQuestionState,
} from "./types";

export function shouldClassifyPatientQuestions(
  caseId: string,
  state: PatientQuestionState,
) {
  return patientQuestionsForCase(caseId).some(
    (question) => !state.emittedQuestionIds.includes(question.id),
  );
}

export function applyPatientQuestionClassification(input: {
  caseId: string;
  state?: PatientQuestionState;
  classification: PatientQuestionClassification;
}): { state: PatientQuestionState; selectedQuestionId?: PatientQuestionId } {
  const previous = input.state ?? createEmptyPatientQuestionState();
  if (input.classification.caseId !== input.caseId) return { state: previous };

  const detectedEvents = { ...previous.detectedEvents };
  for (const [event, detected] of Object.entries(input.classification.detectedEvents)) {
    if (detected) detectedEvents[event as keyof typeof detectedEvents] = true;
  }
  const next: PatientQuestionState = {
    ...previous,
    version: previous.version + 1,
    detectedEvents,
    emittedQuestionIds: [...previous.emittedQuestionIds],
  };
  const id = input.classification.eligibleQuestionId;
  if (!id || next.emittedQuestionIds.includes(id)) return { state: next };
  const definition = getPatientQuestion(id);
  if (!definition || definition.caseId !== input.caseId) return { state: next };
  if (!definition.semanticPrerequisites.every((event) => detectedEvents[event])) {
    return { state: next };
  }
  if (
    !definition.deterministicPrerequisiteQuestionIds.every((required) =>
      next.emittedQuestionIds.includes(required),
    )
  ) {
    return { state: next };
  }

  if (
    id === "c3-follow-up-why" &&
    (detectedEvents.drainageTemporaryOrNondefinitiveExplained ||
      detectedEvents.definitiveDentalTreatmentExplained)
  ) {
    // Both explanation components must be assessed on the current answer, not
    // accumulated from unrelated earlier turns.
    const current = input.classification.detectedEvents;
    if (
      current.drainageTemporaryOrNondefinitiveExplained &&
      current.definitiveDentalTreatmentExplained
    ) {
      return { state: next };
    }
  }
  if (
    id === "c4-antibiotic-needed-question" &&
    (input.classification.detectedEvents.antibioticsRecommended ||
      input.classification.detectedEvents.antibioticsNotIndicatedExplained)
  ) {
    return { state: next };
  }

  next.emittedQuestionIds.push(id);
  return { state: next, selectedQuestionId: id };
}
