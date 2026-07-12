import assert from "node:assert/strict";

import { buildEncounterDocument } from "../src/lib/encounter/encounterDocumentBuilder";

const input = {
  serverEncounterId: "server-encounter-1",
  caseId: "case-01",
  attemptId: "attempt-1",
  encounterVersion: 1,
  messages: [
    {
      id: "message-1",
      role: "student" as const,
      text: "What brings you in?",
      timestamp: "2026-07-12T10:00:00.000Z",
    },
    {
      id: "message-2",
      role: "patient" as const,
      text: "My jaw is swollen.",
      timestamp: "2026-07-12T10:00:01.000Z",
    },
  ],
  examinationIds: ["extraoral", "intraoral"],
  lifecycleEvents: [
    {
      type: "student_message_sent",
      timestamp: "2026-07-12T10:00:00.000Z",
      payload: { messageId: "message-1", detail: { source: "text" } },
    },
    {
      type: "examination_viewed",
      timestamp: "2026-07-12T10:00:02.000Z",
      payload: { examinationId: "extraoral" },
    },
  ],
  disclosedFacts: ["jaw-swelling", "pain"],
  coveredChecklistItemIds: ["chief-complaint", "swelling"],
  coverageEvidence: [
    {
      checklistItemId: "chief-complaint",
      source: "student_message" as const,
      evidence: "What brings you in?",
      timestamp: "2026-07-12T10:00:00.000Z",
    },
  ],
  activeDurationMs: 120_000,
  pausedDurationMs: 5_000,
  startedAt: "2026-07-12T09:59:00.000Z",
  completedAt: "2026-07-12T10:05:00.000Z",
  createdAt: "2026-07-12T09:59:00.000Z",
  updatedAt: "2026-07-12T10:05:00.000Z",
};

const inputBefore = JSON.stringify(input);
const first = buildEncounterDocument(input);
const second = buildEncounterDocument(input);

assert.deepEqual(first, second, "identical inputs must produce equal documents");
assert.equal(JSON.stringify(input), inputBefore, "builder must not mutate inputs");
assert.equal(first.schemaVersion, 1);
assert.equal(first.serverEncounterId, input.serverEncounterId);
assert.equal(first.attemptId, input.attemptId);
assert.deepEqual(first.messages, input.messages);
assert.deepEqual(first.examinations, input.examinationIds);
assert.deepEqual(first.lifecycleEvents, input.lifecycleEvents);
assert.deepEqual(first.disclosedFacts, input.disclosedFacts);
assert.deepEqual(first.checklistCoverage.itemIds, input.coveredChecklistItemIds);
assert.deepEqual(first.checklistCoverage.evidence, input.coverageEvidence);
assert.deepEqual(first.messages.map((item) => item.id), ["message-1", "message-2"]);
assert.deepEqual(first.examinations, ["extraoral", "intraoral"]);
assert.deepEqual(first.lifecycleEvents.map((item) => item.type), [
  "student_message_sent",
  "examination_viewed",
]);

input.messages[0].text = "Changed after build";
(input.lifecycleEvents[0]!.payload.detail as { source: string }).source = "voice";
assert.equal(first.messages[0].text, "What brings you in?");
assert.deepEqual(first.lifecycleEvents[0].payload?.detail, { source: "text" });

const withUiOnlyFields = buildEncounterDocument({
  ...input,
  scrollPosition: 400,
  openDialog: "pause",
  selectedTab: "exam",
  draftQuestion: "UI-only draft",
  isListening: true,
} as typeof input);
const serializedWithUiFields = JSON.stringify(withUiOnlyFields);
for (const excluded of [
  "scrollPosition",
  "openDialog",
  "selectedTab",
  "draftQuestion",
  "isListening",
]) {
  assert(!serializedWithUiFields.includes(excluded));
}

const minimal = buildEncounterDocument({
  caseId: "case-02",
  encounterVersion: 1,
  messages: [],
  examinationIds: [],
  lifecycleEvents: [],
  disclosedFacts: [],
  coveredChecklistItemIds: [],
  createdAt: "2026-07-12T11:00:00.000Z",
  updatedAt: "2026-07-12T11:00:00.000Z",
});
assert.equal(minimal.serverEncounterId, undefined);
assert.equal(minimal.attemptId, undefined);
assert.deepEqual(minimal.checklistCoverage.evidence, []);
assert.deepEqual(minimal.timing, {
  activeDurationMs: 0,
  pausedDurationMs: 0,
});
assert.doesNotThrow(() => JSON.parse(JSON.stringify(first)));
assert.doesNotThrow(() => JSON.parse(JSON.stringify(minimal)));

console.log("Encounter-document validation passed.");
