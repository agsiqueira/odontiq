import { assessClinicalPlanWitness } from "./clinicalPlan";
import { currentCase3Explanations } from "./explanationScope";
import { type PatientDisclosureFact } from "../patientDisclosure";
import { isPatientConversationClosure } from "../patientConversationClosure";
import { expressesRequiredFact } from "../patientOutputGuard";
import type { ConversationMessage } from "../conversationEngine";
import { PATIENT_QUESTION_CATALOG } from "./catalog";
import type { PatientQuestionClassification } from "./types";

/** Semantic classification is necessary, never sufficient: enforce scope and sourced evidence.
 * This veto does not grant permission based on words or turn count. The catalog/state machine
 * still require affirmative semantic events and enforce once-only emission transactionally.
 */
export function constrainQuestionClassification(input: {
  classification: PatientQuestionClassification;
  studentMessage: string;
  patientResponse: string;
  conversation: readonly ConversationMessage[];
  facts: readonly PatientDisclosureFact[];
}): PatientQuestionClassification {
  const result = { ...input.classification, detectedEvents: { ...input.classification.detectedEvents } };
  if (isPatientConversationClosure(input.studentMessage)) {
    for (const event of Object.keys(result.detectedEvents)) result.detectedEvents[event as keyof typeof result.detectedEvents] = false;
    return result;
  }
  if (result.caseId === "case-03") {
    // Follow-up confirmation and the reasons that suppress Why are current-turn
    // provider events. A prior proposal, patient reply or appointment cannot be
    // borrowed as an explanation. Keep the independently supported confirmation.
    const currentProviderEvidence = result.evidenceMessageIds.includes(result.analyzedStudentMessageId)
      && result.evidenceAliases.includes("student-current");
    const explanations = currentCase3Explanations(input.studentMessage);
    if (result.detectedEvents.promptDentalFollowUpConfirmed && !currentProviderEvidence)
      result.detectedEvents.promptDentalFollowUpConfirmed = false;
    if (result.detectedEvents.drainageTemporaryOrNondefinitiveExplained && (!currentProviderEvidence || !explanations.temporary))
      result.detectedEvents.drainageTemporaryOrNondefinitiveExplained = false;
    if (result.detectedEvents.definitiveDentalTreatmentExplained && (!currentProviderEvidence || !explanations.definitive))
      result.detectedEvents.definitiveDentalTreatmentExplained = false;
  }
  // Case 4's prerequisite is a provider act, not a topic. Preserve the model's
  // explicit act and verbatim current-message witness through final assembly.
  if (result.caseId === "case-04" && (result.currentProviderAct !== "current_plan"
    || !assessClinicalPlanWitness(input.studentMessage, result.currentPlanEvidence).valid)) {
    result.detectedEvents.painManagementOrDispositionDiscussed = false;
  }
  // A substantive current-pain description must express an actual sourced attribute,
  // not a county, preference, general pain mention or the antibiotic question itself.
  if (result.caseId === "case-05") {
    const painFacts = input.facts.filter(f => /^c5\.(?:location|duration|constant|quality|severity|spontaneous|nocturnal|cold|lingering|chewing|biting)$/.test(f.id));
    const patientTexts = [...input.conversation.filter(m => m.role === "patient").map(m => m.text), input.patientResponse];
    const substantive = patientTexts.some(text => {
      const answer = text.split(/(?<=[.!?])\s+/).filter(s => !s.includes("?")).join(" ");
      return painFacts.some(fact => expressesRequiredFact(answer, fact));
    });
    if (!substantive) result.detectedEvents.patientPainDescribed = false;
  }
  return result;
}

/** The base answer never grants itself permission to ask. Only final state assembly adds questions. */
export function patientAnswerWithoutQuestions(text: string): string {
  let answer = text;
  for (const question of PATIENT_QUESTION_CATALOG) answer = answer.replaceAll(question.text, "");
  return answer.split(/(?<=[.!?])\s+/).filter(sentence => !sentence.includes("?")).join(" ").trim();
}
