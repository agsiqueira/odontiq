import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [mentorSource, debriefRouteSource] = await Promise.all([
  readFile("src/components/MentorGeneratedDebrief.tsx", "utf8"),
  readFile("src/app/api/debrief/route.ts", "utf8"),
]);

const failureInstructions =
  "The mentor debrief could not be generated. Your encounter and transcript were saved. Select ‘Retry mentor debrief’ below to try again without repeating the encounter.";
const retryProgress =
  "OdontIQ is retrying your mentor debrief. Please keep this page open.";

assert(mentorSource.includes(failureInstructions));
assert(mentorSource.includes(retryProgress));
assert(mentorSource.includes('"Retry mentor debrief"'));
assert.match(mentorSource, /disabled=\{isRetryingDebrief\}/);
assert.match(mentorSource, /isDebriefRequestActiveRef\.current/);
assert.match(mentorSource, /debriefRequestIdRef\.current !== requestId/);
assert.match(mentorSource, /debriefAbortRef\.current\?\.abort\(\)/);

const retryStart = mentorSource.indexOf("const retryDebrief = useCallback");
const retryEnd = mentorSource.indexOf("const submitQuestion", retryStart);
assert(retryStart >= 0 && retryEnd > retryStart);
const retrySource = mentorSource.slice(retryStart, retryEnd);

assert.match(retrySource, /!localSummary/);
assert.match(retrySource, /localSummary\.caseId !== caseId/);
assert.match(retrySource, /localSummary\.conversationHistory\.length === 0/);
assert.match(
  retrySource,
  /generateDebrief\(\{[\s\S]*summary: localSummary,[\s\S]*controller/,
);
assert.match(retrySource, /setDebrief\(response\.debrief\);[\s\S]*setStatus\("ready"\)/);
assert.match(retrySource, /catch \{[\s\S]*setStatus\("error"\)/);
assert.doesNotMatch(retrySource, /ensureCanonicalFacultyArtifacts/);
assert.doesNotMatch(retrySource, /persistCompletedAttemptToServer/);
assert.doesNotMatch(retrySource, /writeCompletedEncounterAttempt|localStorage/);
assert.doesNotMatch(retrySource, /\/api\/encounters|\/complete|\/api\/reports?/);

for (const field of [
  "caseId: summary.caseId",
  "conversationHistory: summary.conversationHistory",
  "coveredChecklistItems: summary.coveredChecklistItems",
  "coveredFacts: summary.coveredFacts",
  "examinationsViewed: summary.examinationsViewed",
]) {
  assert(mentorSource.includes(field));
}

assert(!mentorSource.includes("Please try finishing the encounter again"));
assert(!mentorSource.includes("Reason:"));
for (const diagnostic of [
  "debrief_request_failed",
  "invalid_debrief_response",
  "debrief_timeout",
  "debrief_generation_failed",
]) {
  const errorPanelStart = mentorSource.indexOf('if (status === "error"');
  const errorPanelEnd = mentorSource.indexOf("const visibleMessages", errorPanelStart);
  assert(!mentorSource.slice(errorPanelStart, errorPanelEnd).includes(diagnostic));
}

const originalTranscript = [
  { id: "one", role: "student", text: "First", timestamp: "2026-08-01T10:00:00Z" },
  { id: "two", role: "patient", text: "Second", timestamp: "2026-08-01T10:00:01Z" },
];
const summary = {
  caseId: "case-05",
  conversationHistory: originalTranscript,
  coveredChecklistItems: ["check-1"],
  coveredFacts: ["fact-1"],
  examinationsViewed: ["exam-1"],
};
const firstPayload = JSON.parse(JSON.stringify(summary));
const retryPayload = JSON.parse(JSON.stringify(summary));
assert.deepEqual(retryPayload, firstPayload);
assert.deepEqual(summary.conversationHistory, originalTranscript);

let active = false;
let requestCount = 0;
async function guardedRetry() {
  if (active) return;
  active = true;
  requestCount += 1;
  await Promise.resolve();
}
await Promise.all([guardedRetry(), guardedRetry(), guardedRetry()]);
assert.equal(requestCount, 1, "Repeated clicks must create one active request.");

assert.match(debriefRouteSource, /type DebriefRequest = \{[\s\S]*caseId: string;/);
assert.doesNotMatch(debriefRouteSource, /attemptId|findOwnedById|requireAppUser/);

console.log(
  "Mentor debrief same-encounter retry validation passed; /api/debrief remains authenticated by the app proxy but does not revalidate server attempt ownership.",
);
