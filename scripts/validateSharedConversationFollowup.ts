import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessBackgroundAnswer, backgroundFallback } from "../src/lib/patientBackgroundTurn";
import { assessCanonicalAssertions } from "../src/lib/patientCanonicalAssertions";
import { validatePatientFinalResponse } from "../src/lib/patientFinalResponse";
const root = process.env.ODONTIQ_FOLLOWUP_OUTPUT ?? "validation/shared-conversation-followup-2026-10-17/final-v4";
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
const v3Root = "validation/shared-conversation-followup-2026-10-17";
const v3Failures = ["primary", "targeted-live", "fresh-holdout"].flatMap(c => JSON.parse(readFileSync(`${v3Root}/${c}-results.json`, "utf8"))).filter(r => r.outcome === "FAIL");
const replayed = v3Failures.map(r => {
  const caseData = CASE_DATA.find(c => c.metadata.id === r.caseId)!;
  const conversation = r.setupTurns.flatMap((t: { question: string; finalResponse: string }, i: number) => [
    { id: `s${i}`, role: "student" as const, text: t.question, timestamp: "2026-10-17T00:00:00Z" },
    { id: `p${i}`, role: "patient" as const, text: t.finalResponse, timestamp: "2026-10-17T00:00:01Z" },
  ]);
  const state = buildPatientDisclosureState({ caseData, conversation, latestStudentMessage: r.question });
  const context = { backgroundTurn: state.backgroundTurn, canonicalFacts: caseData.supportingInfo.patientFacts ?? [], latestStudentMessage: r.question };
  const assessment = validatePatientFinalResponse(r.finalResponse, context);
  assert(!assessment.valid, `${r.testId}: actual v3 bad final must be rejected`);
  const fallback = state.backgroundTurn ? backgroundFallback(state.backgroundTurn) : "Thank you.";
  assert(validatePatientFinalResponse(fallback, context).valid, `${r.testId}: sourced fallback must remain valid`);
  return { testId: r.testId, question: r.question, oldResponse: r.finalResponse, interpretation: state.backgroundTurn, rejection: assessment.reason, sourcedFallback: fallback };
});
const preference = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: "Would a clinic accepting your daughter on Medicaid and seeing you uninsured suit your preference?" }).backgroundTurn!;
assert.deepEqual(preference.requests.map(r => r.concept), ["shared_clinic"]);
for (const text of ["Yes, that would be ideal. I'd prefer to have my appointments at the same clinic as my daughter to make things easier for both of us.", "Yes, I would.", "Probably, as long as they cater to adults and children's needs.", "Yes, I'd prefer the same clinic, but I'm not sure if it can meet both our needs."]) {
  assert(assessBackgroundAnswer(text, preference).valid, text);
}
assert(!assessBackgroundAnswer("Yes, but I prefer separate clinics as long as they provide good care.", preference).valid);
for (const text of ["My daughter has Medicaid, and I have my own dentist.", "I have a young daughter on Medicaid.", "No insurance, but I have my own dentist.", "Thank you, Dr Smith."]) assert(assessCanonicalAssertions(text, case3.supportingInfo.patientFacts ?? []).valid, text);
for (const text of ["I usually go to Dr Jones.", "My dentist is Doctor Ramirez.", "My daughter sees a dentist at a particular clinic."]) assert(!assessCanonicalAssertions(text, case3.supportingInfo.patientFacts ?? []).valid, text);
for (const caseData of CASE_DATA) {
  const turn = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: "Do you have insurance?" }).backgroundTurn!;
  assert(assessBackgroundAnswer("No, I don't.", turn).valid);
  const negative = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: "Are you uninsured?" }).backgroundTurn!;
  assert(!assessBackgroundAnswer("No, I don't.", negative).valid, "Do not reverse a negative-form question's polarity");
  assert(assessBackgroundAnswer("Yes.", negative).valid);
  const facts = caseData.supportingInfo.patientFacts ?? [];
  for (const text of ["I live alone, I'm not sure about my household.", "I live with my partner, but I don't know.", "I have a roommate, but I'm not sure.", "I share my home with a friend."]) assert(!assessCanonicalAssertions(text, facts).valid);
  for (const text of ["My mother drives me to the clinic.", "I can drive there.", "I take the bus."]) assert(!assessCanonicalAssertions(text, facts).valid, "Reliable or unspecified transportation must not invent a mode or family driver");
}
assert(assessCanonicalAssertions("I live with my diabetes.", CASE_DATA[0].supportingInfo.patientFacts ?? []).valid);
for (const q of ["Do you have insurance when treatment starts?", "Do you have coverage while choosing a dentist?", "Do you have insurance when we start dental care?"]) {
  const turn = buildPatientDisclosureState({ caseData: case2, conversation: [], latestStudentMessage: q }).backgroundTurn!;
  assert(turn.requests.some(r => r.concept === "insurance") && !turn.requests.some(r => r.concept === "coverage_timing"), q);
}
const medicalLiving = buildPatientDisclosureState({ caseData: CASE_DATA[0], conversation: [], latestStudentMessage: "Do you live with diabetes?" });
assert(!medicalLiving.backgroundTurn, "Living with a condition is not household or place");
assert(medicalLiving.allowedThisTurn.some(f => f.id === "c1.diabetes"));
const withDaughter = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: "Where do you live with your daughter?" });
assert.deepEqual(withDaughter.backgroundTurn?.requests.map(r => r.concept), ["residence"], "A place question must not establish cohabitation from its premise");
writeFileSync(`${root}/v3-failure-replays.json`, JSON.stringify(replayed, null, 2));
console.log(`${replayed.length} actual v3 failures rejected; valid preference, clause polarity, contextual short answers, clinical controls and care-planning scope preserved.`);
console.log(`Focused interpretation and independent canonical-guard checks passed; ${results.length} prior confirmed scored failures rejected and sourced fallbacks validated. These are deterministic, not live responses.`);
