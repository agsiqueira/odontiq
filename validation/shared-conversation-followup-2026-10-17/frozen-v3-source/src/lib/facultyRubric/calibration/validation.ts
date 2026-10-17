import { facultyRubrics } from "../caseRubrics";
import type { FacultyRubricCriterion } from "../types";
import { facultyRubricCalibration } from "./caseCalibration";
import type {
  EvaluationCoveragePolicy,
  FacultyRubricActivationPolicy,
  FacultyRubricCalibrationValidationIssue,
  FacultyRubricCalibrationValidationResult,
} from "./types";
import {
  DEFAULT_EVALUATION_COVERAGE_POLICY,
  DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
} from "./policy";

export function validateFacultyRubricCalibration(): FacultyRubricCalibrationValidationResult {
  const issues: FacultyRubricCalibrationValidationIssue[] = [];

  validateOverrides(issues);
  validateAllScoredCriteriaHaveMetadata(issues);
  validatePolicies(
    DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
    DEFAULT_EVALUATION_COVERAGE_POLICY,
    issues,
  );

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateFacultyRubricActivationPolicy(
  policy: FacultyRubricActivationPolicy,
): FacultyRubricCalibrationValidationResult {
  const issues: FacultyRubricCalibrationValidationIssue[] = [];
  validatePolicies(policy, DEFAULT_EVALUATION_COVERAGE_POLICY, issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateEvaluationCoveragePolicy(
  policy: EvaluationCoveragePolicy,
): FacultyRubricCalibrationValidationResult {
  const issues: FacultyRubricCalibrationValidationIssue[] = [];
  validatePolicies(DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY, policy, issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

function validateOverrides(
  issues: FacultyRubricCalibrationValidationIssue[],
) {
  for (const caseCalibration of facultyRubricCalibration) {
    const rubric = facultyRubrics.find(
      (candidate) => candidate.caseId === caseCalibration.caseId,
    );

    if (!rubric) {
      issues.push({
        code: "unknown-case",
        message: "Calibration references an unknown case.",
        caseId: caseCalibration.caseId,
      });
      continue;
    }

    for (const override of caseCalibration.criteria) {
      const criterion = rubric.criteria.find(
        (candidate) => candidate.id === override.criterionId,
      );

      if (!criterion) {
        issues.push({
          code: "unknown-criterion",
          message: "Calibration override references an unknown criterion.",
          caseId: caseCalibration.caseId,
          criterionId: override.criterionId,
        });
        continue;
      }

      if (override.weight !== undefined && override.weight <= 0) {
        issues.push({
          code: "invalid-weight",
          message: "Calibration weights must be positive.",
          caseId: caseCalibration.caseId,
          criterionId: override.criterionId,
        });
      }

      if (override.weight !== undefined && !isScoredCriterion(criterion)) {
        issues.push({
          code: "non-scoring-weight-override",
          message:
            "Neutral and non-scoring expected-case-state criteria cannot receive scoring overrides.",
          caseId: caseCalibration.caseId,
          criterionId: override.criterionId,
        });
      }

      if (override.source === "awaiting-clarification" && !override.rationale) {
        issues.push({
          code: "missing-rationale",
          message: "Awaiting-clarification overrides require a rationale.",
          caseId: caseCalibration.caseId,
          criterionId: override.criterionId,
        });
      }
    }
  }
}

function validateAllScoredCriteriaHaveMetadata(
  issues: FacultyRubricCalibrationValidationIssue[],
) {
  for (const rubric of facultyRubrics) {
    for (const criterion of rubric.criteria) {
      if (!isScoredCriterion(criterion)) {
        continue;
      }

      if (criterion.provisionalWeight && criterion.weight <= 0) {
        issues.push({
          code: "invalid-provisional-weight",
          message: "Provisional scored criteria must still have positive weights.",
          caseId: rubric.caseId,
          criterionId: criterion.id,
        });
      }

      if (criterion.critical && !criterion.description) {
        issues.push({
          code: "critical-missing-rationale",
          message: "Critical criteria must retain source rationale.",
          caseId: rubric.caseId,
          criterionId: criterion.id,
        });
      }
    }
  }
}

function validatePolicies(
  activationPolicy: FacultyRubricActivationPolicy,
  coveragePolicy: EvaluationCoveragePolicy,
  issues: FacultyRubricCalibrationValidationIssue[],
) {
  if (
    activationPolicy.criticalMissPolicy === "score-cap" &&
    activationPolicy.criticalMissScoreCap === undefined
  ) {
    issues.push({
      code: "missing-score-cap",
      message: "A critical miss score cap is required only for score-cap policy.",
    });
  }

  if (
    activationPolicy.criticalMissScoreCap !== undefined &&
    (activationPolicy.criticalMissScoreCap < 0 ||
      activationPolicy.criticalMissScoreCap > 100)
  ) {
    issues.push({
      code: "invalid-score-cap",
      message: "Critical miss score cap must be between 0 and 100.",
    });
  }

  if (
    coveragePolicy.minimumCoveragePercentage < 0 ||
    coveragePolicy.minimumCoveragePercentage > 100
  ) {
    issues.push({
      code: "invalid-coverage-threshold",
      message: "Minimum coverage percentage must be between 0 and 100.",
    });
  }

  if (
    coveragePolicy.maximumUncertainScoredWeight !== undefined &&
    coveragePolicy.maximumUncertainScoredWeight < 0
  ) {
    issues.push({
      code: "invalid-uncertain-weight",
      message: "Maximum uncertain scored weight cannot be negative.",
    });
  }
}

function isScoredCriterion(criterion: FacultyRubricCriterion): boolean {
  return criterion.expectation === "required" && criterion.weight > 0;
}
