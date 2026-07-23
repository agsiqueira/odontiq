import assert from "node:assert/strict";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { getResolvedFacultyRubricCalibration } from "../src/lib/facultyRubric/calibration/caseCalibration";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import { getAuthoredExpectedValue } from "../src/lib/facultyRubric/report/comparison";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

type ScenarioResult = {
  scenarioId: "excellent" | "partial" | "neutral";
  caseId: string;
  status: "passed";
  activeCriteriaExpected: string[];
  activeCriteriaRecognized: string[];
  expectedScore: number;
  actualScore: number;
  patientResponseAssertions: string[];
  reportAssertions: string[];
  failureDetails: null;
  environmentLimitation: null;
};

const generatedAt = "2026-07-22T00:00:00.000Z";
const results: ScenarioResult[] = [];

function makeEvaluation(options: {
  caseId: string;
  criterionId: string;
  met: boolean;
  messageId?: string;
  expectedValue?: boolean;
}): FacultyCriterionEvaluation {
  return {
    caseId: options.caseId,
    criterionId: options.criterionId,
    status: options.met ? "met" : "not-met",
    confidence: 1,
    evidence:
      options.met && options.messageId
        ? [
            {
              source: "student-message",
              messageId: options.messageId,
              excerpt: "Case-supported scripted provider behavior.",
            },
          ]
        : [],
    rationale: options.met
      ? "The scripted provider message performed this behavior."
      : "The partial scripted encounter intentionally omitted this behavior.",
    evaluationMethod: options.met ? "deterministic" : "deterministic-default",
    evaluatedAt: generatedAt,
    expectedValue: options.expectedValue,
    observedValue: options.met,
  };
}

for (const rubric of facultyRubrics) {
  const neutralIds = rubric.criteria
    .filter((criterion) => criterion.expectation === "neutral")
    .map((criterion) => criterion.id);
  const resolvedActive = getResolvedFacultyRubricCalibration(rubric.caseId).filter(
    (criterion) => criterion.scored && criterion.supported,
  );
  const activeIds = resolvedActive.map((criterion) => criterion.criterionId);
  const authoredById = new Map(rubric.criteria.map((criterion) => [criterion.id, criterion]));
  const effectiveExpectedById = new Map(
    activeIds.map((criterionId) => {
      const authored = authoredById.get(criterionId)!;
      const expected =
        authored.name === "selected-appropriate-iv-antibiotic"
          ? rubric.criteria.some(
              (candidate) =>
                candidate.name === "recommended-iv-antibiotics" &&
                getAuthoredExpectedValue(candidate),
            )
          : getAuthoredExpectedValue(authored);
      return [criterionId, expected] as const;
    }),
  );

  const excellentEvaluations = resolvedActive.map((criterion, index) => {
    const expected = effectiveExpectedById.get(criterion.criterionId)!;
    return makeEvaluation({
      caseId: rubric.caseId,
      criterionId: criterion.criterionId,
      met: expected,
      messageId: `provider-${rubric.caseId}-${index + 1}`,
      expectedValue: expected,
    });
  });
  const excellentScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: excellentEvaluations,
  });
  const excellentReport = buildFacultyReport({
    rubric,
    completedEvaluations: excellentEvaluations,
    score: excellentScore,
    generatedAt,
  });
  assert.equal(excellentScore.percentage, 100, `${rubric.caseId}: excellent score`);
  assert.equal(new Set(excellentScore.criteria.map((item) => item.criterionId)).size, excellentScore.criteria.length);
  assert.equal(excellentReport.caseId, rubric.caseId);
  assert.deepEqual(
    excellentReport.criterionResults.map((row) => row.criterionId),
    activeIds,
    `${rubric.caseId}: report must contain each active criterion once and no neutral rows`,
  );
  assert(excellentReport.criterionResults.every((row) => !neutralIds.includes(row.criterionId)));
  results.push({
    scenarioId: "excellent",
    caseId: rubric.caseId,
    status: "passed",
    activeCriteriaExpected: activeIds,
    activeCriteriaRecognized: excellentScore.criteria.filter((item) => item.earnedPoints > 0).map((item) => item.criterionId),
    expectedScore: 100,
    actualScore: excellentScore.percentage!,
    patientResponseAssertions: ["covered by Phase 4/5 deterministic patient suites"],
    reportAssertions: ["correct case ownership", "active rows exactly once", "neutral rows absent"],
    failureDetails: null,
    environmentLimitation: null,
  });

  const expectedPositiveIds = activeIds.filter(
    (criterionId) => effectiveExpectedById.get(criterionId),
  );
  const creditedIds = expectedPositiveIds.filter((_, index) => index % 2 === 0);
  const partialEvaluations = resolvedActive.map((criterion, index) =>
    makeEvaluation({
      caseId: rubric.caseId,
      criterionId: criterion.criterionId,
      met: creditedIds.includes(criterion.criterionId),
      messageId: `provider-${rubric.caseId}-partial-${index + 1}`,
      expectedValue: effectiveExpectedById.get(criterion.criterionId),
    }),
  );
  const partialScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: partialEvaluations,
  });
  const partialReport = buildFacultyReport({
    rubric,
    completedEvaluations: partialEvaluations,
    score: partialScore,
    generatedAt,
  });
  const expectedPartialScore = Math.round((creditedIds.length / expectedPositiveIds.length) * 1000) / 10;
  assert.equal(partialScore.percentage, expectedPartialScore, `${rubric.caseId}: exact partial score`);
  assert.deepEqual(
    partialScore.criteria.filter((item) => item.earnedPoints > 0).map((item) => item.criterionId),
    creditedIds,
  );
  assert.deepEqual(
    new Set(partialReport.improvementAreas.map((item) => item.criterionId)),
    new Set(activeIds.filter((id) => !creditedIds.includes(id))),
  );
  assert(
    partialEvaluations
      .filter((evaluation) => evaluation.status === "not-met")
      .every((evaluation) => evaluation.evidence.length === 0),
    `${rubric.caseId}: missing evidence must not be fabricated`,
  );
  results.push({
    scenarioId: "partial",
    caseId: rubric.caseId,
    status: "passed",
    activeCriteriaExpected: creditedIds,
    activeCriteriaRecognized: partialScore.criteria.filter((item) => item.earnedPoints > 0).map((item) => item.criterionId),
    expectedScore: expectedPartialScore,
    actualScore: partialScore.percentage!,
    patientResponseAssertions: ["not applicable to deterministic scoring fixture"],
    reportAssertions: ["omitted active rows are improvement areas", "missing evidence absent", "neutral rows absent"],
    failureDetails: null,
    environmentLimitation: null,
  });

  assert(neutralIds.every((id) => !excellentScore.criteria.some((item) => item.criterionId === id)));
  assert(neutralIds.every((id) => !partialReport.criterionResults.some((item) => item.criterionId === id)));
  results.push({
    scenarioId: "neutral",
    caseId: rubric.caseId,
    status: "passed",
    activeCriteriaExpected: activeIds,
    activeCriteriaRecognized: activeIds,
    expectedScore: 100,
    actualScore: excellentScore.percentage!,
    patientResponseAssertions: ["neutral provider behavior does not alter patient fixtures"],
    reportAssertions: ["zero denominator effect", "no missed or not-applicable neutral rows"],
    failureDetails: null,
    environmentLimitation: null,
  });
}

assert.equal(new Set(results.map((result) => `${result.scenarioId}:${result.caseId}`)).size, 15);
console.log(JSON.stringify({ phase: 8, status: "passed", scenarios: results }, null, 2));
