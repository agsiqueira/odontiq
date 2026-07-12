import { getResolvedFacultyRubricCalibration } from "../calibration";
import { facultyRubrics } from "../caseRubrics";
import { getAuthoredExpectedValue } from "../report/comparison";
import type { FacultyCriterionEvaluation } from "./types";

export function finalizeMissingSupportedCriteria({
  caseId,
  evaluations,
  evaluatedAt,
}: {
  caseId: string;
  evaluations: FacultyCriterionEvaluation[];
  evaluatedAt: string;
}) {
  const supported = getResolvedFacultyRubricCalibration(caseId).filter(
    (criterion) => criterion.scored && criterion.supported,
  );
  const existing = new Set(
    evaluations
      .filter((evaluation) => evaluation.caseId === caseId)
      .map((evaluation) => evaluation.criterionId),
  );

  return [
    ...evaluations,
    ...supported
      .filter((criterion) => !existing.has(criterion.criterionId))
      .map((criterion) => ({
        caseId,
        criterionId: criterion.criterionId,
        status: "not-met" as const,
        confidence: 1,
        evidence: [],
        rationale: "No supporting evidence was found in the completed encounter.",
        evaluationMethod: "deterministic-default" as const,
        evaluatedAt,
      })),
  ];
}

export function normalizeBidirectionalEvaluations({
  caseId,
  evaluations,
}: {
  caseId: string;
  evaluations: FacultyCriterionEvaluation[];
}) {
  const rubric = facultyRubrics.find((item) => item.caseId === caseId);
  if (!rubric) return evaluations;
  const criteriaById = new Map(rubric.criteria.map((item) => [item.id, item]));
  const ivParent = rubric.criteria.find(
    (item) => item.name === "recommended-iv-antibiotics",
  );

  return evaluations.map((evaluation) => {
    const criterion = criteriaById.get(evaluation.criterionId);
    if (!criterion || criterion.evaluationMode !== "recommendation") {
      return evaluation;
    }
    const expectedValue = getAuthoredExpectedValue(criterion);
    const observedValue =
      evaluation.status === "uncertain" ? undefined : evaluation.status === "met";
    if (
      criterion.name === "selected-appropriate-iv-antibiotic" &&
      ivParent &&
      !getAuthoredExpectedValue(ivParent)
    ) {
      return {
        ...evaluation,
        status: "not-applicable" as const,
        expectedValue,
        observedValue,
        rationale: "Not applicable because IV antibiotics were not expected.",
      };
    }
    if (observedValue === undefined) {
      return { ...evaluation, expectedValue };
    }
    return {
      ...evaluation,
      expectedValue,
      observedValue,
      status: expectedValue === observedValue ? ("met" as const) : ("not-met" as const),
    };
  });
}
