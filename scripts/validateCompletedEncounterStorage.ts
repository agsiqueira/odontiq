import assert from "node:assert/strict";

import {
  COMPLETED_ENCOUNTERS_STORAGE_KEY,
  MAX_COMPLETED_ATTEMPTS_PER_CASE,
  readCompletedEncounterAttempt,
  readCompletedEncounterStore,
  writeCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "../src/lib/localEncounter";

const values = new Map<string, string>();
const writes: Array<{ key: string; value: string }> = [];
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    writes.push({ key, value });
    values.set(key, value);
  },
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() {
    return values.size;
  },
};
Object.assign(globalThis, { window: { localStorage } });

function attempt(
  caseId: string,
  attemptId: string,
  generationStatus: "pending" | "in-progress" | "complete" | "failed" = "pending",
): CompletedEncounterAttempt {
  const timestamp = `2026-07-12T12:${attemptId.padStart(2, "0")}:00.000Z`;
  return {
    attemptId,
    caseId,
    conversationHistory: [],
    coveredFacts: [],
    coveredChecklistItems: [],
    encounterEvents: [],
    examinationsViewed: [],
    savedAt: timestamp,
    lifecycleStatus: "completed",
    facultyReportGeneration: {
      status: generationStatus,
      attemptId: `generation-${attemptId}`,
      startedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

writeCompletedEncounterAttempt(attempt("case-01", "01"));
writeCompletedEncounterAttempt(attempt("case-02", "01"));
assert.equal(readCompletedEncounterStore()["case-01"].length, 1);
assert.equal(readCompletedEncounterStore()["case-02"].length, 1);

for (let index = 2; index <= 10; index += 1) {
  writeCompletedEncounterAttempt(attempt("case-01", String(index)));
}
assert.equal(
  readCompletedEncounterStore()["case-01"].length,
  MAX_COMPLETED_ATTEMPTS_PER_CASE,
);
assert.equal(readCompletedEncounterAttempt("case-01")?.attemptId, "10");

const writesBeforeEleventh = writes.length;
writeCompletedEncounterAttempt(attempt("case-01", "11", "in-progress"));
const eleventhWrites = writes.slice(writesBeforeEleventh);
assert.equal(eleventhWrites.length, 2, "The untrimmed attempt must be written before trimming.");
assert.equal(
  (JSON.parse(eleventhWrites[0].value)["case-01"] as unknown[]).length,
  11,
);
assert.equal(readCompletedEncounterStore()["case-01"].length, 10);
assert.equal(readCompletedEncounterAttempt("case-01")?.attemptId, "11");
assert.equal(
  readCompletedEncounterStore()["case-01"].some((item) => item.attemptId === "01"),
  false,
);

const retainedAttempt = readCompletedEncounterAttempt("case-01", "5");
assert(retainedAttempt, "A retained attempt must remain addressable by attemptId.");
const updated = {
  ...retainedAttempt,
  coveredFacts: ["updated"],
};
writeCompletedEncounterAttempt(updated);
assert.equal(
  readCompletedEncounterStore()["case-01"].filter((item) => item.attemptId === "5").length,
  1,
);
assert.deepEqual(readCompletedEncounterAttempt("case-01", "5")?.coveredFacts, ["updated"]);

writeCompletedEncounterAttempt(attempt("case-03", "generating", "in-progress"));
writeCompletedEncounterAttempt(attempt("case-03", "interrupted", "failed"));
assert.deepEqual(
  readCompletedEncounterStore()["case-03"].map((item) => item.facultyReportGeneration?.status),
  ["failed", "in-progress"],
);
assert.equal(
  readCompletedEncounterAttempt("case-03")?.attemptId,
  "interrupted",
  "Dashboard-style newest selection must use the first retained attempt.",
);
assert.equal(readCompletedEncounterStore()["case-02"][0].attemptId, "01");
assert(values.has(COMPLETED_ENCOUNTERS_STORAGE_KEY));

console.log("Completed encounter storage validation passed.");
