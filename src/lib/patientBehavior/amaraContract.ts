import type { BehavioralContract } from "./types";

export const AMARA_PATIENT_ID = "amara-johnson";

export const AMARA_BEHAVIORAL_CONTRACT: BehavioralContract = {
  patientId: AMARA_PATIENT_ID,
  traits: [
    "exhausted", "terse", "mildly-impatient", "less-socially-polished",
    "cooperative-with-clinically-relevant-questions", "never-abusive",
  ],
  allowedTransformations: [
    "shorten-sentences-without-removing-facts", "use-contractions",
    "reduce-politeness", "add-mild-irritation", "reduce-verbosity",
    "adjust-pauses-hesitations-and-fillers-without-changing-meaning",
  ],
  forbiddenTransformations: [
    "change-or-weaken-case-defined-facts", "invent-clinical-information",
    "invent-sleep-history-or-sleep-disruption", "add-sarcasm-or-abuse",
    "refuse-safety-critical-questions", "alter-governed-patient-questions",
    "cross-unsupported-question-boundaries",
  ],
  escalationRules: [
    "remain-cooperative-for-safety-critical-and-clinically-relevant-questions",
    "mild-impatience-must-never-become-refusal-abuse-or-sarcasm",
    "sleep-deprived-presentation-may-affect-tone-only-unless-the-case-supports-sleep-disruption",
  ],
  factualityRules: [
    "original-clinical-text-is-authoritative",
    "never-change-numbers-dates-durations-frequency-pain-score-location-polarity-severity-or-sequence",
    "never-change-medications-allergies-medical-history-or-case-defined-uncertainty",
    "never-invent-symptoms-history-timing-medications-allergies-or-sleep-claims",
    "validation-uncertainty-falls-back-to-original-text",
  ],
};
