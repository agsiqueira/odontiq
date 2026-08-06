import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AMARA_BEHAVIORAL_CONTRACT,
  AMARA_PATIENT_ID,
  attachGovernedFacts,
  buildAmaraRepetitionContext,
  buildAmaraRepetitionFixtures,
  classifyAmaraRepetitionSignal,
  hasCompleteAmaraRepetitionFacts,
  renderPatientBehavior,
  selectAmaraRepetitionFacts,
  type GovernedFact,
  type PersistedBehaviorIntentTurn,
} from "../src/lib/patientBehavior";
import { buildPatientAudioPlan } from "../src/lib/patientAudioPlan";

let assertions = 0;
const equal = (actual: unknown, expected: unknown, message: string) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };

const durationSignal = classifyAmaraRepetitionSignal("How long has the pain hurt?");
equal(durationSignal.intentId, "duration", "duration uses canonical intent");
check(durationSignal.countsTowardHistory, "eligible first ask is persisted");
const first = context(durationSignal, []);
equal(first.level, "none", "first ask uses Phase 2");
equal(first.reason, "first-ask", "first ask reason is explicit");

const clearDuration = persisted("Four days. The pain has been worsening.", true, "2026-08-06T00:00:01.000Z");
const firstRepeat = context(classifyAmaraRepetitionSignal("How many days has this been going on?"), [clearDuration]);
equal(firstRepeat.level, "first_repeat", "semantic duration variant is first repeat");
equal(firstRepeat.history?.clearAnswerCount, 1, "one clear prior answer is recorded");
equal(firstRepeat.history?.askCount, 2, "ask count includes current ask");

const secondClear = persisted("Four days. It's been worsening.", true, "2026-08-06T00:00:03.000Z");
const laterRepeat = context(classifyAmaraRepetitionSignal("When did the pain start?"), [clearDuration, secondClear]);
equal(laterRepeat.level, "later_repeat", "third equivalent ask is later repeat");
equal(laterRepeat.history?.lastAskedAt, "2026-08-06T00:00:03.000Z", "persisted last ask time is retained");

const refreshed = context(classifyAmaraRepetitionSignal("When did the pain start?"), [clearDuration, secondClear]);
equal(refreshed, laterRepeat, "refresh reconstruction from server history is stable");
const wordingVariant = context(classifyAmaraRepetitionSignal("When did the pain start?"), [
  persisted("The provider phrased the answer differently.", true, "2026-08-06T00:00:01.000Z"),
  persisted("Another rendering variant.", true, "2026-08-06T00:00:03.000Z"),
]);
equal(wordingVariant.level, "later_repeat", "provider wording cannot change escalation");

const unclear = context(durationSignal, [persisted("Response was incomplete.", false, "2026-08-06T00:00:01.000Z")]);
equal(unclear.level, "none", "unclear prior answer permits clarification");
equal(unclear.reason, "uncertain-prior-answer", "unclear-answer reason is explicit");
check(unclear.clarificationSafe, "unclear prior answer is clarification-safe");

for (const question of ["Did you say four days?", "Just to confirm, was that four days?"]) {
  const signal = classifyAmaraRepetitionSignal(question);
  equal(signal.reason, "confirmation", `${question} is confirmation-safe`);
  check(!signal.countsTowardHistory, `${question} does not increment history`);
}
for (const question of ["Could you repeat that? I couldn't hear how long.", "The microphone cut out—say that again?"]) {
  const signal = classifyAmaraRepetitionSignal(question);
  equal(signal.reason, "speech-recognition", `${question} is speech-recognition-safe`);
  check(signal.clarificationSafe, `${question} does not escalate`);
}
for (const question of ["Are you still short of breath?", "Can you swallow now?", "Is breathing worse lying flat?", "Do you have drug allergies?"]) {
  const signal = classifyAmaraRepetitionSignal(question);
  equal(signal.reason, "safety-critical", `${question} is safety-critical`);
  check(!signal.countsTowardHistory, `${question} never increments impatience`);
}

const compound = classifyAmaraRepetitionSignal("How long has it hurt and how bad is it?");
equal(compound.reason, "classifier-uncertainty", "compound missing-subpart question fails closed");
check(compound.clarificationSafe, "compound question is clarification-safe");

for (const [label, question, expected] of [
  ["location", "Which tooth hurts?", "location"],
] as const) {
  equal(classifyAmaraRepetitionSignal(question).intentId, expected, `${label} is repetition-sensitive`);
}
for (const [label, question] of [
  ["swelling", "Is the swelling getting worse?"],
  ["fever", "Have you had a fever?"],
  ["onset certainty", "Do you know exactly when it began?"],
  ["progression", "Has the pain been getting worse?"],
  ["radiation", "Does the pain travel toward your ear?"],
  ["pain score", "What is the pain score out of ten?"],
  ["medications", "What medications do you take?"],
] as const) {
  check(!classifyAmaraRepetitionSignal(question).countsTowardHistory, `${label} is not repetition-sensitive`);
}

