import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessBackgroundAnswer, backgroundFallback } from "../src/lib/patientBackgroundTurn";
import { validatePatientFinalResponse } from "../src/lib/patientFinalResponse";

const inventory = JSON.parse(readFileSync("validation/question-variations-2026-10-17/inventory.json", "utf8"));
const results = [];
for (const item of inventory.tests) {
  const caseData = CASE_DATA.find(c => c.metadata.id === item.caseId)!;
  const conversation = (item.setupQuestions as string[]).map((text, i) => ({ id: String(i), role: "student" as const, text, timestamp: "2026-10-17T00:00:00Z" }));
  const state = buildPatientDisclosureState({ caseData, conversation, latestStudentMessage: item.question });
  const turn = state.backgroundTurn;
  const answer = turn ? backgroundFallback(turn) : "";
  const assessment = turn ? assessBackgroundAnswer(answer, turn) : { valid: false, reason: "no contract" };
  results.push({ testId: item.testId, requests: turn?.requests, selected: state.allowedThisTurn.map(f => f.id), answer, assessment });
}
writeFileSync(process.env.ODONTIQ_VALIDATION_OUTPUT ?? "validation/shared-conversation-repair-2026-10-17/deterministic-contract-replay.json", JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.assessment.valid);
assert.deepEqual(failed.map(r => ({ id: r.testId, reason: r.assessment.reason })), []);
const state = (caseId: string, question: string) => buildPatientDisclosureState({ caseData: CASE_DATA.find(c => c.metadata.id === caseId)!, conversation: [], latestStudentMessage: question });
for (const [q, expected] of [
  ["Where is the pain?", "location"], ["How long has your pain lasted?", "duration"], ["Does the pain travel to your ear?", "radiation"],
] as const) {
  const s = state("case-03", q);
  assert(!s.backgroundTurn, `${q} was background`);
  assert(s.allowedThisTurn.some(f => f.id.endsWith(`.${expected}`)), q);
}
const combined = state("case-03", "Are you insured and does your daughter have Medicaid?").backgroundTurn!;
assert.deepEqual(combined.requests.filter(r => r.concept === "insurance").map(r => r.subject).sort(), ["daughter", "patient"]);
assert(!assessBackgroundAnswer("My daughter has Medicaid.", combined).valid);
assert(!assessBackgroundAnswer("I have Medicaid and my daughter has Medicaid.", combined).valid);
const dentist = state("case-03", "Do you have a dentist even if you don't have insurance?").backgroundTurn!;
assert.deepEqual(dentist.requests.map(r => r.concept), ["dentist"]);
const residency = state("case-02", "Has your status as a resident been established?").backgroundTurn!;
assert(residency.requests.some(r => r.concept === "residency"));
assert(!assessBackgroundAnswer("I live in Collier County.", residency).valid);
const coverage = state("case-02", "When did Medicaid end?").backgroundTurn!;
assert(!assessBackgroundAnswer("I lost Medicaid within the past year, when my employer stopped the plan.", coverage).valid);
const travel = state("case-01", "Would you travel outside the county?").backgroundTurn!;
for (const response of ["I live in Alachua County.", "I'm not sure how far I can travel.", "I have reliable transportation but I can't travel.", "I can travel; my car is reliable.", "I can travel. I smoke one pack a day."]) assert(!assessBackgroundAnswer(response, travel).valid, response);
assert(validatePatientFinalResponse(backgroundFallback(travel), { backgroundTurn: travel }).valid);
assert(!validatePatientFinalResponse(`${backgroundFallback(travel)} I can only travel five miles.`, { backgroundTurn: travel, visibleFacts: CASE_DATA[0].supportingInfo.patientFacts }).valid);
for (const caseId of ["case-03", "case-04", "case-05"]) {
  const turn = state(caseId, "Can you travel to another county?").backgroundTurn!;
  assert(turn.requests.every(r => r.value === "unknown"));
  assert(assessBackgroundAnswer(backgroundFallback(turn), turn).valid);
  assert(!assessBackgroundAnswer("I'm not sure but I have a car.", turn).valid);
}
console.log(`Shared contract checks passed: ${results.length} inventory interpretations/fallbacks, clinical controls, combined subjects, premise handling, unsupported claims and final guards. These are deterministic checks, not live Navigator observations.`);
