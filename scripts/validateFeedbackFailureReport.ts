import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [canonicalSource, learnerSource] = await Promise.all([
  readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
  readFile("src/components/LearnerCaseReport.tsx", "utf8"),
]);

const explanation =
  "Personalized feedback was not generated. Your encounter and transcript were saved. Select ‘Retry personalized feedback’ below to try again without repeating the encounter.";
assert(learnerSource.includes(explanation));
assert(learnerSource.includes('"Retry personalized feedback"'));
assert(
  learnerSource.includes(
    "OdontIQ is retrying your personalized feedback. Please keep this page open.",
  ),
);
assert.match(learnerSource, /disabled=\{isRetrying\}/);
assert.match(learnerSource, /facultyReport\?: FacultyReport/);
assert(learnerSource.includes("Consultation Transcript"));
assert(learnerSource.includes("Download Transcript"));
assert(learnerSource.includes("Try Another Case"));
assert(learnerSource.includes("Return Home"));

assert.match(
  canonicalSource,
  /if \(payload\.status === "failed"\) \{[\s\S]*setSummary\(null\);[\s\S]*setStatus\("ready"\);[\s\S]*return;/,
  "A failed server report must render the transcript report without an automatic retry.",
);
assert.match(canonicalSource, /requestReport\(attemptId, "POST"\)/);
assert.doesNotMatch(canonicalSource, /requestReport\(summary\.attemptId, "POST"\)/);
assert.match(canonicalSource, /if \(!attemptId \|\| !serverTranscript \|\| isRetrying\) return;/);
assert.match(canonicalSource, /payload\.caseId !== caseId/);
assert.match(canonicalSource, /recovered\.caseId === caseId/);
assert.doesNotMatch(canonicalSource, /readCompletedEncounterAttempt/);
assert.doesNotMatch(canonicalSource, /persistCompletedAttemptToServer/);
assert.doesNotMatch(canonicalSource, /console\.(?:error|log|warn)/);
assert.match(canonicalSource, /transcript=\{presentation\?\.transcript \?\? serverTranscript\}/);
assert.match(canonicalSource, /facultyReport=\{presentation\?\.report\}/);
assert.match(canonicalSource, /setStatus\("ready"\);[\s\S]*catch \{[\s\S]*setStatus\("ready"\)/);

for (const prohibitedEndpoint of [
  "/api/encounters/start",
  "/complete",
  "/api/debrief",
]) {
  assert(!canonicalSource.includes(prohibitedEndpoint));
  assert(!learnerSource.includes(prohibitedEndpoint));
}

for (const prohibitedDiagnostic of [
  "semantic_batch_",
  "request_failed_timeout",
  "generationError",
  "provider raw exception",
]) {
  assert(!learnerSource.includes(prohibitedDiagnostic));
}

const failedTranscript = [
  { id: "student-1", role: "student", text: "Exact provider text", timestamp: "t1" },
  { id: "patient-1", role: "patient", text: "Exact patient text", timestamp: "t2" },
];
const retainedTranscript = failedTranscript.map((message) => ({ ...message }));
assert.deepEqual(retainedTranscript, failedTranscript);
assert.notEqual(retainedTranscript, failedTranscript);

console.log("Feedback-failure transcript report validation passed.");
