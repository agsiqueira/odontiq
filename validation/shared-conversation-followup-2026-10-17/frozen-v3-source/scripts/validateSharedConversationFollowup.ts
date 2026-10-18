import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessBackgroundAnswer, backgroundFallback } from "../src/lib/patientBackgroundTurn";
import { assessCanonicalAssertions } from "../src/lib/patientCanonicalAssertions";
import { validatePatientFinalResponse } from "../src/lib/patientFinalResponse";
const root = "validation/shared-conversation-followup-2026-10-17";
const previous = "validation/shared-conversation-repair-2026-10-17";
const rows = ["primary-results.json", "holdout-results.json"].flatMap(f => JSON.parse(readFileSync(`${previous}/${f}`, "utf8")))
  .filter(r => r.outcome === "FAIL");
const results = rows.map(r => {
  const caseData = CASE_DATA.find(c => c.metadata.id === r.caseId)!;
  const state = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: r.question });
  assert(state.backgroundTurn, r.question);
  const answer = backgroundFallback(state.backgroundTurn);
  assert(assessBackgroundAnswer(answer, state.backgroundTurn).valid, r.question);
  assert(!assessBackgroundAnswer(r.finalResponse, state.backgroundTurn).valid, r.question);
  if (r.testId === "C03-G09-H02") assert.deepEqual(state.backgroundTurn.requests.map(r => r.concept), ["dentist"]);
  return { testId: r.testId, question: r.question, requests: state.backgroundTurn.requests, selected: state.allowedThisTurn.map(f => f.id), previousResponse: r.finalResponse, sourcedFallback: answer };
});
for (const caseData of CASE_DATA) {
  for (const question of ["Who do you live with?", "With whom are you living?", "Does your daughter live with you?", "Do you share a household?"]) {
    const s = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question });
    assert.equal(s.allowedThisTurn.length, 0, question);
    assert(s.backgroundTurn?.requests.some(r => r.concept === "household" && r.value === "unknown"));
  }
  const facts = caseData.supportingInfo.patientFacts ?? [];
  for (const text of ["My dental care is covered by my employer's insurance plan.", "It's been tough finding time for both of us.", "My sister drives me to the clinic."]) {
    assert(!assessCanonicalAssertions(text, facts).valid, text);
    assert(!validatePatientFinalResponse(text, { canonicalFacts: facts }).valid, text);
  }
  for (const text of ["Thank you for helping.", "I'm worried.", "I appreciate that.", "Would insurance cover this?", "I'm not sure whether that clinic can treat both of us."]) assert(assessCanonicalAssertions(text, facts).valid, text);
}
const case3 = CASE_DATA.find(c => c.metadata.id === "case-03")!;
assert(!assessCanonicalAssertions("No, I don't have a dental provider. I'm uninsured.", case3.supportingInfo.patientFacts ?? []).valid);
assert(assessCanonicalAssertions("My daughter has Medicaid. I don't have insurance.", case3.supportingInfo.patientFacts ?? []).valid);
const case2 = CASE_DATA.find(c => c.metadata.id === "case-02")!;
for (const [question, concept] of [["When did your Medicaid stop?", "coverage_timing"], ["Is insurance available when choosing a clinic?", "insurance"], ["What insurer covers your visits?", "insurance"]]) {
  const s = buildPatientDisclosureState({ caseData: case2, conversation: [], latestStudentMessage: question });
  assert(s.backgroundTurn?.requests.some(r => r.concept === concept), question);
}
writeFileSync(`${root}/targeted-replays.json`, JSON.stringify(results, null, 2));
console.log(`Focused interpretation and independent canonical-guard checks passed; ${results.length} prior confirmed scored failures rejected and sourced fallbacks validated. These are deterministic, not live responses.`);
