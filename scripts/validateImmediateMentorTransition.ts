import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createFacultyGenerationAttempt,
  ensureCanonicalFacultyArtifacts,
} from "../src/lib/facultyRubric/report/clientGeneration";
import { FACULTY_RUBRIC_VERSION } from "../src/lib/facultyRubric/evaluation/state";
import type { FacultyRubricEvaluationState } from "../src/lib/facultyRubric/evaluation/state";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  createCompletedEncounterAttemptId,
  readCompletedEncounterAttempt,
  readEncounterSnapshot,
  removeEncounterSnapshot,
  writeCompletedEncounterAttempt,
  writeEncounterSnapshot,
  type CompletedEncounterAttempt,
  type LocalEncounterSnapshot,
} from "../src/lib/localEncounter";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() {
    return values.size;
  },
};
Object.assign(globalThis, {
  window: { localStorage, setTimeout },
});

const rubric = facultyRubrics.find((item) => item.caseId === "case-01");
if (!rubric) throw new Error("Case 1 rubric is required.");
const caseId = rubric.caseId;
const evaluations = rubric.criteria
  .filter((criterion) => criterion.expectation === "required")
  .map((criterion) => ({
    caseId: rubric.caseId,
    criterionId: criterion.id,
    status: "not-met" as const,
    confidence: 1,
    evidence: [],
    rationale: "No supporting evidence was found.",
    evaluationMethod: "deterministic-default" as const,
    evaluatedAt: "2026-07-12T16:00:00.000Z",
  }));
const completeEvaluation: FacultyRubricEvaluationState = {
  caseId,
  rubricVersion: FACULTY_RUBRIC_VERSION,
  transcriptRevision: "phase-1-validation",
  status: "complete",
  evaluations,
  evaluatedAt: "2026-07-12T16:00:00.000Z",
};

function createSummary(attemptId = `attempt-${Date.now()}`): CompletedEncounterAttempt {
  return {
    attemptId,
    caseId,
    conversationHistory: [],
    coveredFacts: [],
    coveredChecklistItems: [],
    encounterEvents: [],
    examinationsViewed: [],
    savedAt: new Date().toISOString(),
    lifecycleStatus: "completed",
    facultyReportGeneration: createFacultyGenerationAttempt("pending"),
  };
}

function persist(summary: CompletedEncounterAttempt) {
  writeCompletedEncounterAttempt(summary);
}

const initialSummary = createSummary("attempt-initial");
persist(initialSummary);
let resolveEvaluation!: (state: FacultyRubricEvaluationState) => void;
const deferredEvaluation = new Promise<FacultyRubricEvaluationState>(
  (resolve) => {
    resolveEvaluation = resolve;
  },
);
let evaluationCalls = 0;
const evaluate = async () => {
  evaluationCalls += 1;
  return deferredEvaluation;
};
const first = ensureCanonicalFacultyArtifacts({
  caseId,
  attemptId: initialSummary.attemptId,
  evaluate,
});
const duplicate = ensureCanonicalFacultyArtifacts({
  caseId,
  attemptId: initialSummary.attemptId,
  evaluate,
});
assert.equal(first, duplicate, "Concurrent mentor/remount calls must share one evaluation.");
assert.equal(evaluationCalls, 1);
resolveEvaluation(completeEvaluation);
const completed = await first;
assert.equal(completed.status, "complete");
assert(completed.summary.facultyRubricEvaluation);
assert(completed.summary.facultyRubricScore);
assert(completed.summary.facultyReport);

let completedRefreshCalls = 0;
const refreshed = await ensureCanonicalFacultyArtifacts({
  caseId,
  attemptId: initialSummary.attemptId,
  evaluate: async () => {
    completedRefreshCalls += 1;
    return completeEvaluation;
  },
});
assert.equal(refreshed.status, "complete");
assert.equal(completedRefreshCalls, 0, "Refresh must not regenerate valid artifacts.");