const repetitionFixtures = buildAmaraRepetitionFixtures();
equal(repetitionFixtures[0]?.result.text, "Four days. The dental pain has been worsening.", "first ask keeps Phase 2 rendering");
equal(repetitionFixtures[1]?.result.text, "Four days. It's been worsening.", "first repeat is shorter");
equal(repetitionFixtures[2]?.result.text, "I said four days. It's been worsening.", "later repeat shows mild impatience");
check(repetitionFixtures.every((fixture) => fixture.result.valid && !fixture.result.usedFallback), "all repetition fixtures validate");
check(!repetitionFixtures.some((fixture) => /idiot|stupid|refuse|won't answer|sarcas/i.test(fixture.result.text)), "maximum escalation remains mild");

const locationFacts = [
  { id: "c1.location", topic: "location" as const, text: "The bad tooth is a decayed left mandibular molar." },
];
const locationContext = context(classifyAmaraRepetitionSignal("Which tooth hurts?"), [clearDuration, secondClear]);
equal(selectAmaraRepetitionFacts(locationContext, locationFacts).map((fact) => fact.id), ["c1.location"], "disclosed facts supply governed repeat facts");
check(hasCompleteAmaraRepetitionFacts(locationContext, locationFacts), "complete governed location answer is countable");
check(!hasCompleteAmaraRepetitionFacts(locationContext, []), "missing location fact is not countable");
const genericLocationRepeat = renderPatientBehavior({
  patientId: AMARA_PATIENT_ID, caseId: "case-01",
  originalText: "It is the lower-left molar that hurts.",
  governedFacts: attachGovernedFacts(locationFacts, new Set(locationFacts.map((fact) => fact.id))),
  contract: AMARA_BEHAVIORAL_CONTRACT, repetition: locationContext,
});
equal(genericLocationRepeat.text, "Like I said, lower-left molar.", "fact-aware rendering handles provider wording variants");

const nonAmara = renderPatientBehavior({
  patientId: "other-patient", caseId: "case-02", originalText: "It has hurt for seven days.",
  governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT, repetition: laterRepeat,
});
equal(nonAmara.text, "It has hurt for seven days.", "non-Amara patient is unchanged");
const exact = renderPatientBehavior({
  patientId: AMARA_PATIENT_ID, caseId: "case-01", originalText: "I haven't noticed that.",
  governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT, repetition: laterRepeat, exactTextRequired: true,
});
equal(exact.text, "I haven't noticed that.", "exact-output bypass wins over repetition");

const durationFact: GovernedFact = {
  id: "c1.duration", canonicalValue: "The left lower molar pain has worsened over four days.",
  source: "case-definition", exactValues: ["four days"], certain: true, rubricRelevant: true,
};
const rejected = renderPatientBehavior({
  patientId: AMARA_PATIENT_ID, caseId: "case-01", originalText: "The dental pain has been worsening for four days.",
  governedFacts: [durationFact], contract: AMARA_BEHAVIORAL_CONTRACT, repetition: laterRepeat,
}, () => "I said three days.");
equal(rejected.text, "The dental pain has been worsening for four days.", "factual drift falls back to authoritative text");
check(rejected.usedFallback, "repetition rejection reports fallback");

const accepted = repetitionFixtures[2]?.result.text ?? "";
equal(buildPatientAudioPlan("case-01", accepted, 7).filter((segment) => segment.type === "speech").map((segment) => segment.text).join(""), accepted, "audio plan reconstructs accepted text exactly");

const route = await readFile("src/app/api/conversation/route.ts", "utf8");
check(route.indexOf("findTurn(") < route.indexOf("loadBehaviorIntentHistory("), "idempotent retry exits before history is read");
check(/persistedTurns: persistedBehaviorTurns/.test(route), "repetition uses persisted turn history");
check(/behaviorIntentId: repetition/.test(route), "canonical intent is persisted with the turn");
check(/baseResponse: finalResponseText/.test(route), "accepted repetition text is persisted");
const service = await readFile("src/lib/persistence/services/patientQuestionService.ts", "utf8");
check(/behaviorIntentId/.test(service) && /behaviorAnswerClear/.test(service), "turn service owns persisted behavior metadata");
const schema = await readFile("prisma/schema.prisma", "utf8");
check(/behaviorIntentId\s+String\?/.test(schema) && /behaviorAnswerClear\s+Boolean/.test(schema), "turn ledger schema stores canonical behavior history");
const source = await readFile("src/lib/patientBehavior/repetition.ts", "utf8");
check(!/ConversationMessage|conversation: readonly/.test(source), "repetition detector has no client-transcript dependency");
check(!/Math\.random|embedding|generateText|generateConversationResponse/.test(source), "classification is deterministic and local");

console.log(`Amara Phase 3 repetition validation passed: ${assertions} focused assertions.`);

function context(
  signal: ReturnType<typeof classifyAmaraRepetitionSignal>,
  persistedTurns: PersistedBehaviorIntentTurn[],
) {
  return buildAmaraRepetitionContext({ signal, persistedTurns, governedFactIds: ["c1.duration"] });
}

function persisted(responseText: string, answerClear: boolean, createdAt: string): PersistedBehaviorIntentTurn {
  return { responseText, answerClear, createdAt };
}
