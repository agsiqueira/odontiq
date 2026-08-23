import type {
  BehavioralContract,
  BehavioralPhrase,
  BehavioralPhraseCategory,
  BehavioralRenderInput,
  BehavioralStage,
  GovernedPatientId,
  OptionalPhraseSelection,
  PatientBehaviorProfile,
} from "./types";

export const PATIENT_BEHAVIOR_PROFILES: readonly PatientBehaviorProfile[] = [
  { patientId: "amara-johnson", caseId: "case-01", displayName: "Amara Johnson", stages: { 1: "Tired and trying to cooperate", 2: "Clearly exhausted; short, effortful answers", 3: "Impatient for treatment and ready to end the interview" }, optionalPhrases: [
    approvedPhrase("amara-johnson", "I'm trying to keep going.", "cooperative-effort", "Stage 1: tired and trying to cooperate", [1]),
    approvedPhrase("amara-johnson", "I'm exhausted.", "exhaustion", "Stage 2–3: clearly exhausted", [2, 3]),
    approvedPhrase("amara-johnson", "This is wearing me down.", "exhaustion", "Stage 2–3: speaking and continuing feel effortful", [2, 3]),
    approvedPhrase("amara-johnson", "I just want this taken care of.", "treatment-focus", "Stage 3: wants treatment and wants the interview to end", [3]),
  ] },
  { patientId: "marcus-lee", caseId: "case-02", displayName: "Marcus Lee", stages: { 1: "Nervous", 2: "More anxious", 3: "Visibly worried, never aggressive" }, optionalPhrases: [
    approvedPhrase("marcus-lee", "That makes me nervous.", "anxiety", "Stage 1–3: nervous to visibly worried", [1, 2, 3]),
    approvedPhrase("marcus-lee", "I'm kind of worried.", "anxiety", "Stage 1–3: nervous to visibly worried", [1, 2, 3]),
    approvedPhrase("marcus-lee", "That sounds serious.", "anxiety", "Stage 2–3: more anxious and visibly worried", [2, 3]),
    approvedPhrase("marcus-lee", "I'm worried about this.", "anxiety", "Stage 2–3: more anxious and visibly worried", [2, 3]),
  ] },
  { patientId: "elena-garcia", caseId: "case-03", displayName: "Elena Garcia", stages: { 1: "Embarrassed but cooperative", 2: "More hesitant", 3: "Emotionally strained, never rude" }, optionalPhrases: [
    approvedPhrase("elena-garcia", "It's a little embarrassing.", "hesitation", "Stage 1–3: embarrassed but cooperative", [1, 2, 3]),
    approvedPhrase("elena-garcia", "It's hard to explain.", "hesitation", "Stage 2–3: hesitant and emotionally strained", [2, 3]),
    approvedPhrase("elena-garcia", "I'm trying to explain it.", "hesitation", "Stage 1–3: cooperative despite hesitation", [1, 2, 3]),
    approvedPhrase("elena-garcia", "I'm uncomfortable talking about it.", "hesitation", "Stage 2–3: hesitant and emotionally strained", [2, 3]),
  ] },
  { patientId: "noah-patel", caseId: "case-04", displayName: "Noah Patel", stages: { 1: "Quiet", 2: "Very concise", 3: "Blunt and stoic, never impatient" }, optionalPhrases: [
    approvedPhrase("noah-patel", "That's it.", "stoic-closure", "Stage 2–3: very concise, blunt, and stoic", [2, 3]),
    approvedPhrase("noah-patel", "That's all.", "stoic-closure", "Stage 2–3: very concise, blunt, and stoic", [2, 3]),
    approvedPhrase("noah-patel", "Plain and simple.", "stoic-closure", "Stage 3: blunt and stoic", [3]),
    approvedPhrase("noah-patel", "I'm keeping it brief.", "stoic-closure", "Stage 2–3: very concise and stoic", [2, 3]),
  ] },
  { patientId: "sofia-williams", caseId: "case-05", displayName: "Sofia Williams", stages: { 1: "Cooperative", 2: "Frustrated with the condition", 3: "Clearly tired of dealing with the condition, not the clinician" }, optionalPhrases: [
    approvedPhrase("sofia-williams", "This is frustrating.", "condition-frustration", "Stage 2–3: frustration is directed at the condition", [2, 3]),
    approvedPhrase("sofia-williams", "I'm tired of dealing with this.", "condition-frustration", "Stage 3: tired of dealing with the condition", [3]),
    approvedPhrase("sofia-williams", "This is wearing on me.", "condition-frustration", "Stage 2–3: emotionally strained by the condition", [2, 3]),
    approvedPhrase("sofia-williams", "I'm frustrated with this.", "condition-frustration", "Stage 2–3: frustration is directed at the condition", [2, 3]),
  ] },
] as const;

