import {
  FACULTY_RUBRIC_SCORING_VERSION,
  scoreFacultyRubricEvaluations,
  type FacultyRubricScore,
} from "../scoring";
import {
  getResolvedFacultyRubricCalibration,
} from "../calibration";
import {
  FACULTY_RUBRIC_VERSION,
  type FacultyRubricEvaluationState,
} from "../evaluation/state";

import type { FacultyReport } from "./types";
import { validateFacultyReport } from "./validation";

export type FacultyArtifactIntegrityStatus = "valid" | "stale" | "invalid";

export type FacultyArtifactIntegrityResult = {
  status: FacultyArtifactIntegrityStatus;
  errors: string[];
  warnings: string[];
};

export type ValidatePersistedFacultyArtifactsInput = {
  caseId: string;
  evaluation?: FacultyRubricEvaluationState;
  score?: FacultyRubricScore;
  report?: FacultyReport;
};

export function validatePersistedFacultyArtifacts({
  caseId,
  evaluation,
  score,
  report,
}: ValidatePersistedFacultyArtifactsInput): FacultyArtifactIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let stale = false;

  if (!evaluation) {
    errors.push("missing-evaluation-artifact");
  }
  if (!score) {
    errors.push("missing-score-artifact");
  }
  if (!report) {
    errors.push("missing-report-artifact");
  }

  if (!evaluation || !score || !report) {
    return { status: "invalid", errors, warnings };
  }

  if (evaluation.caseId !== caseId) {
    errors.push(`case-mismatch:evaluation:${evaluation.caseId}`);
  }
  if (score.caseId !== caseId) {
    errors.push(`case-mismatch:score:${score.caseId}`);
  }
  if (report.caseId !== caseId) {
    errors.push(`case-mismatch:report:${report.caseId}`);
  }

  if (evaluation.rubricVersion !== FACULTY_RUBRIC_VERSION) {
    stale = true;
    warnings.push(`stale-evaluation-rubric-version:${evaluation.rubricVersion}`);
  }
  if (score.rubricVersion !== FACULTY_RUBRIC_VERSION) {
    stale = true;
    warnings.push(`stale-score-rubric-version:${score.rubricVersion}`);
  }
  if (report.rubricVersion !== FACULTY_RUBRIC_VERSION) {
    stale = true;
    warnings.push(`stale-report-rubric-version:${report.rubricVersion}`);
  }
  if (score.scoringVersion !== FACULTY_RUBRIC_SCORING_VERSION) {
    stale = true;
    warnings.push(`stale-score-scoring-version:${score.scoringVersion}`);
  }
  if (report.scoringVersion !== FACULTY_RUBRIC_SCORING_VERSION) {
    stale = true;
    warnings.push(`stale-report-scoring-version:${report.scoringVersion}`);
  }

  validateCriterionCoverage({ caseId, evaluation, score, report, errors });
  validateScoreAgreement({ caseId, evaluation, score, errors });
  validateReportAgreement({ report, score, errors });

  if (errors.length > 0) {
    return { status: "invalid", errors, warnings };
  }

  return {
    status: stale ? "stale" : "valid",
    errors,
    warnings,
  };
}

function validateCriterionCoverage({
  caseId,
  evaluation,
  score,
  report,
  errors,
}: {
  caseId: string;
  evaluation: FacultyRubricEvaluationState;
  score: FacultyRubricScore;
  report: FacultyReport;
  errors: string[];
}) {
  const supportedCriterionIds = getSupportedScoredCriterionIds(caseId);
  const evaluationCounts = countIds(
    evaluation.evaluations
      .filter((item) => item.caseId === caseId)
      .map((item) => item.criterionId),
  );
  const scoreCriterionIds = score.criteria.map((criterion) => criterion.criterionId);
  const reportCriterionIds = report.criterionResults.map((criterion) => criterion.criterionId);

  for (const criterionId of supportedCriterionIds) {
    if ((evaluationCounts.get(criterionId) ?? 0) !== 1) {
      errors.push(`evaluation-count:${criterionId}:${evaluationCounts.get(criterionId) ?? 0}`);
    }
    if (!scoreCriterionIds.includes(criterionId)) {
      errors.push(`score-missing-supported-criterion:${criterionId}`);
    }
    if (!reportCriterionIds.includes(criterionId)) {
      errors.push(`report-missing-supported-criterion:${criterionId}`);
    }
  }

  for (const criterionId of findDuplicates(scoreCriterionIds)) {
    errors.push(`score-duplicate-criterion:${criterionId}`);
  }
  for (const criterionId of findDuplicates(reportCriterionIds)) {
    errors.push(`report-duplicate-criterion:${criterionId}`);
  }

  const allKnownCriterionIds = new Set(
    getResolvedFacultyRubricCalibration(caseId).map((criterion) => criterion.criterionId),
  );
  for (const criterionId of [...scoreCriterionIds, ...reportCriterionIds]) {
    if (!allKnownCriterionIds.has(criterionId)) {
      errors.push(`unknown-criterion:${criterionId}`);
    }
  }

  for (const criterion of getResolvedFacultyRubricCalibration(caseId)) {
    if (!criterion.scored || !criterion.supported) {
      if (scoreCriterionIds.includes(criterion.criterionId)) {
        errors.push(`unsupported-or-nonscored-in-score:${criterion.criterionId}`);
      }
      if (reportCriterionIds.includes(criterion.criterionId)) {
        errors.push(`unsupported-or-nonscored-in-report:${criterion.criterionId}`);
      }
    }
  }
}

