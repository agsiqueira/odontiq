export type BehavioralElementClass = "immutable" | "mutable";

export type BehavioralContract = {
  patientId: string;
  traits: readonly string[];
  allowedTransformations: readonly string[];
  forbiddenTransformations: readonly string[];
  escalationRules: readonly string[];
  factualityRules: readonly string[];
};

export const IMMUTABLE_RESPONSE_ELEMENTS = [
  "numbers", "dates", "durations", "frequencies", "pain-scores",
  "symptom-polarity", "symptom-location", "symptom-severity",
  "medications-and-usage", "allergies-and-allergy-status", "medical-history",
  "triggering-events", "timing-and-sequence", "case-defined-uncertainty",
  "rubric-relevant-disclosures", "governed-patient-question-wording",
  "unsupported-question-boundaries",
] as const;

export const MUTABLE_RESPONSE_ELEMENTS = [
  "sentence-length", "contractions", "conversational-framing", "politeness",
  "mild-irritation", "pauses", "hesitations", "filler-words",
  "meaning-preserving-clause-order", "verbosity", "emotional-tone",
] as const;

export type GovernedFactSource =
  | "case-definition"
  | "disclosure-state"
  | "patient-question-catalog"
  | "unsupported-response-boundary";

export type GovernedFact = {
  id: string;
  canonicalValue: string;
  source: GovernedFactSource;
  exactValues?: readonly string[];
  requiredTerms?: readonly string[];
  exactTextRequired?: boolean;
  polarity?: "positive" | "negative";
  certain?: boolean;
  rubricRelevant: boolean;
};

export type BehavioralViolationCode =
  | "numeric-value-changed"
  | "required-value-removed"
  | "date-or-duration-changed"
  | "pain-score-changed"
  | "symptom-polarity-changed"
  | "location-changed"
  | "medication-or-allergy-changed"
  | "certainty-weakened"
  | "rubric-disclosure-removed"
  | "exact-text-changed"
  | "unsupported-addition";

export type BehavioralViolation = {
  code: BehavioralViolationCode;
  factId?: string;
  message: string;
};

export type BehavioralRenderInput = {
  patientId: string;
  caseId: string;
  originalText: string;
  governedFacts: readonly GovernedFact[];
  contract: BehavioralContract;
};

export type BehavioralRenderResult = {
  text: string;
  preservedFactIds: string[];
  valid: boolean;
  violations: BehavioralViolation[];
  usedFallback: boolean;
};