const BY_CASE = new Map(PATIENT_BEHAVIOR_PROFILES.map((profile) => [profile.caseId, profile]));
const BY_PATIENT = new Map(PATIENT_BEHAVIOR_PROFILES.map((profile) => [profile.patientId, profile]));
const ALL_OPTIONAL_PHRASES = PATIENT_BEHAVIOR_PROFILES.flatMap((profile) => profile.optionalPhrases.map((phrase) => phrase.text));
const CASE_3_SENSITIVE_HISTORY_FACT_IDS = new Set([
  "c3.opioid-negative",
  "c3.illicit-drugs-negative",
]);
const CASE_3_EXPLANATORY_FACT_IDS = new Set([
  "c3.pain-quality",
  "c3.radiation",
  "c3.rct",
  "c3.treated-teeth-unknown",
]);
const CASE_3_SENSITIVE_PHRASES = new Set([
  "It's a little embarrassing.",
  "I'm uncomfortable talking about it.",
]);
const CASE_3_EXPLANATORY_PHRASES = new Set([
  "It's hard to explain.",
  "I'm trying to explain it.",
]);

export function selectBehavioralStage(finalizedTurnNumber: number): BehavioralStage {
  if (finalizedTurnNumber <= 4) return 1;
  if (finalizedTurnNumber <= 8) return 2;
  return 3;
}

export function behavioralStageForNextTurn(priorFinalizedTurnCount: number): BehavioralStage {
  return selectBehavioralStage(Math.max(0, priorFinalizedTurnCount) + 1);
}

export function patientBehaviorProfileForCase(caseId: string) {
  return BY_CASE.get(caseId);
}

export function behavioralContractForCase(caseId: string): BehavioralContract | undefined {
  const profile = BY_CASE.get(caseId);
  if (!profile) return undefined;
  return {
    patientId: profile.patientId,
    traits: Object.values(profile.stages),
    allowedTransformations: ["stage-specific-cadence", "contractions", "occasional-approved-personality-accent"],
    forbiddenTransformations: ["change-facts", "invent-clinical-details", "abuse", "sarcasm", "clinical-evasion"],
    escalationRules: ["stage-is-finalized-turn-count-only", "repetition-does-not-advance-stage", "personality-phrases-are-rate-limited"],
    factualityRules: ["original-response-is-authoritative", "validation-failure-uses-original-response"],
  };
}

export function renderStagedPatientCandidateResult(input: Readonly<BehavioralRenderInput>) {
  const profile = BY_PATIENT.get(input.patientId as GovernedPatientId);
  if (!profile || profile.caseId !== input.caseId || !input.stage) {
    return { text: input.originalText, selection: suppressed("stage-frequency", []) };
  }

  const baseline = baselineForStage(input);
  const selection = selectOptionalPersonalityPhrase(input, baseline, profile);
  return { text: selection.phrase ? `${baseline} ${selection.phrase}` : baseline, selection };
}

export function renderStagedPatientCandidate(input: Readonly<BehavioralRenderInput>): string {
  return renderStagedPatientCandidateResult(input).text;
}

export function selectOptionalPersonalityPhrase(
  input: Readonly<BehavioralRenderInput>,
  baselineText: string,
  profile = BY_PATIENT.get(input.patientId as GovernedPatientId),
): OptionalPhraseSelection {
  const history = recentPhraseHistory(input.recentPatientResponses ?? []);
  if (!profile || !input.stage || !input.finalizedTurnNumber) return suppressed("stage-frequency", history);
  if (input.exactTextRequired) return suppressed("exact-governed-output", history);
  if (input.repetition?.level && input.repetition.level !== "none") return suppressed("repetition-already-styled", history);
  if (!eligibleForOptionalPhrase(baselineText)) return suppressed("short-or-ineligible-answer", history);
  if (history[history.length - 1]) return suppressed("consecutive-personality-phrase", history);
  if (
    input.patientId === "elena-garcia" &&
    history.slice(-4).some(Boolean)
  ) return suppressed("rolling-five-limit", history);
  if (history.slice(-4).filter(Boolean).length >= 2) return suppressed("rolling-five-limit", history);

  const cadence = input.stage === 1 ? 4 : input.stage === 2 ? 3 : 2;
  const patientOffset = PATIENT_BEHAVIOR_PROFILES.findIndex((item) => item.patientId === profile.patientId);
  const cadenceOffset = input.stage === 2 ? 1 : patientOffset;
  if ((input.finalizedTurnNumber + cadenceOffset) % cadence !== 0) return suppressed("stage-frequency", history);

  const recentThree = new Set(history.slice(-3).filter(Boolean));
  const eligiblePhrases = profile.optionalPhrases.filter((phrase) =>
    isBehavioralPhraseEligible(phrase, input) && case3PhraseContextIsEligible(phrase, input),
  );
  if (eligiblePhrases.length === 0) return suppressed("stage-frequency", history);
  const start = stableHash(`${input.patientId}\u0000${input.stage}\u0000${input.finalizedTurnNumber}\u0000${baselineText}`) % eligiblePhrases.length;
  for (let offset = 0; offset < eligiblePhrases.length; offset += 1) {
    const phrase = eligiblePhrases[(start + offset) % eligiblePhrases.length].text;
    if (!recentThree.has(phrase)) return { phrase, suppressed: false, recentPhraseHistory: history };
  }
  return suppressed("recent-phrase-reuse", history);
}

