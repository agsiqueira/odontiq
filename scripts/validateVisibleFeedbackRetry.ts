import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [canonicalSource, learnerSource] = await Promise.all([
  readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
  readFile("src/components/LearnerCaseReport.tsx", "utf8"),
]);

const automaticRetryMessage =
  "The first attempt was interrupted. OdontIQ is retrying your personalized feedback. Please keep this page open.";
const fallbackMessage =
  "Personalized feedback was not generated. Your encounter and transcript were saved. Select ‘Retry personalized feedback’ below to try again without repeating the encounter.";

assert(learnerSource.includes(automaticRetryMessage));
assert(learnerSource.includes(fallbackMessage));
assert(learnerSource.includes('"Retry personalized feedback"'));
assert.match(learnerSource, /feedbackState === "automatic-retrying"/);

assert.match(
  canonicalSource,
  /if \(payload\.status === "failed"\) \{[\s\S]*setStatus\("ready"\);[\s\S]*return;/,
  "A report already persisted as failed must not enter automatic retry.",
);
assert.match(
  canonicalSource,
  /const participatesInInitialGeneration =[\s\S]*payload\.status === "pending" \|\| payload\.status === "in-progress"/,
);
assert.match(
  canonicalSource,
  /if \(!candidate && participatesInInitialGeneration\) \{[\s\S]*setIsAutomaticallyRetrying\(true\);[\s\S]*generateOrJoinReport\(attemptId/,
);
assert.match(
  canonicalSource,
  /if \(initialGenerationFailed\) \{[\s\S]*const recovered = await requestReport\(attemptId\);[\s\S]*setServerTranscript\(confirmedTranscript\)/,
  "A failed joined request must recover a server-confirmed transcript when available.",
);
assert.equal(
  canonicalSource.match(/if \(!candidate && participatesInInitialGeneration\)/g)?.length,
  1,
  "Only one automatic full-report retry branch may exist.",
);
assert.match(canonicalSource, /requestReport\(attemptId, "POST"\)/);
assert.doesNotMatch(canonicalSource, /requestReport\(summary\.attemptId, "POST"\)/);
assert.match(canonicalSource, /waitForGenerationCompletion/);
assert.match(canonicalSource, /transcript=\{presentation\?\.transcript \?\? serverTranscript\}/);
assert.match(
  canonicalSource,
  /presentation \|\| isAutomaticallyRetrying \? undefined : \(\) => void retry\(\)/,
  "The manual retry control must be hidden during automatic retry.",
);

for (const prohibitedEndpoint of [
  "/api/encounters/start",
  "/complete",
  "/api/debrief",
]) {
  assert(!canonicalSource.includes(prohibitedEndpoint));
  assert(!learnerSource.includes(prohibitedEndpoint));
}

for (const prohibitedDiagnostic of [
  "generationError",
  "semantic_batch_",
  "request_failed_timeout",
  "provider raw exception",
]) {
  assert(!learnerSource.includes(prohibitedDiagnostic));
}
assert.doesNotMatch(canonicalSource, /console\.(?:error|log|warn)/);

type InitialStatus = "complete" | "failed" | "pending" | "in-progress";
type GenerationResult = "complete" | "failed";
function simulateInitialFlow(
  initialStatus: InitialStatus,
  firstResult: GenerationResult = "complete",
  retryResult: GenerationResult = "complete",
) {
  let generationPosts = 0;
  let automaticRetries = 0;
  if (initialStatus === "complete" || initialStatus === "failed") {
    return { generationPosts, automaticRetries, result: initialStatus };
  }
  if (initialStatus === "pending") generationPosts += 1;
  if (firstResult === "complete") {
    return { generationPosts, automaticRetries, result: "complete" as const };
  }
  automaticRetries += 1;
  generationPosts += 1;
  return { generationPosts, automaticRetries, result: retryResult };
}

assert.deepEqual(simulateInitialFlow("complete"), {
  generationPosts: 0,
  automaticRetries: 0,
  result: "complete",
});
assert.deepEqual(simulateInitialFlow("failed"), {
  generationPosts: 0,
  automaticRetries: 0,
  result: "failed",
});
assert.deepEqual(simulateInitialFlow("pending", "complete"), {
  generationPosts: 1,
  automaticRetries: 0,
  result: "complete",
});
assert.deepEqual(simulateInitialFlow("pending", "failed", "complete"), {
  generationPosts: 2,
  automaticRetries: 1,
  result: "complete",
});
assert.deepEqual(simulateInitialFlow("in-progress", "failed", "failed"), {
  generationPosts: 1,
  automaticRetries: 1,
  result: "failed",
});

const transcript = [
  { id: "student-1", role: "student", text: "Provider text" },
  { id: "patient-1", role: "patient", text: "Patient text" },
];
const retainedTranscript = transcript.map((message) => ({ ...message }));
assert.deepEqual(retainedTranscript, transcript);
assert.notEqual(retainedTranscript, transcript);

console.log("Visible single feedback-retry validation passed.");
