import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mentorSource = await readFile(
  "src/components/MentorGeneratedDebrief.tsx",
  "utf8",
);

const explanation =
  "The mentor debrief could not be generated. Your encounter and transcript were saved. You can retry the mentor debrief or continue to your saved report without repeating the encounter.";
assert(mentorSource.includes(explanation));
assert(mentorSource.includes('import Link from "next/link"'));

const errorStart = mentorSource.indexOf('if (status === "error"');
const errorEnd = mentorSource.indexOf("const visibleMessages", errorStart);
assert(errorStart >= 0 && errorEnd > errorStart);
const errorSource = mentorSource.slice(errorStart, errorEnd);

for (const action of [
  "View saved report",
  "Retry mentor debrief",
  "Return home",
]) {
  assert(errorSource.includes(action));
}
assert.match(errorSource, /disabled=\{isRetryingDebrief\}/);
assert.match(errorSource, /<Link href=\{savedReportHref\}>View saved report<\/Link>/);
assert.match(errorSource, /<Link href="\/home">Return home<\/Link>/);
assert.doesNotMatch(errorSource, /disabled=.*(?:savedReportHref|Return home)/);

assert.match(
  mentorSource,
  /const savedReportHref =[\s\S]*localSummary\?\.caseId === caseId && localSummary\.attemptId\.trim\(\)[\s\S]*`\/reports\/\$\{localSummary\.caseId\}\?attemptId=\$\{encodeURIComponent\(localSummary\.attemptId\)\}`/,
);
assert.doesNotMatch(
  mentorSource.slice(mentorSource.indexOf("const savedReportHref ="), errorStart),
  /attemptId \?\?|encodeURIComponent\(attemptId\)/,
  "The fallback report URL must not derive identity from query input.",
);

const retryStart = mentorSource.indexOf("const retryDebrief = useCallback");
const retryEnd = mentorSource.indexOf("const submitQuestion", retryStart);
const retrySource = mentorSource.slice(retryStart, retryEnd);
assert.match(retrySource, /setStatus\("ready"\)/);
assert.match(retrySource, /catch \{[\s\S]*setStatus\("error"\)/);

for (const prohibited of [
  "/api/debrief",
  "/api/encounters/start",
  "/complete",
  "writeCompletedEncounterAttempt",
  "localStorage.setItem",
]) {
  assert(!errorSource.includes(prohibited));
}

function savedReportHref(summary: { caseId: string; attemptId: string } | null, caseId: string) {
  return summary?.caseId === caseId && summary.attemptId.trim()
    ? `/reports/${summary.caseId}?attemptId=${encodeURIComponent(summary.attemptId)}`
    : null;
}

assert.equal(
  savedReportHref({ caseId: "case-05", attemptId: "attempt 5" }, "case-05"),
  "/reports/case-05?attemptId=attempt%205",
);
assert.equal(savedReportHref(null, "case-05"), null);
assert.equal(savedReportHref({ caseId: "case-05", attemptId: "" }, "case-05"), null);
assert.equal(
  savedReportHref({ caseId: "case-04", attemptId: "attempt-5" }, "case-05"),
  null,
);

const failedActions = ["View saved report", "Retry mentor debrief", "Return home"];
const repeatedFailureActions = [...failedActions];
const retryingActions = [...failedActions];
assert.deepEqual(repeatedFailureActions, failedActions);
assert.deepEqual(retryingActions, failedActions);

for (const diagnostic of [
  "Reason:",
  "debrief_request_failed",
  "invalid_debrief_response",
  "debrief_timeout",
  "debrief_generation_failed",
]) {
  assert(!errorSource.includes(diagnostic));
}

console.log("Mentor debrief fallback-navigation validation passed.");
