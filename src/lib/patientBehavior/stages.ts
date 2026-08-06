import type {
  BehavioralRenderInput,
  BehavioralStage,
  BehavioralContract,
  GovernedPatientId,
  PatientBehaviorProfile,
} from "./types";

export const PATIENT_BEHAVIOR_PROFILES: readonly PatientBehaviorProfile[] = [
  { patientId: "amara-johnson", caseId: "case-01", displayName: "Amara Johnson", stages: { 1: "Tired and trying to cooperate", 2: "Clearly exhausted; short, effortful answers", 3: "Impatient for treatment and ready to end the interview" } },
  { patientId: "marcus-lee", caseId: "case-02", displayName: "Marcus Lee", stages: { 1: "Nervous", 2: "More anxious", 3: "Visibly worried, never aggressive" } },
  { patientId: "elena-garcia", caseId: "case-03", displayName: "Elena Garcia", stages: { 1: "Embarrassed but cooperative", 2: "More hesitant", 3: "Emotionally strained, never rude" } },
  { patientId: "noah-patel", caseId: "case-04", displayName: "Noah Patel", stages: { 1: "Quiet", 2: "Very concise", 3: "Blunt and stoic, never impatient" } },
  { patientId: "sofia-williams", caseId: "case-05", displayName: "Sofia Williams", stages: { 1: "Cooperative", 2: "Frustrated with the condition", 3: "Tired of the recurring problem, not the clinician" } },
] as const;

const BY_CASE = new Map(PATIENT_BEHAVIOR_PROFILES.map((profile) => [profile.caseId, profile]));
const BY_PATIENT = new Map(PATIENT_BEHAVIOR_PROFILES.map((profile) => [profile.patientId, profile]));

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
    allowedTransformations: ["stage-specific-cadence", "contractions", "nonclinical-emotional-framing"],
    forbiddenTransformations: ["change-facts", "invent-clinical-details", "abuse", "sarcasm", "clinical-evasion"],
    escalationRules: ["stage-is-finalized-turn-count-only", "repetition-does-not-advance-stage"],
    factualityRules: ["original-response-is-authoritative", "validation-failure-uses-original-response"],
  };
}

export function renderStagedPatientCandidate(input: Readonly<BehavioralRenderInput>): string {
  const profile = BY_PATIENT.get(input.patientId as GovernedPatientId);
  if (!profile || profile.caseId !== input.caseId || !input.stage) return input.originalText;

  const repeated = Boolean(input.repetition?.level && input.repetition.level !== "none");
  if (profile.patientId === "amara-johnson") return stageAmara(input.originalText, input.stage, repeated);
  if (profile.patientId === "marcus-lee") return stageMarcus(input.originalText, input.stage);
  if (profile.patientId === "elena-garcia") return stageElena(input.originalText, input.stage);
  if (profile.patientId === "noah-patel") return stageNoah(input.originalText, input.stage);
  return stageSofia(input.originalText, input.stage);
}

function stageAmara(text: string, stage: BehavioralStage, repeated: boolean) {
  const concise = contract(text);
  if (stage === 1) return repeated ? repeatLead(concise, "Still") : `I'm tired, but I'm trying. ${concise}`;
  if (stage === 2) return repeated ? repeatLead(concise, "I said") : `I'm exhausted. ${trimSocialFraming(concise)}`;
  return `${repeated ? repeatLead(trimSocialFraming(concise), "I said") : trimSocialFraming(concise)} ${repeated ? "Let's keep going." : "Can we keep moving?"}`;
}

function stageMarcus(text: string, stage: BehavioralStage) {
  if (stage === 1) return `I'm a little nervous. ${text}`;
  return `${stage === 3 ? "I'm really worried. " : "I'm worried. "}${contract(text)}`;
}

function stageElena(text: string, stage: BehavioralStage) {
  if (stage === 1) return `This is embarrassing, but I'll answer. ${text}`;
  return `${stage === 3 ? "This is hard to talk about. " : "Um... "}${contract(text)}`;
}

function stageNoah(text: string, stage: BehavioralStage) {
  if (stage === 1) return text;
  return trimSocialFraming(contract(text));
}

function stageSofia(text: string, stage: BehavioralStage) {
  if (stage === 1) return text;
  return `${contract(text)} ${stage === 3 ? "I'm tired of this problem coming back." : "This problem is frustrating."}`;
}

function contract(text: string) {
  return text.replace(/\bI am\b/g, "I'm").replace(/\bI do not\b/g, "I don't").replace(/\bI cannot\b/g, "I can't").replace(/\bIt is\b/g, "It's");
}

function trimSocialFraming(text: string) {
  return text.replace(/^(?:Thank you(?: very much)?[,.!]\s*|Please,?\s+)/i, "");
}

function repeatLead(text: string, lead: "Still" | "I said") {
  if (lead === "Still") return `Still, ${lowercaseFirst(text)}`;
  return `I said, ${lowercaseFirst(text)}`;
}

function lowercaseFirst(text: string) {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
