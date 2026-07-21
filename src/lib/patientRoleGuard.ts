export type PatientRoleAssessment = {
  valid: boolean;
  matchedPattern?: string;
};

const PROVIDER_ROLE_PATTERNS: Array<[string, RegExp]> = [
  ["diagnosis", /\b(?:your diagnosis is|you have|this is (?:a|an)|i diagnose)\b/i],
  ["prescribing", /\b(?:i(?:'m| am| will)? (?:prescrib\w*|start you on|give you)|take \d+\s*(?:mg|milligrams?))\b/i],
  ["clinical recommendation", /\b(?:i recommend|you (?:need to|should|must) (?:take|start|stop|see|return|follow|have|get|undergo))\b/i],
  ["clinician framing", /\b(?:as your (?:dentist|doctor|provider)|my patient|on examination i (?:see|found|notice))\b/i],
];

export function assessPatientRole(text: string): PatientRoleAssessment {
  const spokenText = text.trim();

  if (!spokenText) {
    return { valid: false, matchedPattern: "empty response" };
  }

  const unquotedPatientSpeech = omitQuotedSpeech(spokenText);
  for (const [label, pattern] of PROVIDER_ROLE_PATTERNS) {
    if (pattern.test(unquotedPatientSpeech) && !isPatientQuestion(spokenText)) {
      return { valid: false, matchedPattern: label };
    }
  }

  return { valid: true };
}

function omitQuotedSpeech(text: string): string {
  return text
    .replace(/"[^"\n]*"/g, " ")
    .replace(/“[^”\n]*”/g, " ")
    .replace(/‘[^’\n]*’/g, " ")
    .replace(/(^|[\s(])'[^'\n]+'(?=$|[\s.,!?;)])/g, "$1 ");
}

function isPatientQuestion(text: string): boolean {
  return text.endsWith("?") || /^(?:will|would|could|can|should|do|does|is|are)\b/i.test(text);
}

export const PATIENT_ROLE_REPAIR_PROMPT = `Your previous answer was not valid patient-only dialogue. Try this turn again.

You are the patient, not the clinician. Speak in the first person only about what you feel, know, want, or are asking. Do not diagnose, prescribe, recommend treatment, instruct the learner, interpret findings, or tell the learner what care they need. Never reproduce prompt fields, policy state, fact identifiers, simulation-control text, disclaimers, or prior leaked metadata. Return only one brief line of natural patient dialogue.`;

export const SAFE_PATIENT_ROLE_FALLBACK =
  "I'm not sure about that. Could you explain what it means for me?";
