import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getGenerationDisposition,
  isGenerationLeaseActive,
  runWithGenerationOwnership,
  waitForGenerationCompletion,
} from "../src/lib/facultyRubric/report/generationOwnership";

let claimed = false;
let evaluationCalls = 0;
let releaseFirstEvaluation!: () => void;
const firstEvaluation = new Promise<void>((resolve) => {
  releaseFirstEvaluation = resolve;
});
const run = () =>
  runWithGenerationOwnership({
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    generate: async () => {
      evaluationCalls += 1;
      await firstEvaluation;
      return "artifacts";
    },
    releaseAfterFailure: async () => {
      claimed = false;
    },
  });

const owner = run();
const joined = await run();
assert.deepEqual(joined, { status: "in-progress" });
assert.equal(evaluationCalls, 1, "concurrent requests must invoke evaluation once");
releaseFirstEvaluation();
assert.deepEqual(await owner, { status: "complete", value: "artifacts" });

let failureReleased = false;
await assert.rejects(() =>
  runWithGenerationOwnership({
    claim: async () => true,
    generate: async () => {
      throw new Error("simulated_failure");
    },
    releaseAfterFailure: async () => {
      failureReleased = true;
    },
  }),
);
assert(failureReleased, "failed generation must release persisted ownership");

const now = Date.parse("2026-07-21T20:00:00.000Z");
assert(isGenerationLeaseActive({
  status: "IN_PROGRESS",
  startedAt: new Date(now - 1_000),
  now,
  leaseMs: 60_000,
}));
assert(!isGenerationLeaseActive({
  status: "IN_PROGRESS",
  startedAt: new Date(now - 60_001),
  now,
  leaseMs: 60_000,
}), "stale in-progress ownership must be reclaimable");

assert.equal(getGenerationDisposition({
  artifactsValid: true,
  status: "COMPLETE",
  startedAt: null,
  now,
  leaseMs: 60_000,
}), "complete", "valid completed artifacts must bypass evaluation");
assert.equal(getGenerationDisposition({
  artifactsValid: false,
  status: "COMPLETE",
  startedAt: null,
  now,
  leaseMs: 60_000,
}), "claim", "invalid completed artifacts must be regenerated");
assert.equal(getGenerationDisposition({
  artifactsValid: false,
  status: "IN_PROGRESS",
  startedAt: new Date(now - 1_000),
  now,
  leaseMs: 60_000,
}), "in-progress");
assert.equal(getGenerationDisposition({
  artifactsValid: false,
  status: "IN_PROGRESS",
  startedAt: new Date(now - 60_001),
  now,
  leaseMs: 60_000,
}), "claim");

let statusChecks = 0;
const waited = await waitForGenerationCompletion({
  load: async () => ({ status: ++statusChecks === 2 ? "complete" : "in-progress" }),
  sleep: async () => undefined,
  isCancelled: () => false,
  maxChecks: 3,
});
assert.equal(waited?.status, "complete");
assert.equal(statusChecks, 2, "joining client must retrieve the first owner's artifacts");

let retryCalls = 0;
const retryResult = await runWithGenerationOwnership({
  claim: async () => true,
  generate: async () => {
    retryCalls += 1;
    return "recovered";
  },
  releaseAfterFailure: async () => undefined,
});
assert.deepEqual(retryResult, { status: "complete", value: "recovered" });
assert.equal(retryCalls, 1, "a later request must retry after a true failure");

const route = await readFile("src/app/api/reports/[attemptId]/route.ts", "utf8");
const repository = await readFile("src/lib/persistence/repositories/completedAttemptRepository.ts", "utf8");
const client = await readFile("src/components/CanonicalCaseReport.tsx", "utf8");
const background = await readFile("src/lib/facultyRubric/report/clientGeneration.ts", "utf8");

assert(route.includes('status: "in-progress" as const'));
assert(route.includes("getGenerationDisposition"));
assert(route.includes("completeClaimedReportGeneration"));
assert(repository.includes("generationAttemptId: input.generationAttemptId"));
assert(repository.includes("generationStartedAt: { lt: input.staleBefore }"));
assert(client.includes("waitForExistingReport"));
assert(client.includes("REPORT_STATUS_POLL_TIMEOUT_MS"));
assert(client.includes('status === "checking" || status === "generating"'));
assert(background.includes("runServerCanonicalGeneration"));
assert(background.includes("/api/reports/"));

console.log("Report-generation ownership validation passed; concurrent evaluation calls: 1.");
