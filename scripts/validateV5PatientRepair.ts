import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { CASE_DATA, loadCase } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { backgroundFallback, assessBackgroundAnswer } from "../src/lib/patientBackgroundTurn";
import { assessCanonicalAssertions } from "../src/lib/patientCanonicalAssertions";
import { assertPatientFinalResponse, validatePatientFinalResponse } from "../src/lib/patientFinalResponse";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { fetchNavigatorWithGatewayRetry, type NavigatorHttpAttempt } from "../src/lib/ai/navigatorTransport";

async function main() {
  const baseline = JSON.parse(readFileSync("validation/shared-conversation-followup-2026-10-17/final-v4/unresolved-items.json", "utf8"));
  const replays = [];
  for (const row of baseline.filter((r: { outcome: string }) => ["FAIL", "REVIEW"].includes(r.outcome))) {
    const caseData = loadCase(row.caseId)!;
    const state = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: row.question });
    assert(state.backgroundTurn, row.testId);
    const context = { backgroundTurn: state.backgroundTurn, canonicalFacts: caseData.supportingInfo.patientFacts, latestStudentMessage: row.question };
    assert(!validatePatientFinalResponse(row.finalResponse, context).valid, `${row.testId}: unsafe V4 output remains rejected`);
    const expected = backgroundFallback(state.backgroundTurn);
    assert(validatePatientFinalResponse(expected, context).valid, `${row.testId}: exact concept fallback valid`);
    const final = await generatePatientRoleSafeResponse({ initialOutput: row.finalResponse, retry: async () => row.finalResponse, fallbackText: expected, validateAdditional: text => validatePatientFinalResponse(text, context) });
    assert.equal(final.text, expected);
    replays.push({ testId: row.testId, question: row.question, oldResponse: row.finalResponse, concepts: state.backgroundTurn.requests.map(r => r.concept), repairedFallback: final.text });
  }
  for (const row of baseline.filter((r: { reason: string }) => /unsupported family composition/.test(r.reason))) {
    const c = loadCase(row.caseId)!;
    const question = row.errorStage === "setup" ? row.lastAttemptedTurn.question : row.question;
    const state = buildPatientDisclosureState({ caseData: c, conversation: [], latestStudentMessage: question });
    assert(state.backgroundTurn, question);
    const text = backgroundFallback(state.backgroundTurn);
    // Reproduce the V4 persistence boundary, then exercise the corrected authoritative case context.
    if (/my daughter|i have a young daughter/i.test(text)) assert.throws(() => assertPatientFinalResponse(text), /unsupported family composition/);
    assertPatientFinalResponse(text, { canonicalFacts: loadCase(row.caseId)!.supportingInfo.patientFacts });
    replays.push({ testId: row.testId, stage: row.errorStage ?? "scored-question", actualQuestion: question, correctedPersistenceResponse: text });
  }
  const service = readFileSync("src/lib/persistence/services/patientQuestionService.ts", "utf8");
  assert.match(service, /assertPatientFinalResponse\(responseText,\s*\{\s*canonicalFacts: loadCase\(input.caseId\)/);
  const c3 = loadCase("case-03")!;
  assert.throws(() => assertPatientFinalResponse("My daughter has Medicaid.", { canonicalFacts: loadCase("case-01")!.supportingInfo.patientFacts }));
  assertPatientFinalResponse("My daughter has Medicaid.", { canonicalFacts: c3.supportingInfo.patientFacts });
  assert.throws(() => assertPatientFinalResponse("My daughter sees a dentist at her own clinic.", { canonicalFacts: c3.supportingInfo.patientFacts }));
  for (const question of ["Could I arrange a trip to a neighboring county for lower-cost care?", "Could you make trips to other towns for treatment?", "Would a different county be possible for affordable dental care?"]) {
    const state = buildPatientDisclosureState({ caseData: loadCase("case-01")!, conversation: [], latestStudentMessage: question });
    assert(state.backgroundTurn?.requests.some(r => r.concept.startsWith("travel")), question);
  }
  for (const question of ["Do you see a dentist regularly?", "Are you established with your own dentist?", "Is your dentist your usual provider?"]) {
    const state = buildPatientDisclosureState({ caseData: c3, conversation: [], latestStudentMessage: question });
    assert.deepEqual(state.backgroundTurn?.requests.map(r => r.concept), /regularly/.test(question) ? ["dentist", "attendance"] : ["dentist"], question);
    assert(!state.allowedThisTurn.some(f => /\.crown$|\.rct$|\.dental-work$/.test(f.id)), question);
  }
  for (const c of CASE_DATA) {
    const facts = c.supportingInfo.patientFacts ?? [];
    for (const text of ["I need time off work.", "It depends on whether I get a day off work.", "I haven't been in a while.", "It's been a while since I've been to the dentist."]) {
      const result = assessCanonicalAssertions(text, facts, { latestStudentMessage: "Do you have a dentist?" });
      const sourcedAttendance = c.metadata.id === "case-02" && /while/.test(text);
      assert.equal(result.valid, sourcedAttendance, `${c.metadata.id}: ${text}`);
    }
    for (const text of ["Thank you.", "I'm worried about my tooth.", "I don't remember the exact date.", "Could someone help me arrange a visit?"]) assert(assessCanonicalAssertions(text, facts).valid, text);
  }
  const timing = buildPatientDisclosureState({ caseData: loadCase("case-02")!, conversation: [], latestStudentMessage: "When did your Medicaid end?" }).backgroundTurn!;
  assert(assessBackgroundAnswer("I don't remember the exact date, but I lost Medicaid within the past year.", timing).valid);
  assert(!assessBackgroundAnswer("It was about a year ago.", timing).valid);
  const requests: RequestInit[] = [];
  async function trial(statuses: number[]) {
    const attempts: NavigatorHttpAttempt[] = [];
    let i = 0;
    const result = await fetchNavigatorWithGatewayRetry("https://example.invalid/v1/chat/completions", { method: "POST", body: "unchanged" }, a => attempts.push(a), {
      fetch: (async (_url, init) => { requests.push(init!); return new Response("{}", { status: statuses[Math.min(i++, statuses.length - 1)] }); }) as typeof fetch,
      wait: async () => {},
    });
    return { ...result, attempts };
  }
  for (const status of [502, 503, 504]) { const r = await trial([status, 200]); assert.deepEqual(r.attempts.map(a => a.status), [status, 200]); }
  const exhausted = await trial([502, 503, 200]);
  assert.equal(exhausted.attempts.length, 2);
  assert.equal(exhausted.response.status, 503);
  for (const status of [400, 401, 403, 404, 429, 500]) assert.equal((await trial([status, 200])).attempts.length, 1);
  assert(requests.every(r => r.method === "POST" && r.body === "unchanged"));
  const errors: NavigatorHttpAttempt[] = [];
  await assert.rejects(fetchNavigatorWithGatewayRetry("https://example.invalid", {}, a => errors.push(a), { fetch: (async () => { throw new TypeError("network"); }) as typeof fetch }));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].retryable, false);
  writeFileSync("validation/v6/prior-v5-focused-replays.json", JSON.stringify({ checkedAt: new Date().toISOString(), baselineUnresolvedItems: baseline.length, replays, transportTests: "502/503/504 one retry, exhausted max2, no retry on auth/rate-limit/application/general errors/network exceptions; every attempt recorded" }, null, 2));
  console.log(`V5 repair validation passed (${replays.length} V4 failure/review/rejection/setup replays, concept holdbacks, negative controls and bounded gateway retry tests).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