function validateScoreAgreement({
  caseId,
  evaluation,
  score,
  errors,
}: {
  caseId: string;
  evaluation: FacultyRubricEvaluationState;
  score: FacultyRubricScore;
  errors: string[];
}) {
  const expectedScore = scoreFacultyRubricEvaluations({
    caseId,
    evaluations: evaluation.evaluations,
  });

  compareScoreField(score, expectedScore, "status", errors);
  compareScoreField(score, expectedScore, "earnedPoints", errors);
  compareScoreField(score, expectedScore, "penaltyPoints", errors);
  compareScoreField(score, expectedScore, "adjustedPoints", errors);
  compareScoreField(score, expectedScore, "totalExpectedCriteria", errors);
  compareScoreField(score, expectedScore, "possiblePoints", errors);
  compareScoreField(score, expectedScore, "rawPercentage", errors);
  compareScoreField(score, expectedScore, "percentage", errors);
  compareScoreField(score, expectedScore, "passStatus", errors);
  compareStringArray(score.criticalMissCriterionIds, expectedScore.criticalMissCriterionIds, "critical-miss", errors);
  compareStringArray(
    score.criticalUncertainCriterionIds,
    expectedScore.criticalUncertainCriterionIds,
    "critical-uncertain",
    errors,
  );
  compareStringArray(score.uncertainCriterionIds, expectedScore.uncertainCriterionIds, "uncertain", errors);
  compareStringArray(
    score.technicalValidationErrors,
    expectedScore.technicalValidationErrors,
    "technical-validation",
    errors,
  );
}

function validateReportAgreement({
  report,
  score,
  errors,
}: {
  report: FacultyReport;
  score: FacultyRubricScore;
  errors: string[];
}) {
  const reportValidation = validateFacultyReport({
    report,
    rubric: {
      caseId: report.caseId,
      rubricVersion: report.rubricVersion,
      criteria: report.criterionResults.map((criterion) => ({
        id: criterion.criterionId,
        title: criterion.title,
        competency: criterion.competency,
        critical: criterion.critical,
        learnerDescription: criterion.learnerDescription,
      })),
    },
    completedEvaluations: [],
    score,
  });

  for (const error of reportValidation.errors) {
    errors.push(`report-validation:${error}`);
  }

  if (report.overallScore.percentage !== score.percentage) {
    errors.push("report-score-percentage-mismatch");
  }
  if (report.passStatus !== score.passStatus) {
    errors.push("report-pass-status-mismatch");
  }
}

function getSupportedScoredCriterionIds(caseId: string) {
  return getResolvedFacultyRubricCalibration(caseId)
    .filter((criterion) => criterion.scored && criterion.supported)
    .map((criterion) => criterion.criterionId);
}

function countIds(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function findDuplicates(values: string[]) {
  const counts = countIds(values);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function compareScoreField<K extends keyof FacultyRubricScore>(
  actual: FacultyRubricScore,
  expected: FacultyRubricScore,
  field: K,
  errors: string[],
) {
  if (actual[field] !== expected[field]) {
    errors.push(`score-field-mismatch:${String(field)}`);
  }
}

function compareStringArray(
  actual: string[],
  expected: string[],
  label: string,
  errors: string[],
) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) {
    errors.push(`score-array-mismatch:${label}`);
  }
}
