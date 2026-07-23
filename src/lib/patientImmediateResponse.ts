import type { PatientDisclosureState } from "./patientDisclosure";

const NPO_INSTRUCTION_PATTERN =
  /\b(?:npo|nothing by mouth|do not eat or drink|don'?t eat or drink|cannot have anything to eat or drink|can'?t have anything to eat or drink|no food or liquids?)\b/i;
const FASTING_HISTORY_QUESTION_PATTERN =
  /\b(?:have you (?:eaten|had anything)|when did you last (?:eat|drink)|anything by mouth)\b/i;
const CASE_3_GUM_PALPATION_PATTERN =
  /\b(?:gum|gums|gingiva|area|here|this)\b.*\b(?:press|pressure|palpat|touch|tender)\w*\b|\b(?:press|pressure|palpat|touch|tender)\w*\b.*\b(?:gum|gums|gingiva|area|here|this)\b/i;
const GENERAL_PAIN_QUESTION_PATTERN = /^(?:are you (?:in pain|hurting(?: right now)?)|does (?:your |the )?(?:tooth|mouth|jaw) hurt|is (?:your |the )?(?:tooth|mouth|jaw) hurting)(?:\s+right now)?\??$/i;
const QUESTION_PATTERN = /\?\s*$|^(?:are|can|could|did|do|does|have|has|how|is|was|were|what|when|where|which|who|why|would)\b/i;
const UNSUPPORTED_LIGHT_TRIGGER_QUESTION_PATTERN =
  /\b(?:bright\s+)?(?:sunlight|light)\b.{0,40}\b(?:pain|hurt|ache)\b|\b(?:pain|hurt|ache)\b.{0,40}\b(?:bright\s+)?(?:sunlight|light)\b/i;

export function patientImmediateResponse({
  caseId,
  message,
  disclosureState,
}: {
  caseId: string;
  message: string;
  disclosureState: PatientDisclosureState;
}): string | undefined {
  if (
    NPO_INSTRUCTION_PATTERN.test(message) &&
    !FASTING_HISTORY_QUESTION_PATTERN.test(message)
  ) {
    return "Okay, I understand.";
  }

  if (GENERAL_PAIN_QUESTION_PATTERN.test(message.trim())) {
    return "Yes, it hurts.";
  }

  if (
    caseId === "case-03" &&
    disclosureState.allowedThisTurn.some((fact) => fact.id === "c3.gum-palpation") &&
    CASE_3_GUM_PALPATION_PATTERN.test(message)
  ) {
    return "Yes, it hurts when you press there.";
  }

  if (
    (disclosureState.providerMessageIntent === "other" ||
      UNSUPPORTED_LIGHT_TRIGGER_QUESTION_PATTERN.test(message)) &&
    disclosureState.allowedThisTurn.length === 0 &&
    (disclosureState.latestTopics.length === 0 ||
      UNSUPPORTED_LIGHT_TRIGGER_QUESTION_PATTERN.test(message)) &&
    !disclosureState.asksRestrictedClinicalInterpretation &&
    QUESTION_PATTERN.test(message.trim())
  ) {
    return "I haven't noticed that.";
  }

  return undefined;
}