function case3PhraseContextIsEligible(
  phrase: BehavioralPhrase,
  input: Pick<BehavioralRenderInput, "patientId" | "governedFacts">,
) {
  if (input.patientId !== "elena-garcia") return true;
  const factIds = new Set(input.governedFacts.map((fact) => fact.id));
  if (CASE_3_SENSITIVE_PHRASES.has(phrase.text)) {
    return [...CASE_3_SENSITIVE_HISTORY_FACT_IDS].some((id) => factIds.has(id));
  }
  if (CASE_3_EXPLANATORY_PHRASES.has(phrase.text)) {
    return [...CASE_3_EXPLANATORY_FACT_IDS].some((id) => factIds.has(id));
  }
  return false;
}

export function isBehavioralPhraseEligible(phrase: BehavioralPhrase, input: Pick<BehavioralRenderInput, "patientId" | "stage">) {
  return Boolean(
    input.stage &&
    phrase.presentationOnly &&
    !phrase.isQuestion &&
    !phrase.introducesFact &&
    phrase.risks.length === 0 &&
    !phrase.text.trim().endsWith("?") &&
    phrase.allowedPatients.includes(input.patientId as GovernedPatientId) &&
    phrase.allowedStages.includes(input.stage),
  );
}

function baselineForStage(input: Readonly<BehavioralRenderInput>) {
  const repeated = Boolean(input.repetition?.level && input.repetition.level !== "none");
  const concise = contract(input.originalText);
  if (input.patientId === "amara-johnson" && repeated) {
    return repeatLead(trimSocialFraming(concise), input.stage === 1 ? "Still" : "I said");
  }
  if (input.stage === 1) return input.originalText;
  return input.stage === 3 ? trimSocialFraming(concise) : concise;
}

function eligibleForOptionalPhrase(text: string) {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (words.length < 6) return false;
  if (/^(?:yes|no)\b/i.test(text) && /\b(?:breath|breathing|swallow|drool|chest pain|voice|mouth)\b/i.test(text)) return false;
  if (/\b(?:out of ten|\d+\s*\/\s*10|lower[- ](?:left|right)|upper[- ](?:left|right)|metformin|lisinopril|penicillin|allerg(?:y|ies)|medications?)\b/i.test(text)) return false;
  if (/^(?:Yes|Yeah|No)\.?(?:\s+I)?\s+(?:speak|only speak) English\b/i.test(text)) return false;
  return true;
}

function recentPhraseHistory(responses: readonly string[]) {
  return responses.slice(-5).map((response) => ALL_OPTIONAL_PHRASES.find((phrase) => response.includes(phrase)) ?? "");
}

function suppressed(reason: OptionalPhraseSelection["suppressionReason"], history: readonly string[]): OptionalPhraseSelection {
  return { suppressed: true, suppressionReason: reason, recentPhraseHistory: history };
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function approvedPhrase(
  patientId: GovernedPatientId,
  text: string,
  category: BehavioralPhraseCategory,
  contractSupport: string,
  allowedStages: readonly BehavioralStage[],
): BehavioralPhrase {
  return {
    text,
    category,
    contractSupport,
    presentationOnly: true,
    isQuestion: false,
    introducesFact: false,
    allowedPatients: [patientId],
    allowedStages,
    risks: [],
  };
}

function contract(text: string) {
  return text.replace(/\bI am\b/g, "I'm").replace(/\bI do not\b/g, "I don't").replace(/\bI cannot\b/g, "I can't").replace(/\bIt is\b/g, "It's");
}

function trimSocialFraming(text: string) {
  return text.replace(/^(?:Thank you(?: very much)?[,.!]\s*|Please,?\s+)/i, "");
}

function repeatLead(text: string, lead: "Still" | "I said") {
  return `${lead}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
