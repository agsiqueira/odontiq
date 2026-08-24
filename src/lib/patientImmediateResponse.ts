import type { PatientDisclosureState } from "./patientDisclosure";
import { case3ConsentResponse } from "./case3ConsentResponse";
import { case1PlanAcknowledgement } from "./case1PlanAcknowledgement";

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
const SOCIAL_WELLBEING_QUESTION_PATTERN =
  /^(?:so[, ]+)?(?:how are you(?: feeling| doing)?|how do you feel|are you okay)(?:\s+(?:today|right now))?[?.!]*$/i;
const CASE_3_ALLERGY_QUESTION_PATTERN =
  /\ballerg(?:y|ies|ic)\b/i;
const CASE_3_IBUPROFEN_PATTERN =
  /\b(?:ibuprofen|advil|motrin|nsaids?)\b/i;
const CASE_3_IBUPROFEN_INTOLERANCE_QUESTION_PATTERN =
  /\b(?:allerg(?:y|ies|ic)|reaction|react|upset|stomach|ulcers?|tolerat|bother|avoid|can you take|what happens)\b/i;
const CASE_4_COLD_PATTERN = /\b(?:cold|chilly|chilled)\b/i;
const CASE_4_THERMAL_SENSITIVITY_PATTERN = /\bsensitiv(?:e|ity)\b/i;
const CASE_4_HEAT_PATTERN = /\b(?:hot|heat)\b/i;
const CASE_4_BITE_PATTERN = /\b(?:bite|biting|chew|chewing|tap|tapping|percussion|percuss)\w*\b/i;
const CASE_4_COLD_HISTORY_PATTERN = /\b(?:before|earlier|previously|used to|at first|in the past)\b/i;
const CASE_4_COLD_CHANGE_PATTERN = /\b(?:change|changed|stop|stopped|no longer|anymore)\b/i;
const CASE_4_COLD_STILL_WITH_HISTORY_PATTERN = /\bstill\b.*\b(?:before|earlier|previously|used to)\b|\b(?:before|earlier|previously|used to)\b.*\bstill\b/i;

export function patientImmediateResponse({
  caseId,
  message,
  disclosureState,
  emittedQuestionIds = [],
  priorPatientDialogue = [],
}: {
  caseId: string;
  message: string;
  disclosureState: PatientDisclosureState;
  emittedQuestionIds?: readonly string[];
  priorPatientDialogue?: readonly string[];
}): string | undefined {
  const planAcknowledgement = case1PlanAcknowledgement({
    caseId,
    message,
    providerMessageIntent: disclosureState.providerMessageIntent,
    emittedQuestionIds,
    priorPatientDialogue,
  });
  if (planAcknowledgement) return planAcknowledgement;

  const consentResponse = case3ConsentResponse(caseId, message);
  if (consentResponse) return consentResponse;

  const case4ThermalResponse = case4GovernedThermalResponse(caseId, message);
  if (case4ThermalResponse) return case4ThermalResponse;

  if (
    caseId === "case-03" &&
    isDirectCase3Question(message) &&
    CASE_3_IBUPROFEN_PATTERN.test(message) &&
    CASE_3_IBUPROFEN_INTOLERANCE_QUESTION_PATTERN.test(message)
  ) {
    return "I'm not allergic to ibuprofen, but it upsets my stomach, so I avoid it.";
  }

  if (
    caseId === "case-03" &&
    isDirectCase3Question(message) &&
    CASE_3_ALLERGY_QUESTION_PATTERN.test(message) &&
    !CASE_3_IBUPROFEN_PATTERN.test(message)
  ) {
    return "No, I have no known drug allergies, including no penicillin allergy.";
  }

  if (
    NPO_INSTRUCTION_PATTERN.test(message) &&
    !FASTING_HISTORY_QUESTION_PATTERN.test(message)
  ) {
    return "Okay, I understand.";
  }

  if (GENERAL_PAIN_QUESTION_PATTERN.test(message.trim())) {
    return "Yes, it hurts.";
  }

  if (SOCIAL_WELLBEING_QUESTION_PATTERN.test(message.trim())) {
    return caseId === "case-01"
      ? "Not great. I'm exhausted and in pain."
      : "Not great. I'm in pain.";
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

export function case4GovernedThermalResponse(
  caseId: string,
  message: string,
): string | undefined {
  if (caseId !== "case-04" || !QUESTION_PATTERN.test(message.trim())) return undefined;
  const mentionsHeat = CASE_4_HEAT_PATTERN.test(message);
  const mentionsCold = CASE_4_COLD_PATTERN.test(message)
    || (CASE_4_THERMAL_SENSITIVITY_PATTERN.test(message) && !mentionsHeat);
  if (!mentionsCold && mentionsHeat) return "I haven't noticed that.";
  if (!mentionsCold || CASE_4_BITE_PATTERN.test(message)) return undefined;

  const asksHistory = CASE_4_COLD_HISTORY_PATTERN.test(message);
  const asksChange = CASE_4_COLD_CHANGE_PATTERN.test(message)
    || CASE_4_COLD_STILL_WITH_HISTORY_PATTERN.test(message);
  if (asksChange) return "Cold hurt earlier, but it does not cause pain now.";
  if (asksHistory) return "Cold hurt the tooth earlier in the illness.";
  return "No, cold does not cause pain now.";
}

function isDirectCase3Question(message: string) {
  const trimmed = message.trim();
  return QUESTION_PATTERN.test(trimmed) || /^any\b/i.test(trimmed);
}
