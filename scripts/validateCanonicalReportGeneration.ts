import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  finalizeMissingSupportedCriteria,
  normalizeBidirectionalEvaluations,
} from "../src/lib/facultyRubric/evaluation/finalization";
import { evaluateFacultySemanticWithRetry } from "../src/lib/facultyRubric/evaluation/retry";
import { parseAndValidateAiFacultyEvaluationResponse } from "../src/lib/facultyRubric/evaluation/semanticSchema";
import { validateFacultyCriterionEvaluations } from "../src/lib/facultyRubric/evaluation/validation";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import { buildCanonicalFacultyReportPresentation } from "../src/lib/facultyRubric/report/presentation";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";
import type { LocalEncounterSummary } from "../src/lib/localEncounter";

const caseId = "case-01";
const rubric = facultyRubrics.find((item) => item.caseId === caseId);
assert(rubric, "Case 1 rubric is required.");

const encounter = {
  caseId,
  conversationHistory: [
    {
      id: "student-1",
      role: "student" as const,
      text: "What brings you in?",
      timestamp: "2026-07-12T12:00:00.000Z",
    },
    {
      id: "patient-1",
      role: "patient" as const,
      text: "My mouth hurts.",
      timestamp: "2026-07-12T12:00:01.000Z",
    },
  ],
  encounterEvents: [],
  coveredChecklistItems: [],
};

const supportedCriterionIds = rubric.criteria
  .filter((criterion) => criterion.expectation === "required")
  .map((criterion) => criterion.id);
const rejectedResponse = JSON.stringify({
  results: supportedCriterionIds.map((criterionId) => ({
        criterionId,
        status: "met",
        confidence: 0.9,
        learnerEvidenceMessageIds: ["missing-learner-message"],
        contextualPatientMessageIds: [],
        evidenceExcerpts: [],
        rationale: "Rejected validation fixture.",
  })),
});
const parsedRejected = parseAndValidateAiFacultyEvaluationResponse({
  text: rejectedResponse,
  requestedCriterionIds: supportedCriterionIds,
  messages: encounter.conversationHistory.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.text,
  })),
});
assert(parsedRejected.success, "Valid top-level response must parse.");
assert.equal(parsedRejected.results.length, 0);
assert(parsedRejected.issues.length > 0);

const acceptedSemanticEvaluations = supportedCriterionIds
  .slice(0, -3)
  .map((criterionId) => ({
    caseId,
    criterionId,
    status: "not-met" as const,
    confidence: 1,
    evidence: [],
    rationale: "No supporting learner evidence was returned.",
    evaluationMethod: "ai-semantic" as const,
    evaluatedAt: "2026-07-12T12:00:02.000Z",
  }));
const rejectedSemanticItems = supportedCriterionIds.slice(-3).map(
  (criterionId, index) => ({
    criterionId,
    code:
      index === 0
        ? "unsupported-targeted-evidence"
        : "met-without-evidence",
  }),
);
assert.equal(acceptedSemanticEvaluations.length, supportedCriterionIds.length - 3);
assert.equal(rejectedSemanticItems.length, 3);

const completedEvaluations = normalizeBidirectionalEvaluations({
  caseId,
  evaluations: finalizeMissingSupportedCriteria({
    caseId,
    evaluations: acceptedSemanticEvaluations,
    evaluatedAt: "2026-07-12T12:00:02.000Z",
  }),
});
assert.equal(completedEvaluations.length, supportedCriterionIds.length);
const completedValidation = validateFacultyCriterionEvaluations(
  completedEvaluations,
);
assert(
  completedValidation.valid,
  `Finalized evaluation should be complete: ${completedValidation.issues
    .map((issue) => `${issue.code}:${issue.criterionId ?? "unknown"}`)
    .join(",")}`,
);
const evaluationStatus = completedValidation.valid ? "complete" : "partial";
assert.equal(evaluationStatus, "complete");
assert(
  completedEvaluations.some(
    (evaluation) => evaluation.evaluationMethod === "deterministic-default",
  ),
  "Rejected semantic findings must finalize through deterministic defaults.",
);

const airwayRecommendation = completedEvaluations.find(
  (evaluation) => evaluation.criterionId === "C1-MP-001",
);
assert.deepEqual(
  {
    expectedValue: airwayRecommendation?.expectedValue,
    observedValue: airwayRecommendation?.observedValue,
    status: airwayRecommendation?.status,
  },
  { expectedValue: false, observedValue: false, status: "met" },
  "Expected-negative recommendation must score as correctly avoided.",
);
const antibioticChoice = completedEvaluations.find(
  (evaluation) => evaluation.criterionId === "C1-MP-004",
);
assert.equal(antibioticChoice?.status, "not-applicable");

const score = scoreFacultyRubricEvaluations({
  caseId,
  evaluations: completedEvaluations,
});
assert.notEqual(score.passStatus, "technical-invalid");
const antibioticChoiceScore = score.criteria.find(
  (criterion) => criterion.criterionId === "C1-MP-004",
);
assert.equal(antibioticChoiceScore?.earnedPoints, 0);
assert.equal(antibioticChoiceScore?.possiblePoints, 0);
const report = buildFacultyReport({
  rubric,
  completedEvaluations,
  score,
  generatedAt: "2026-07-12T12:01:00.000Z",
});
assert.equal(report.criterionResults.length, supportedCriterionIds.length);
const summary: LocalEncounterSummary = {
  ...encounter,
  coveredFacts: [],
  examinationsViewed: [],
  savedAt: "2026-07-12T12:01:00.000Z",
  facultyRubricEvaluation: {
    caseId,
    rubricVersion: score.rubricVersion,
    transcriptRevision: "canonical-report-regression",
    status: "complete",
    evaluations: completedEvaluations,
    evaluatedAt: "2026-07-12T12:00:02.000Z",
  },
  facultyRubricScore: score,
  facultyReport: report,
};
const reloaded = JSON.parse(JSON.stringify(summary)) as LocalEncounterSummary;
assert(
  buildCanonicalFacultyReportPresentation(
    reloaded,
    "Validation patient",
    "Validation case",
  ),
  "Persisted canonical artifacts must reload into the report presentation.",
);

let retryAttempts = 0;
const retrySucceeded = await evaluateFacultySemanticWithRetry({
  evaluate: async () => {
    retryAttempts += 1;
    if (retryAttempts === 1) throw new Error("simulated_network_failure");
    return "complete";
  },
});
assert.equal(retryAttempts, 2);
assert.equal(retrySucceeded, "complete");

let providerFailureAttempts = 0;
await assert.rejects(() =>
  evaluateFacultySemanticWithRetry({
    evaluate: async () => {
      providerFailureAttempts += 1;
      throw new Error("simulated_provider_failure");
    },
  }),
);
assert.equal(providerFailureAttempts, 2);

const malformedTopLevel = parseAndValidateAiFacultyEvaluationResponse({
  text: "not-json",
  requestedCriterionIds: supportedCriterionIds,
  messages: [],
});
assert.equal(malformedTopLevel.success, false);

const reportComponent = await readFile(
  "src/components/CanonicalCaseReport.tsx",
  "utf8",
);
assert(
  reportComponent.includes("Report generation was interrupted. Please try again."),
  "True technical failure must retain the interrupted report message.",
);

console.log("Canonical report-generation regression validation passed.");
