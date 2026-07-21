import type {
  FacultyReport,
  FacultyReportEvaluation,
  FacultyReportRubric,
} from "./types";
import type { FacultyRubricScore } from "../scoring";
import {
  FACULTY_REPORT_COMPETENCY_MESSAGES,
  FACULTY_REPORT_CRITICAL_MISS_MESSAGE,
  FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE,
  FACULTY_REPORT_OVERALL_MESSAGES,
  FACULTY_REPORT_UNCERTAINTY_MESSAGE,
  getCompetencyStatus,
} from "./messaging";

export type FacultyReportValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateFacultyReport(input: {
  report: FacultyReport;
  rubric: FacultyReportRubric;
  completedEvaluations: FacultyReportEvaluation[];
  score?: FacultyRubricScore;
}): FacultyReportValidationResult {
  const errors: string[] = [];
  const rubricCriterionIds = new Set(input.rubric.criteria.map((criterion) => criterion.id));
  const supportedScoreIds = new Set(
    input.score
      ? input.score.criteria
          .filter((criterion) => criterion.possiblePoints > 0)
          .map((criterion) => criterion.criterionId)
      : input.report.criterionResults
          .filter((criterion) => criterion.supported)
          .map((criterion) => criterion.criterionId),
  );

  for (const criterion of input.report.criterionResults) {
    if (!rubricCriterionIds.has(criterion.criterionId)) {
      errors.push(`Reported criterion does not exist in rubric: ${criterion.criterionId}`);
    }
  }

  for (const supportedScoreId of supportedScoreIds) {
    const matchingReportCriteria = input.report.criterionResults.filter(
      (criterion) => criterion.criterionId === supportedScoreId,
    );
    if (matchingReportCriteria.length === 0) {
      errors.push(`Supported criterion is missing from report: ${supportedScoreId}`);
    }
    if (matchingReportCriteria.length > 1) {
      errors.push(`Supported criterion appears more than once in report: ${supportedScoreId}`);
    }
  }

  const duplicateCriterionIds = findDuplicates(input.report.criterionResults.map((criterion) => criterion.criterionId));
  for (const duplicateCriterionId of duplicateCriterionIds) {
    errors.push(`Criterion appears more than once in report: ${duplicateCriterionId}`);
  }

  const scoreByCompetency = new Map(
    input.report.competencyScores.map((competency) => [competency.competency, competency]),
  );
  const expectedCompetencies = input.score?.competencies ?? input.report.competencyScores;
  for (const scoreCompetency of expectedCompetencies) {
    const matchingScore = input.report.competencyScores.find(
      (competency) => competency.competency === scoreCompetency.competency,
    );
    if (!matchingScore) {
      errors.push(`Competency summary is missing from report: ${scoreCompetency.competency}`);
      continue;
    }
    if (scoreCompetency.earnedPoints !== matchingScore.earnedPoints) {
      errors.push(`Competency earned points mismatch: ${scoreCompetency.competency}`);
    }
    if (scoreCompetency.possiblePoints !== matchingScore.possiblePoints) {
      errors.push(`Competency possible points mismatch: ${scoreCompetency.competency}`);
    }
    if (scoreCompetency.percentage !== matchingScore.percentage) {
      errors.push(`Competency percentage mismatch: ${scoreCompetency.competency}`);
    }
    if (!equalNumber(matchingScore.rawPercentage, scoreCompetency.percentage)) {
      errors.push(`Competency raw percentage mismatch: ${scoreCompetency.competency}`);
    }
    const expectedStatus = getCompetencyStatus(scoreCompetency.percentage);
    if (matchingScore.statusLabel !== expectedStatus) {
      errors.push(`Competency status does not match raw percentage: ${scoreCompetency.competency}`);
    }
    if (matchingScore.percentage === null && matchingScore.statusLabel !== "unavailable") {
      errors.push(`Unavailable competency should have unavailable status: ${scoreCompetency.competency}`);
    }
    if (matchingScore.summaryMessage !== FACULTY_REPORT_COMPETENCY_MESSAGES[matchingScore.statusLabel]) {
      errors.push(`Competency summary message does not match status: ${scoreCompetency.competency}`);
    }
  }

  for (const reportCriterion of input.report.criterionResults) {
    if (!scoreByCompetency.has(reportCriterion.competency)) {
      errors.push(`Criterion references a competency not summarized in the report: ${reportCriterion.criterionId}`);
    }
  }

  const reportCriterionById = new Map(
    input.report.criterionResults.map((criterion) => [criterion.criterionId, criterion]),
  );

  for (const strength of input.report.strengths) {
    const criterion = reportCriterionById.get(strength.criterionId);
    if (!criterion) {
      errors.push(`Strength references a criterion not included in the report: ${strength.criterionId}`);
      continue;
    }
    if (!criterion.supported || criterion.status !== "met") {
      errors.push(`Strength must be grounded in a supported met criterion: ${strength.criterionId}`);
    }
  }

  for (const improvement of input.report.improvementAreas) {
    const criterion = reportCriterionById.get(improvement.criterionId);
    if (!criterion) {
      errors.push(`Improvement area references a criterion not included in the report: ${improvement.criterionId}`);
      continue;
    }
    if (!criterion.supported || (criterion.status !== "not-met" && criterion.status !== "uncertain")) {
      errors.push(
        `Improvement area must be grounded in a supported not-met or uncertain criterion: ${improvement.criterionId}`,
      );
    }
    if (improvement.status !== criterion.status) {
      errors.push(`Improvement area status does not match criterion status: ${improvement.criterionId}`);
    }
  }

  for (const competency of input.report.competencyScores) {
    const matchingCriteria = input.report.criterionResults.filter(
      (criterion) => criterion.competency === competency.competency,
    );
    const metCount = matchingCriteria.filter((criterion) => criterion.status === "met").length;
    const notMetCount = matchingCriteria.filter((criterion) => criterion.status === "not-met").length;
    const uncertainCount = matchingCriteria.filter((criterion) => criterion.status === "uncertain").length;
    const criticalMissCount = matchingCriteria.filter(
      (criterion) => criterion.critical && criterion.status === "not-met",
    ).length;
    const criticalUncertainCount = matchingCriteria.filter(
      (criterion) => criterion.critical && criterion.status === "uncertain",
    ).length;

    if (competency.metCount !== metCount) {
      errors.push(`Competency met count mismatch: ${competency.competency}`);
    }
    if (competency.notMetCount !== notMetCount) {
      errors.push(`Competency not-met count mismatch: ${competency.competency}`);
    }
    if (competency.uncertainCount !== uncertainCount) {
      errors.push(`Competency uncertain count mismatch: ${competency.competency}`);
    }
    if (competency.criticalMissCount !== criticalMissCount) {
      errors.push(`Competency critical miss count mismatch: ${competency.competency}`);
    }
    if (competency.criticalUncertainCount !== criticalUncertainCount) {
      errors.push(`Competency critical uncertain count mismatch: ${competency.competency}`);
    }
  }

  if (input.report.overallResult.passStatus !== input.report.passStatus) {
    errors.push("Overall result pass status does not match report pass status.");
  }
  if (input.report.overallResult.message !== FACULTY_REPORT_OVERALL_MESSAGES[input.report.passStatus]) {
    errors.push("Overall result message does not match pass status.");
  }

  const uncertainItemCount = input.report.criterionResults.filter(
    (criterion) => criterion.status === "uncertain",
  ).length;
  if (input.report.uncertaintySummary.uncertainItemCount !== uncertainItemCount) {
    errors.push("Uncertainty summary count does not match criterion results.");
  }
  if (uncertainItemCount > 0 && input.report.uncertaintySummary.message !== FACULTY_REPORT_UNCERTAINTY_MESSAGE) {
    errors.push("Uncertainty summary message is missing or incorrect.");
  }
  if (uncertainItemCount === 0 && input.report.uncertaintySummary.message) {
    errors.push("Uncertainty summary message should only appear when uncertain items exist.");
  }

  const criticalMissCount = input.report.criterionResults.filter(
    (criterion) => criterion.critical && criterion.status === "not-met",
  ).length;
  const criticalUncertainCount = input.report.criterionResults.filter(
    (criterion) => criterion.critical && criterion.status === "uncertain",
  ).length;
  if (input.report.criticalSafetySummary.criticalMissCount !== criticalMissCount) {
    errors.push("Critical safety miss count does not match criterion results.");
  }
  if (input.report.criticalSafetySummary.criticalUncertainCount !== criticalUncertainCount) {
    errors.push("Critical safety uncertain count does not match criterion results.");
  }
  if (criticalMissCount > 0 && input.report.criticalSafetySummary.message !== FACULTY_REPORT_CRITICAL_MISS_MESSAGE) {
    errors.push("Critical miss message is missing or incorrect.");
  }
  if (
    criticalMissCount === 0 &&
    criticalUncertainCount > 0 &&
    input.report.criticalSafetySummary.message !== FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE
  ) {
    errors.push("Critical uncertainty message is missing or incorrect.");
  }
  if (criticalMissCount === 0 && criticalUncertainCount === 0 && input.report.criticalSafetySummary.message) {
    errors.push("Critical safety message should be absent when safety status is clear.");
  }

  const score = input.report.overallScore;
  if (input.score) {
    if (score.earnedPoints !== input.score.earnedPoints) {
      errors.push("Overall earned points do not match scorer output.");
    }
    if (score.possiblePoints !== input.score.possiblePoints) {
      errors.push("Overall possible points do not match scorer output.");
    }
    if (score.percentage !== input.score.percentage) {
      errors.push("Overall percentage does not match scorer output.");
    }
    if (!equalNumber(score.rawPercentage, input.score.rawPercentage)) {
      errors.push("Overall raw percentage does not match scorer output.");
    }
    if (input.report.passStatus !== input.score.passStatus) {
      errors.push("Pass status does not match scorer output.");
    }
  }

  if (score.earnedPoints !== input.report.criterionResults.reduce((total, criterion) => {
    return total + (criterion.score?.earnedPoints ?? 0);
  }, 0)) {
    errors.push("Overall earned points do not match criterion scores.");
  }

  if (input.report.passStatus === "technical-invalid" && input.report.overallScore.percentage !== null) {
    errors.push("Technical-invalid reports must not have a percentage.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function equalNumber(left: number | null, right: number | null) {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= 1e-9;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}
