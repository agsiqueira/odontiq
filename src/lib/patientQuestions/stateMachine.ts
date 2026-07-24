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
  const id = deriveEligibleQuestionId({
    caseId: input.caseId,
    previous,
    currentEvents: input.classification.detectedEvents,
    accumulatedEvents: detectedEvents,
  });
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

  next.emittedQuestionIds.push(id);
  return { state: next, selectedQuestionId: id };
}

function deriveEligibleQuestionId(input: {
  caseId: string;
  previous: PatientQuestionState;
  currentEvents: PatientQuestionClassification["detectedEvents"];
  accumulatedEvents: PatientQuestionState["detectedEvents"];
}): PatientQuestionId | undefined {
  switch (input.caseId) {
    case "case-01":
      return input.accumulatedEvents.hospitalAdmissionOrSurgicalManagementDiscussed
        ? "c1-extraction-question"
        : undefined;
    case "case-02":
      return input.accumulatedEvents.antibioticsRecommendedAsCurrentPlan
        ? "c2-antibiotic-effect-question"
        : undefined;
    case "case-03": {
      if (
        !input.previous.emittedQuestionIds.includes("c3-follow-up-needed-question")
      ) {
        return input.accumulatedEvents.incisionAndDrainageProposed &&
          input.accumulatedEvents.patientAgreedToIncisionAndDrainage
          ? "c3-follow-up-needed-question"
          : undefined;
      }
      if (
        input.currentEvents.promptDentalFollowUpConfirmed &&
        !(
          input.currentEvents.drainageTemporaryOrNondefinitiveExplained &&
          input.currentEvents.definitiveDentalTreatmentExplained
        )
      ) {
        return "c3-follow-up-why";
      }
      return undefined;
    }
    case "case-04":
      return input.currentEvents.painManagementOrDispositionDiscussed &&
        !input.currentEvents.antibioticsRecommended &&
        !input.currentEvents.antibioticsNotIndicatedExplained
        ? "c4-antibiotic-needed-question"
        : undefined;
    case "case-05":
      return input.accumulatedEvents.patientPainDescribed
        ? "c5-antibiotic-request"
        : undefined;
    default:
      return undefined;
  }
}
