import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function reviewCase03Live(report) {
  const rows = report.tests.map(test => {
    const failures = [], findings = [];
    const consent = test.attempts.find(a => a.label === "consent");
    const answer = test.attempts.find(a => ["follow-up-confirmation", "planned-retry"].includes(a.label));
    const repeated = test.attempts.find(a => a.label === "repeated-confirmation");
    const closure = test.attempts.find(a => a.label === "closure");
    if (test.setupError || !closure) return { id: test.id, outcome: "ERROR", reason: "Setup or execution incomplete; inspect original attempts" };
    if (consent?.body.selectedQuestionId !== "c3-follow-up-needed-question") failures.push("Consent did not emit first follow-up question");
    const expected = test.expectedWhy ? "c3-follow-up-why" : undefined;
    if (answer?.body.selectedQuestionId !== expected) failures.push("Confirmation eligibility disagrees with expected explanation content");
    for (const attempt of test.attempts.filter(a => a.body?.success)) {
      const spokenWhyCount = (attempt.body.response.match(/\bWhy\?/g) ?? []).length;
      if (spokenWhyCount !== (attempt.body.selectedQuestionId === "c3-follow-up-why" ? 1 : 0)) failures.push(`${attempt.label}: displayed Why disagrees with selected question`);
      if (attempt.status !== 200 || attempt.body.requestId !== attempt.requestId || attempt.body.encounterId !== test.encounterId
        || attempt.persistedTurn?.responseText !== attempt.body.response
        || attempt.persistedTurn?.requestId !== attempt.requestId
        || (attempt.persistedTurn?.selectedQuestionId ?? undefined) !== attempt.body.selectedQuestionId) failures.push(`${attempt.label}: API/storage/correlation mismatch`);
    }
    for (const attempt of test.attempts.filter(a => a.persistedTurn)) {
      const expected = test.expectedEvidence?.[attempt.label] ?? (test.expectedEvidence ? [false,false] : undefined);
      if (!expected) continue; // Historical ledgers retain their original grading; corrections are separate artifacts.
      const proof = attempt.persistedState?.state?.case3Explanations;
      for (const [index,kind] of ["temporary","definitive"].entries()) {
        const current = proof?.[kind]?.messageId === attempt.persistedTurn.studentMessageId;
        if (current !== expected[index]) failures.push(`${attempt.label}: current ${kind} evidence disagrees with independently specified fixture meaning`);
        if (current && (!proof[kind].quote?.trim() || !attempt.question.includes(proof[kind].quote))) failures.push(`${attempt.label}: unsupported ${kind} quote`);
      }
    }
    const why = test.finalEmissions.filter(e => e.questionId === "c3-follow-up-why");
    if (why.length > 1) failures.push("Why durably emitted more than once");
    if (test.expectedWhy && (why.length !== 1 || repeated?.body.selectedQuestionId)) failures.push("Expected exactly one Why and none on repeated confirmation");
    if (closure?.body.selectedQuestionId || closure?.body.response !== "You're welcome.") failures.push("Closure restarted conversation or emitted a question");
    const failed = test.attempts.find(a => a.label === "intentional-failed-attempt");
    if (failed) {
      if (failed.emissions.some(e => e.questionId === "c3-follow-up-why") || JSON.stringify(failed.persistedState?.state) !== JSON.stringify(consent.persistedState?.state)) failures.push("Failed attempt changed eligibility or consumed question");
      if (test.id.includes("generation") && (failed.status !== 502 || failed.persistedTurn !== null)) failures.push("Injected generation failure did not fail without persisting a turn");
      if ((test.id.includes("classifier") || test.id.includes("failed-explanation")) && (failed.status !== 200 || failed.body.selectedQuestionId)) failures.push("Classifier/verifier failure did not fail closed");
    }
    if (!test.expectedWhy && why.length !== 0) failures.push("Already-answered Why was emitted despite two validated explanations");
    if (!test.expectedWhy) {
      const remembered = answer?.persistedState?.state?.case3Explanations;
      if (!remembered?.temporary?.quote || !remembered?.definitive?.quote) failures.push("Suppression lacks separately persisted explanation evidence");
    }
    return { id: test.id, contractOutcome: failures.length ? "FAIL" : "PASS",
      outcome: failures.length || findings.length ? "FAIL" : "PASS", failures, findings };
  });
  return { reviewedAt: new Date().toISOString(), rubric: "PR3 user-authorized durable validated explanations; independent witnesses required; historical verdicts preserved", rows,
    counts: Object.fromEntries(["PASS", "FAIL", "ERROR"].map(k => [k, rows.filter(r => r.outcome === k).length])),
    note: "Structural/state checks are not a substitute for semantic review of every exact response. Raw responses and first failures remain in the source ledger." };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  const result = reviewCase03Live(JSON.parse(fs.readFileSync(input, "utf8")));
  fs.writeFileSync(input.replace(/\.json$/, "-adjudication.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.counts));
  process.exitCode = result.rows.some(r => r.outcome !== "PASS") ? 1 : 0;
}
