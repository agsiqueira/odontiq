import assert from "node:assert/strict";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { buildFacultyComparisonSections } from "../src/lib/facultyRubric/report/comparison";
import { getAuthoredExpectedValue } from "../src/lib/facultyRubric/report/comparison";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

const rubric = facultyRubrics.find((item) => item.caseId === "case-01");
if (!rubric) throw new Error("Case 1 rubric is required.");

const scoredCriteria = rubric.criteria.filter(
  (criterion) => criterion.expectation === "required" && criterion.weight > 0,
);
const expectedFor = (criterion: (typeof scoredCriteria)[number]) =>
  getAuthoredExpectedValue(criterion);

const emptyEvaluations: FacultyCriterionEvaluation[] = scoredCriteria.map(
  (criterion) => {
    const expectedValue = expectedFor(criterion);
    return {
      caseId: rubric.caseId,
      criterionId: criterion.id,
      status: expectedValue ? "not-met" : "met",
      confidence: 1,
      evidence: [],
      rationale: "No supporting evidence was found.",
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

const positiveRecommendation = scoredCriteria.find(
  (criterion) => criterion.evaluationMode === "recommendation",
);
assert(positiveRecommendation, "A positive Case 1 recommendation is required.");
assert.equal(getAuthoredExpectedValue(positiveRecommendation), true);

const report = buildFacultyReport({
  rubric,
  completedEvaluations: withExpectedMet,
  score: expectedMetScore,
  generatedAt: "2026-07-12T18:01:00.000Z",
});
assert.equal(report.overallScore.percentage, expectedMetScore.percentage);
assert.equal(report.criterionResults.length, scoredCriteria.length);

const comparison = buildFacultyComparisonSections(
  rubric.caseId,
  withExpectedMet,
);
const recommendationRow = comparison
  .flatMap((section) => section.rows)
  .find((row) => row.criterionId === positiveRecommendation.id);
assert.equal(recommendationRow?.expected, "Yes");

console.log("Faculty scoring validation passed.");
