import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  behavioralStageForNextTurn,
  renderPatientBehavior,
  selectBehavioralStage,
  type BehavioralStage,
  type GovernedFact,
} from "../src/lib/patientBehavior";

let assertions = 0;
const equal = (actual: unknown, expected: unknown, message: string) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };

for (const [turn, stage] of [[1, 1], [4, 1], [5, 2], [8, 2], [9, 3], [50, 3]] as const) {
  equal(selectBehavioralStage(turn), stage, `finalized turn ${turn} selects Stage ${stage}`);
}
for (const [prior, stage] of [[0, 1], [3, 1], [4, 2], [7, 2], [8, 3]] as const) {
  equal(behavioralStageForNextTurn(prior), stage, `${prior} prior finalized turns select Stage ${stage} next`);
}

equal(PATIENT_BEHAVIOR_PROFILES.length, 5, "every current patient has a profile");
for (const profile of PATIENT_BEHAVIOR_PROFILES) {
  const contract = behavioralContractForCase(profile.caseId);
  assert.ok(contract);
  for (const stage of [1, 2, 3] as const) {
    const result = renderPatientBehavior({ patientId: profile.patientId, caseId: profile.caseId, originalText: "I am trying to answer, but I do not feel well.", governedFacts: [], contract, stage });
    equal(result.stage, stage, `${profile.displayName} reports Stage ${stage}`);
    check(result.valid && !result.usedFallback, `${profile.displayName} Stage ${stage} is accepted`);
    check(result.text.length > 0, `${profile.displayName} Stage ${stage} renders text`);
    check(!/idiot|stupid|shut up|sarcas/i.test(result.text), `${profile.displayName} Stage ${stage} is non-abusive`);
  }
}

const durationFact: GovernedFact = { id: "c1.duration", canonicalValue: "The dental pain has been worsening for four days.", source: "case-definition", exactValues: ["four days"], certain: true, rubricRelevant: true };
const amaraContract = behavioralContractForCase("case-01");
assert.ok(amaraContract);
for (const stage of [1, 2, 3] as const) {
  const normal = renderAmara(stage, "none");
  const repeated = renderAmara(stage, "later_repeat");
  equal(normal.stage, repeated.stage, `repetition does not advance Amara Stage ${stage}`);
  check(normal.text !== repeated.text, `repetition modifies wording within Stage ${stage}`);
  check(normal.text.includes("four days") && repeated.text.includes("four days"), `Stage ${stage} repetition preserves duration`);
}

const rejected = renderPatientBehavior({ patientId: "amara-johnson", caseId: "case-01", originalText: durationFact.canonicalValue, governedFacts: [durationFact], contract: amaraContract, stage: 3 }, () => "It has been three days.");
equal(rejected.text, durationFact.canonicalValue, "fact drift falls back to authoritative text");
check(rejected.usedFallback, "fact drift reports fallback");

const exact = renderPatientBehavior({ patientId: "marcus-lee", caseId: "case-02", originalText: "I haven't noticed that.", governedFacts: [], contract: behavioralContractForCase("case-02")!, stage: 3, exactTextRequired: true });
equal(exact.text, "I haven't noticed that.", "exact governed behavior bypasses stages");

const route = await readFile("src/app/api/conversation/route.ts", "utf8");
const findIndex = route.indexOf("findTurn(");
const countIndex = route.indexOf("countFinalizedTurns(");
check(findIndex >= 0 && findIndex < countIndex, "retry and refresh idempotency precedes stage counting");
check(countIndex < route.indexOf("renderPatientBehavior({"), "persisted finalized count is loaded before rendering");
check(/behavioralStageForNextTurn\(priorFinalizedTurnCount\)/.test(route), "runtime stage depends only on finalized count");
check(!/behavioralStageForNextTurn\([^)]*(?:score|repetition|elapsed|breath)/i.test(route), "stage selection has no scoring, repetition, time, or breathing input");
check(/stage: behavioralStage/.test(route), "selected stage reaches the production renderer");

const service = await readFile("src/lib/persistence/services/patientQuestionService.ts", "utf8");
check(/countFinalizedTurns[\s\S]*conversationTurn\.count\(\{ where: \{ encounterId \} \}\)/.test(service), "stage count uses persisted finalized turn rows");
const schema = await readFile("prisma/schema.prisma", "utf8");
check(!/behavioralStage|patientBehaviorStage/.test(schema), "no stage persistence model was introduced");

console.log(`Patient behavioral-stage validation passed: ${assertions} focused assertions.`);

function renderAmara(stage: BehavioralStage, level: "none" | "later_repeat") {
  return renderPatientBehavior({ patientId: "amara-johnson", caseId: "case-01", originalText: durationFact.canonicalValue, governedFacts: [durationFact], contract: amaraContract!, stage, repetition: { level, clarificationSafe: false, countsTowardHistory: level !== "none", reason: level === "none" ? "first-ask" : "semantic-repeat", history: { intentId: "duration", askCount: level === "none" ? 1 : 3, clearAnswerCount: level === "none" ? 0 : 2, lastGovernedFactIds: ["c1.duration"] } } });
}
