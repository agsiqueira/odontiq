import assert from "node:assert/strict";

import type { OdontIQCase } from "../src/lib/cases";
import {
  getHomeProgression,
  isCompletedAttemptPassing,
} from "../src/lib/homeProgression";
import type {
  CompletedEncounterAttempt,
  CompletedEncounterStore,
  EncounterSnapshotIndex,
  LocalEncounterSnapshot,
} from "../src/lib/localEncounter";

const cases = Array.from({ length: 5 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `case-${number}`,
    title: `Case ${index + 1}`,
    patientName: `Patient ${index + 1}`,
  } as OdontIQCase;
});

function attempt(caseId: string, attemptId: string, percentage: number) {
  return {
    attemptId,
    caseId,
    conversationHistory: [],
    coveredFacts: [],
    coveredChecklistItems: [],
    encounterEvents: [],
    examinationsViewed: [],
    savedAt: `2026-07-12T12:0${attemptId.length}:00.000Z`,
    lifecycleStatus: "completed",
    facultyReportGeneration: {
      status: "complete",
      attemptId: `generation-${attemptId}`,
      startedAt: "2026-07-12T12:00:00.000Z",
      updatedAt: "2026-07-12T12:00:00.000Z",
    },
    facultyRubricEvaluation: { status: "complete" },
    facultyRubricScore: { status: "complete", percentage },
    facultyReport: {},
  } as unknown as CompletedEncounterAttempt;
}

const validArtifacts = () => true;
assert(isCompletedAttemptPassing(attempt("case-01", "pass", 84), validArtifacts));
assert(!isCompletedAttemptPassing(attempt("case-01", "fail", 83.9), validArtifacts));
assert(
  !isCompletedAttemptPassing(
    { ...attempt("case-01", "invalid", 100), facultyReport: undefined },
    validArtifacts,
  ),
);

const pass = (candidate: CompletedEncounterAttempt) =>
  isCompletedAttemptPassing(candidate, validArtifacts);
const store: CompletedEncounterStore = {
  "case-01": [attempt("case-01", "case1-pass", 90)],
};
let progression = getHomeProgression({
  cases,
  snapshots: {},
  completedStore: store,
  isPassed: pass,
});
assert.equal(progression.kind, "recommend");
assert.equal(progression.kind === "recommend" && progression.patientCase.id, "case-02");

store["case-02"] = [attempt("case-02", "case2-pass", 84)];
progression = getHomeProgression({ cases, snapshots: {}, completedStore: store, isPassed: pass });
assert.equal(progression.kind === "recommend" && progression.patientCase.id, "case-03");

store["case-01"].unshift(attempt("case-01", "later-failure", 20));
progression = getHomeProgression({ cases, snapshots: {}, completedStore: store, isPassed: pass });
assert.equal(
  progression.kind === "recommend" && progression.patientCase.id,
  "case-03",
  "A later failure must not relock a case with an earlier passing attempt.",
);

const paused = {
  ...attempt("case-05", "paused", 0),
  lifecycleStatus: "paused",
  currentView: { communicationMode: "text", activePanel: "conversation" },
  timers: { activeDurationMs: 1, pausedDurationMs: 1 },
  metadata: {
    createdAt: "2026-07-12T12:00:00.000Z",
    updatedAt: "2026-07-12T13:00:00.000Z",
  },
} as unknown as LocalEncounterSnapshot;
progression = getHomeProgression({
  cases,
  snapshots: { "case-05": paused } as EncounterSnapshotIndex,
  completedStore: store,
  isPassed: pass,
});
assert.equal(progression.kind, "resume");
assert.equal(progression.kind === "resume" && progression.patientCase.id, "case-05");

for (const patientCase of cases) {
  store[patientCase.id] ??= [attempt(patientCase.id, `${patientCase.id}-pass`, 100)];
}
progression = getHomeProgression({ cases, snapshots: {}, completedStore: store, isPassed: pass });
assert.equal(progression.kind, "complete");

console.log("Home progression validation passed.");