const retrySummary = createSummary("attempt-retry");
persist(retrySummary);
const siblingSummary = createSummary("attempt-newer-sibling");
persist(siblingSummary);
const failed = await ensureCanonicalFacultyArtifacts({
  caseId: rubric.caseId,
  attemptId: retrySummary.attemptId,
  evaluate: async () => {
    throw new Error("technical_failure");
  },
});
assert.equal(failed.status, "failed");
assert.equal(
  readCompletedEncounterAttempt(caseId, siblingSummary.attemptId)?.facultyReportGeneration?.status,
  "pending",
  "Retry preparation must not update another attempt for the same case.",
);
const retried = await ensureCanonicalFacultyArtifacts({
  caseId: rubric.caseId,
  attemptId: retrySummary.attemptId,
  forceRetry: true,
  evaluate: async () => completeEvaluation,
});
assert.equal(retried.status, "complete");
assert.equal(
  readCompletedEncounterAttempt(caseId, retrySummary.attemptId)?.facultyReportGeneration?.status,
  "complete",
);

const encounterSource = await readFile(
  "src/components/EncounterExperience.tsx",
  "utf8",
);
const completionStart = encounterSource.indexOf("const completeConsultation");
const completionEnd = encounterSource.indexOf(
  "const requestFinishConsultation",
  completionStart,
);
const completionSource = encounterSource.slice(completionStart, completionEnd);
assert(completionSource.indexOf("saveLocalEncounterSummary") >= 0);
assert(
  completionSource.indexOf("saveLocalEncounterSummary") <
    completionSource.indexOf("router.push"),
  "Final evidence must persist before navigation.",
);
assert(
  !completionSource.includes("await evaluateFacultyRubricForCompletion"),
  "Navigation must not await faculty evaluation.",
);
assert(completionSource.includes("isCompletingRef.current"));

const mentorSource = await readFile(
  "src/components/MentorGeneratedDebrief.tsx",
  "utf8",
);
assert(mentorSource.includes("ensureCanonicalFacultyArtifacts({ caseId, attemptId })"));
assert(mentorSource.includes("void generateDebrief({ summary, controller })"));

const finishedHistory = createSummary("completed-history");
persist(finishedHistory);
const activeSnapshot: LocalEncounterSnapshot = {
  caseId,
  conversationHistory: [],
  coveredFacts: [],
  coveredChecklistItems: [],
  encounterEvents: [],
  examinationsViewed: [],
  savedAt: "2026-07-12T17:00:00.000Z",
  lifecycleStatus: "in-progress",
  currentView: {
    communicationMode: "text",
    activePanel: "conversation",
  },
  timers: {
    activeDurationMs: 0,
    pausedDurationMs: 0,
  },
  metadata: {
    createdAt: "2026-07-12T17:00:00.000Z",
    updatedAt: "2026-07-12T17:00:00.000Z",
  },
};
writeEncounterSnapshot(activeSnapshot);
removeEncounterSnapshot(caseId);
assert.equal(readEncounterSnapshot(caseId), null, "Retry must not restore a prior snapshot.");
assert(
  readCompletedEncounterAttempt(caseId, finishedHistory.attemptId),
  "Clearing retry state must preserve completed-attempt history.",
);
assert.notEqual(
  createCompletedEncounterAttemptId(),
  createCompletedEncounterAttemptId(),
  "A newly completed retry must receive a new attempt ID.",
);

const mentorPageSource = await readFile("src/app/mentor/[caseId]/page.tsx", "utf8");
const retrySource = await readFile("src/components/RetryCaseButton.tsx", "utf8");
assert(!mentorPageSource.includes("ReturnToConsultation"));
assert(!mentorPageSource.includes("Return to Consultation"));
assert(retrySource.includes("removeEncounterSnapshot(caseId)"));
assert(
  retrySource.indexOf("removeEncounterSnapshot(caseId)") <
    retrySource.indexOf("router.push"),
  "Retry must clear resumable state before opening a new encounter.",
);

console.log("Immediate mentor transition validation passed.");
