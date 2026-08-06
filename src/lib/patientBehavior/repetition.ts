import { classifyQuestion } from "../patientDisclosure";
import type { PatientDisclosureFact } from "../patientDisclosure";
import type { BehavioralRepetitionContext } from "./types";

const REPETITION_ELIGIBLE_INTENTS = new Set([
  "duration", "location",
]);

const SAFETY_CRITICAL_INTENTS = new Set([
  "airway_duration", "breathing", "positional_breathing", "upright_breathing",
  "swallowing", "swallowing_liquids", "drooling", "voice_change", "noisy_breathing",
  "allergies", "allergy_reaction",
]);

const AMARA_FACT_IDS_BY_INTENT: Readonly<Record<string, readonly string[]>> = {
  duration: ["c1.duration"],
  location: ["c1.location"],
};

const CONFIRMATION_PATTERN = /\b(?:did (?:i|you) (?:hear|say)|did you mean|was that|you said|just to confirm|confirm that|right\??$)\b/i;
const SPEECH_RECOGNITION_PATTERN = /\b(?:could(?:n'?t| not) hear|didn'?t hear|misheard|say that again|repeat that|speech recognition|transcription|microphone cut out|audio cut out)\b/i;

export type PersistedBehaviorIntentTurn = {
  responseText: string;
  answerClear: boolean;
  createdAt: Date | string;
};

export type AmaraRepetitionSignal = {
  intentId?: string;
  clarificationSafe: boolean;
  countsTowardHistory: boolean;
  reason: BehavioralRepetitionContext["reason"];
};

export function classifyAmaraRepetitionSignal(currentMessage: string): AmaraRepetitionSignal {
  const current = classifyQuestion(currentMessage);
  if (current.providerMessageIntent !== "question") return signal("not-a-question");
  if (SPEECH_RECOGNITION_PATTERN.test(currentMessage)) return signal("speech-recognition", true);

  const currentIntents = canonicalRepetitionIntents(current.questionIntents);
  if (currentIntents.some((intent) => SAFETY_CRITICAL_INTENTS.has(intent))) {
    return signal("safety-critical", true);
  }
  if (CONFIRMATION_PATTERN.test(currentMessage)) return signal("confirmation", true);
  if (currentIntents.length !== 1) return signal("classifier-uncertainty", true);

  const intentId = currentIntents[0];
  if (!intentId || !REPETITION_ELIGIBLE_INTENTS.has(intentId)) {
    return signal("ineligible-intent");
  }
  return {
    intentId,
    clarificationSafe: false,
    countsTowardHistory: true,
    reason: "first-ask",
  };
}

export function buildAmaraRepetitionContext({
  signal: currentSignal,
  persistedTurns,
  governedFactIds = [],
}: {
  signal: AmaraRepetitionSignal;
  persistedTurns: readonly PersistedBehaviorIntentTurn[];
  governedFactIds?: readonly string[];
}): BehavioralRepetitionContext {
  if (!currentSignal.intentId || !currentSignal.countsTowardHistory) {
    return {
      level: "none",
      clarificationSafe: currentSignal.clarificationSafe,
      countsTowardHistory: false,
      reason: currentSignal.reason,
    };
  }

  const clearTurns = persistedTurns.filter((turn) => turn.answerClear);
  const lastTurn = persistedTurns[persistedTurns.length - 1];
  const history = {
    intentId: currentSignal.intentId,
    askCount: persistedTurns.length + 1,
    clearAnswerCount: clearTurns.length,
    lastAskedAt: lastTurn ? toIsoString(lastTurn.createdAt) : undefined,
    lastAnswerText: lastTurn?.responseText,
    lastGovernedFactIds: governedFactIds,
  };
  if (persistedTurns.length === 0) {
    return { level: "none", clarificationSafe: false, countsTowardHistory: true, reason: "first-ask", history };
  }
  if (clearTurns.length === 0) {
    return { level: "none", clarificationSafe: true, countsTowardHistory: true, reason: "uncertain-prior-answer", history };
  }
  return {
    level: clearTurns.length === 1 ? "first_repeat" : "later_repeat",
    clarificationSafe: false,
    countsTowardHistory: true,
    reason: "semantic-repeat",
    history,
  };
}

export function selectAmaraRepetitionFacts(
  repetition: BehavioralRepetitionContext,
  facts: readonly PatientDisclosureFact[],
) {
  if (!repetition.history) return [];
  const relevantIds = new Set(AMARA_FACT_IDS_BY_INTENT[repetition.history.intentId] ?? []);
  return facts.filter((fact) => relevantIds.has(fact.id));
}

export function hasCompleteAmaraRepetitionFacts(
  repetition: BehavioralRepetitionContext,
  facts: readonly PatientDisclosureFact[],
) {
  if (!repetition.history) return false;
  const requiredIds = AMARA_FACT_IDS_BY_INTENT[repetition.history.intentId] ?? [];
  const presentIds = new Set(facts.map((fact) => fact.id));
  return requiredIds.length > 0 && requiredIds.every((id) => presentIds.has(id));
}

function canonicalRepetitionIntents(intents: readonly string[]) {
  const canonical = new Set(intents);
  if (canonical.size > 1) canonical.delete("pain");
  return [...canonical];
}

function signal(
  reason: BehavioralRepetitionContext["reason"],
  clarificationSafe = false,
): AmaraRepetitionSignal {
  return { clarificationSafe, countsTowardHistory: false, reason };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
