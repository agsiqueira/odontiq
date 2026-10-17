import type { ProviderMessageIntent } from "./patientDisclosure";

export const CASE_1_HOSPITAL_ACKNOWLEDGEMENT =
  "Okay, I understand. I’m a little nervous about staying in the hospital.";
export const CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT = "Okay, I understand.";

const EXTRACTION_QUESTION_ID = "c1-extraction-question";
const QUESTION_PATTERN =
  /\?\s*$|^(?:are|can|could|did|do|does|have|has|how|is|was|were|what|when|where|which|who|why|would)\b/i;
const HISTORICAL_PATTERN =
  /\b(?:have you ever|did you (?:ever|previously)|used to|in the past|previously|before)\b/i;
const HYPOTHETICAL_PATTERN =
  /\b(?:if (?:we|you|they|the)|might possibly|may possibly|maybe|perhaps|possibly)\b/i;
const CURRENT_PLAN_PATTERN =
  /\b(?:i(?:'m| am) going to|we (?:need to|will|are going to|have to)|you(?:'ll| will| need to)|(?:the )?(?:oral surg(?:eon|ery)(?: team)?|omfs)(?: is|'s| will| needs? to| has to)?)\b/i;
const HOSPITAL_PLAN_PATTERN =
  /\b(?:admit(?:ted|ting)?|admission|hospitali[sz](?:e|ed|ation)|inpatient|(?:remain|stay|keep|kept)(?:ing)?\b.{0,35}\b(?:in )?(?:the )?hospital|hospital\b.{0,35}\b(?:remain|stay|keep|kept)(?:ing)?)\b/i;
const SURGICAL_EVALUATION_PATTERN =
  /\b(?:oral surg(?:eon|ery)(?: team)?|omfs)\b.{0,45}\b(?:evaluat|assess|consult|see|treat)\w*|\b(?:evaluat|assess|consult|see)\w*\b.{0,45}\b(?:oral surg(?:eon|ery)(?: team)?|omfs)\b/i;

export function case1PlanAcknowledgement({
  caseId,
  message,
  providerMessageIntent,
  emittedQuestionIds,
  priorPatientDialogue,
}: {
  caseId: string;
  message: string;
  providerMessageIntent: ProviderMessageIntent;
  emittedQuestionIds: readonly string[];
  priorPatientDialogue: readonly string[];
}): string | undefined {
  const currentMessage = message.trim();
  if (
    caseId !== "case-01" ||
    providerMessageIntent !== "disposition_plan" ||
    !emittedQuestionIds.includes(EXTRACTION_QUESTION_ID) ||
    QUESTION_PATTERN.test(currentMessage) ||
    HISTORICAL_PATTERN.test(currentMessage) ||
    HYPOTHETICAL_PATTERN.test(currentMessage) ||
    !CURRENT_PLAN_PATTERN.test(currentMessage)
  ) {
    return undefined;
  }

  const hasHospitalPlan = HOSPITAL_PLAN_PATTERN.test(currentMessage);
  const hasSurgicalEvaluationPlan =
    SURGICAL_EVALUATION_PATTERN.test(currentMessage);
  if (!hasHospitalPlan && !hasSurgicalEvaluationPlan) return undefined;

  if (
    hasHospitalPlan &&
    !priorPatientDialogue.some(
      (text) => text.trim() === CASE_1_HOSPITAL_ACKNOWLEDGEMENT,
    )
  ) {
    return CASE_1_HOSPITAL_ACKNOWLEDGEMENT;
  }

  return CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT;
}
