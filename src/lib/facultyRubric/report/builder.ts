import type {
  BuildFacultyReportInput,
  FacultyReport,
  FacultyReportCriterionResult,
  FacultyReportEvaluation,
  FacultyReportImprovementArea,
  FacultyReportRubricCriterion,
  FacultyReportStrength,
} from "./types";
import { validateFacultyReport } from "./validation";
import {
  FACULTY_REPORT_COMPETENCY_MESSAGES,
  FACULTY_REPORT_CRITICAL_MISS_MESSAGE,
  FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE,
  FACULTY_REPORT_OVERALL_MESSAGES,
  FACULTY_REPORT_UNCERTAINTY_MESSAGE,
  getCompetencyStatus,
  getCompetencyTitle,
} from "./messaging";

export function buildFacultyReport(input: BuildFacultyReportInput): FacultyReport {
  const evaluationByCriterionId = new Map(
    input.completedEvaluations.map((evaluation) => [evaluation.criterionId, evaluation]),
  );
  const rubricCriterionById = new Map(
    input.rubric.criteria.map((criterion) => [criterion.id, criterion]),
  );

  const criterionResults: FacultyReportCriterionResult[] = input.score.criteria
    .filter((criterionScore) => !input.score.unsupportedCriterionIds.includes(criterionScore.criterionId))
    .map((criterionScore) => {
      const rubricCriterion = rubricCriterionById.get(criterionScore.criterionId);
      const evaluation = evaluationByCriterionId.get(criterionScore.criterionId);
      return buildCriterionResult({
        rubricCriterion,
        evaluation,
        criterionScore,
      });
    });

  const report: FacultyReport = {
    caseId: input.score.caseId,
    rubricVersion: input.score.rubricVersion,
    scoringVersion: input.score.scoringVersion,
    overallScore: {
      earnedPoints: input.score.earnedPoints,
      possiblePoints: input.score.possiblePoints,
      percentage: input.score.percentage,
      rawPercentage: input.score.rawPercentage,
    },
    passStatus: input.score.passStatus,
    overallResult: buildOverallResult(input.score.passStatus),
    competencyScores: input.score.competencies.map((competency) =>
      buildCompetencySummary(competency, criterionResults),
    ),
    strengths: buildStrengths(criterionResults),
    improvementAreas: buildImprovementAreas(criterionResults),
    criticalSafetyItems: [],
    uncertainItems: [],
    uncertaintySummary: buildUncertaintySummary(criterionResults),
    criticalSafetySummary: buildCriticalSafetySummary(criterionResults),
    criterionResults,
    reportMetadata: {
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      modelVersion: "faculty-report-3d-1-v1",
      source: "inactive-faculty-rubric",
      validationErrors: [],
    },
  };

  report.criticalSafetyItems = report.criterionResults
    .filter((criterion) => criterion.critical)
    .map((criterion) => ({
      criterion,
      status: criterion.status,
      rationale: criterion.rationale,
      evidence: criterion.evidence,
    }));

  report.uncertainItems = report.criterionResults
    .filter((criterion) => criterion.uncertain)
    .map((criterion) => ({
      criterion,
      rationale: criterion.rationale,
      evidence: criterion.evidence,
    }));

  const validation = validateFacultyReport({
    report,
    rubric: input.rubric,
    completedEvaluations: input.completedEvaluations,
    score: input.score,
  });

  return {
    ...report,
    reportMetadata: {
      ...report.reportMetadata,
      validationErrors: validation.errors,
    },
  };
}

function buildCompetencySummary(
  competency: BuildFacultyReportInput["score"]["competencies"][number],
  criterionResults: FacultyReportCriterionResult[],
): FacultyReport["competencyScores"][number] {
  const criteria = criterionResults.filter((criterion) => criterion.competency === competency.competency);
  const statusLabel = getCompetencyStatus(competency.percentage);

  return {
    competencyId: competency.competency,
    competency: competency.competency,
    title: getCompetencyTitle(competency.competency),
    earnedPoints: competency.earnedPoints,
    possiblePoints: competency.possiblePoints,
    rawPercentage: competency.percentage,
    percentage: competency.percentage,
    displayPercentage: competency.percentage === null ? null : Math.round(competency.percentage),
    metCount: criteria.filter((criterion) => criterion.status === "met").length,
    notMetCount: criteria.filter((criterion) => criterion.status === "not-met").length,
    uncertainCount: criteria.filter((criterion) => criterion.status === "uncertain").length,
    criticalMissCount: criteria.filter((criterion) => criterion.critical && criterion.status === "not-met").length,
    criticalUncertainCount: criteria.filter((criterion) => criterion.critical && criterion.status === "uncertain").length,
    statusLabel,
    summaryMessage: FACULTY_REPORT_COMPETENCY_MESSAGES[statusLabel],
  };
}

