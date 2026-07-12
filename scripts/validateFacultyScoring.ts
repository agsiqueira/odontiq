import assert from "node:assert/strict";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { buildFacultyComparisonSections } from "../src/lib/facultyRubric/report/comparison";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

const rubric = facultyRubrics.find((item) => item.caseId === "case-01");
if (!rubric) throw new Error("Case 1 rubric is required.");

const scoredCriteria = rubric.criteria.filter(
  (criterion) => criterion.expectation === "required" && criterion.weight > 0,
);
const expectedFor = (criterion: (typeof scoredCriteria)[number]) =>
  typeof criterion.expectedValue === "boolean"
    ? criterion.expectedValue
    : criterion.evaluationMode === "recommendation"
      ? false
      : true;

const emptyEvaluations: FacultyCriterionEvaluation[] = scoredCriteria.map(
  (criterion) => {
    const expectedValue = expectedFor(criterion);
    const conditionalChild = criterion.name === "selected-appropriate-iv-antibiotic";
    return {
      caseId: rubric.caseId,
      criterionId: criterion.id,
      status: conditionalChild
        ? "not-applicable"
        : expectedValue
          ? "not-met"
          : "met",
      confidence: 1,
      evidence: [],
      rationale: conditionalChild
        ? "Not applicable because IV antibiotics were not expected."
        : "No supporting evidence was found.",
      evaluationMethod: "deterministic-default",
      evaluatedAt: "2026-07-12T18:00:00.000Z",
      expectedValue,
      observedValue: expectedValue ? false : false,
    };
  },
);

const emptyScore = scoreFacultyRubricEvaluations({
  caseId: rubric.caseId,
  evaluations: emptyEvaluations,
});
assert.equal(emptyScore.earnedPoints, 0);
assert.equal(emptyScore.penaltyPoints, 0);
assert.equal(emptyScore.adjustedPoints, 0);
assert.equal(emptyScore.percentage, 0, "Empty encounter must score 0%.");
assert(emptyScore.totalExpectedCriteria > 0);

const expectedCriterion = scoredCriteria.find(expectedFor);
if (!expectedCriterion) throw new Error("Expected criterion is required.");
const withExpectedMet = emptyEvaluations.map((evaluation) =>
  evaluation.criterionId === expectedCriterion.id
    ? {
        ...evaluation,
        status: "met" as const,
        observedValue: true,
        evidence: [
          {
            source: "student-message" as const,
            messageId: "expected-met",
            excerpt: "Targeted expected behavior.",
          },
        ],
      }
    : evaluation,
);
const expectedMetScore = scoreFacultyRubricEvaluations({
  caseId: rubric.caseId,
  evaluations: withExpectedMet,
});
assert.equal(expectedMetScore.earnedPoints, 1);
assert.equal(expectedMetScore.adjustedPoints, 1);

const expectedMissScore = scoreFacultyRubricEvaluations({
  caseId: rubric.caseId,
  evaluations: emptyEvaluations,
});
assert.equal(expectedMissScore.earnedPoints, 0);

const negativeRecommendation = scoredCriteria.find(
  (criterion) =>
    criterion.evaluationMode === "recommendation" &&
    criterion.name !== "selected-appropriate-iv-antibiotic",
);
if (!negativeRecommendation) {
  throw new Error("Not-expected recommendation is required.");
}
const avoidedScore = scoreFacultyRubricEvaluations({
  caseId: rubric.caseId,
  evaluations: withExpectedMet,
});
assert.equal(avoidedScore.penaltyPoints, 0);

const incorrectlyRecommended = withExpectedMet.map((evaluation) =>
  evaluation.criterionId === negativeRecommendation.id
    ? {
        ...evaluation,
        status: "not-met" as const,
        observedValue: true,
      }
    : evaluation,
);
const penalizedScore = scoreFacultyRubricEvaluations({
  caseId: rubric.caseId,
  evaluations: incorrectlyRecommended,
});
assert.equal(penalizedScore.earnedPoints, 1);
assert.equal(penalizedScore.penaltyPoints, 1);
assert.equal(penalizedScore.adjustedPoints, 0);
assert.equal(penalizedScore.percentage, 0);

const onlyIncorrectRecommendation = emptyEvaluations.map((evaluation) =>
  evaluation.criterionId === negativeRecommendation.id
    ? { ...evaluation, status: "not-met" as const, observedValue: true }
    : evaluation,
);
assert.equal(
  scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: onlyIncorrectRecommendation,
  }).adjustedPoints,
  0,
  "Adjusted score must never be negative.",
);

const childId = scoredCriteria.find(
  (criterion) => criterion.name === "selected-appropriate-iv-antibiotic",
)?.id;
if (!childId) throw new Error("Conditional antibiotic child is required.");
const childIncorrect = emptyEvaluations.map((evaluation) =>
  evaluation.criterionId === childId
    ? { ...evaluation, status: "not-met" as const, observedValue: true }
    : evaluation,
);
assert.equal(
  scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: childIncorrect,
  }).penaltyPoints,
  0,
  "Conditional child must not duplicate its not-expected parent penalty.",
);

const report = buildFacultyReport({
  rubric,
  completedEvaluations: incorrectlyRecommended,
  score: penalizedScore,
  generatedAt: "2026-07-12T18:01:00.000Z",
});
assert.equal(report.overallScore.percentage, penalizedScore.percentage);
assert.equal(report.criterionResults.length, scoredCriteria.length);

const comparison = buildFacultyComparisonSections(
  rubric.caseId,
  incorrectlyRecommended,
);
const recommendationRow = comparison
  .flatMap((section) => section.rows)
  .find((row) => row.criterionId === negativeRecommendation.id);
assert.equal(recommendationRow?.result, "Incorrect recommendation");

console.log("Faculty scoring validation passed.");