function buildOverallResult(passStatus: FacultyReport["passStatus"]): FacultyReport["overallResult"] {
  const labels: Record<FacultyReport["passStatus"], string> = {
    pass: "Pass",
    "does-not-pass": "Does Not Pass",
    "technical-invalid": "Technical Invalid",
  };

  return {
    passStatus,
    label: labels[passStatus],
    message: FACULTY_REPORT_OVERALL_MESSAGES[passStatus],
  };
}

function buildUncertaintySummary(
  criterionResults: FacultyReportCriterionResult[],
): FacultyReport["uncertaintySummary"] {
  const uncertainItems = criterionResults.filter((criterion) => criterion.status === "uncertain");
  const hasCriticalUncertainItems = uncertainItems.some((criterion) => criterion.critical);

  const summary: FacultyReport["uncertaintySummary"] = {
    uncertainItemCount: uncertainItems.length,
    hasCriticalUncertainItems,
  };

  if (uncertainItems.length > 0) {
    summary.message = FACULTY_REPORT_UNCERTAINTY_MESSAGE;
  }

  return summary;
}

function buildCriticalSafetySummary(
  criterionResults: FacultyReportCriterionResult[],
): FacultyReport["criticalSafetySummary"] {
  const criticalMissCount = criterionResults.filter(
    (criterion) => criterion.critical && criterion.status === "not-met",
  ).length;
  const criticalUncertainCount = criterionResults.filter(
    (criterion) => criterion.critical && criterion.status === "uncertain",
  ).length;

  if (criticalMissCount > 0) {
    return {
      status: "critical-miss",
      criticalMissCount,
      criticalUncertainCount,
      message: FACULTY_REPORT_CRITICAL_MISS_MESSAGE,
    };
  }

  if (criticalUncertainCount > 0) {
    return {
      status: "critical-uncertain",
      criticalMissCount,
      criticalUncertainCount,
      message: FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE,
    };
  }

  return {
    status: "clear",
    criticalMissCount,
    criticalUncertainCount,
  };
}

function buildStrengths(criterionResults: FacultyReportCriterionResult[]): FacultyReportStrength[] {
  return criterionResults
    .filter((criterion) => criterion.supported && criterion.status === "met")
    .map((criterion, index) => ({
      criterionId: criterion.criterionId,
      competency: criterion.competency,
      title: criterion.learnerDescription ?? criterion.title,
      supportingEvidence: criterion.evidence,
      displayPriority: getDisplayPriority(criterion, index),
    }))
    .sort(sortByDisplayPriority);
}

function buildImprovementAreas(criterionResults: FacultyReportCriterionResult[]): FacultyReportImprovementArea[] {
  return criterionResults
    .filter(isImprovementCriterion)
    .map((criterion, index): FacultyReportImprovementArea => {
      const status: FacultyReportImprovementArea["status"] =
        criterion.status === "uncertain" ? "uncertain" : "not-met";

      return {
        criterionId: criterion.criterionId,
        competency: criterion.competency,
        title: criterion.learnerDescription ?? criterion.title,
        status,
        evidence: criterion.evidence,
        displayPriority: getDisplayPriority(criterion, index),
      };
    })
    .sort(sortByDisplayPriority);
}

function isImprovementCriterion(
  criterion: FacultyReportCriterionResult,
): criterion is FacultyReportCriterionResult & { status: "not-met" | "uncertain" } {
  return criterion.supported && (criterion.status === "not-met" || criterion.status === "uncertain");
}

function getDisplayPriority(criterion: FacultyReportCriterionResult, index: number): number {
  const criticalPriority = criterion.critical ? 0 : 100;
  const uncertaintyPriority = criterion.uncertain ? 10 : 0;
  return criticalPriority + uncertaintyPriority + index;
}

function sortByDisplayPriority<T extends { displayPriority: number }>(left: T, right: T): number {
  return left.displayPriority - right.displayPriority;
}

function buildCriterionResult(input: {
  rubricCriterion?: FacultyReportRubricCriterion;
  evaluation?: FacultyReportEvaluation;
  criterionScore: BuildFacultyReportInput["score"]["criteria"][number];
}): FacultyReportCriterionResult {
  const title = input.rubricCriterion?.title ?? input.criterionScore.criterionId;
  const competency = input.rubricCriterion?.competency ?? input.criterionScore.competency;
  const status = toFacultyReportStatus(input.evaluation?.status ?? input.criterionScore.status);

  return {
    criterionId: input.criterionScore.criterionId,
    title,
    competency,
    status,
    critical: input.criterionScore.critical,
    uncertain: status === "uncertain",
    supported: input.criterionScore.possiblePoints > 0,
    rationale: input.evaluation?.rationale ?? input.rubricCriterion?.rationale,
    evidence: input.evaluation?.evidence ?? [],
    learnerDescription:
      input.rubricCriterion?.learnerDescription ??
      input.rubricCriterion?.description ??
      title,
    score: input.criterionScore,
  };
}

function toFacultyReportStatus(status: string): FacultyReportCriterionResult["status"] {
  if (status === "met" || status === "not-met" || status === "uncertain" || status === "not-applicable") {
    return status;
  }
  return "uncertain";
}
