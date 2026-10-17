import { facultyRubrics } from "../caseRubrics";
import {
  FACULTY_RUBRIC_SCORING_VERSION,
  scoreFacultyRubricEvaluations,
} from "../scoring";
import type { FacultyCriterionEvaluation } from "../evaluation";
import type { FacultyRubricCompetency } from "../types";
import {
  getAllResolvedFacultyRubricCalibration,
  getResolvedFacultyRubricCalibration,
  getUnsupportedFacultyRubricCriterionIds,
} from "./caseCalibration";
import {
  compareDirectAndCompetencyBalancedScore,
  FINAL_FACULTY_RUBRIC_POLICY,
  getCriticalPolicyProjections,
  getFacultyRubricActivationReadiness,
} from "./policy";
import type {
  FacultyRubricCalibrationExport,
  FacultyRubricScenarioName,
  FacultyRubricScenarioResult,
  ResolvedFacultyCriterionCalibration,
} from "./types";

export {
  facultyRubricCalibration,
  getAllResolvedFacultyRubricCalibration,
  getResolvedFacultyRubricCalibration,
  getUnsupportedFacultyRubricCriterionIds,
} from "./caseCalibration";
export {
  compareDirectAndCompetencyBalancedScore,
  DEFAULT_EVALUATION_COVERAGE_POLICY,
  DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
  FINAL_FACULTY_RUBRIC_POLICY,
  getCriticalPolicyProjections,
  getFacultyRubricActivationReadiness,
  isCriticalMissPolicy,
  projectCriticalMissPolicy,
} from "./policy";
export {
  validateEvaluationCoveragePolicy,
  validateFacultyRubricActivationPolicy,
  validateFacultyRubricCalibration,
} from "./validation";
export type {
  CompetencyWeightingComparison,
  CriticalMissPolicy,
  EvaluationCoveragePolicy,
  FinalFacultyRubricPolicy,
  FacultyCriterionCalibration,
  FacultyRubricActivationPolicy,
  FacultyRubricActivationReadiness,
  FacultyRubricCalibrationCase,
  FacultyRubricCalibrationExport,
  FacultyRubricCalibrationValidationIssue,
  FacultyRubricCalibrationValidationResult,
  FacultyRubricPolicyProjection,
  FacultyRubricScenarioName,
  FacultyRubricScenarioResult,
  ResolvedFacultyCriterionCalibration,
  RubricCalibrationSource,
} from "./types";

const scenarioNames: FacultyRubricScenarioName[] = [
  "excellent-encounter",
  "strong-history-weak-management",
  "weak-history-correct-diagnosis",
  "safety-critical-miss",
  "incomplete-semantic-evaluation",
  "uncertain-evidence",
];

export function buildFacultyRubricCalibrationExport(
  generatedAt = new Date().toISOString(),
): FacultyRubricCalibrationExport {
  const rows = getAllResolvedFacultyRubricCalibration();

  return {
    generatedAt,
    rows,
    summaries: facultyRubrics.map((rubric) => {
      const caseRows = rows.filter((row) => row.caseId === rubric.caseId);
      const scoredRows = caseRows.filter((row) => row.scored && row.supported);
      const totalScoredWeight = roundScore(
        scoredRows.reduce((sum, row) => sum + row.proposedWeight, 0),
      );
      const provisionalScoredWeight = roundScore(
        scoredRows
          .filter((row) => row.provisionalWeight)
          .reduce((sum, row) => sum + row.proposedWeight, 0),
      );

      return {
        caseId: rubric.caseId,
        totalScoredWeight,
        provisionalScoredWeight,
        provisionalWeightPercentage:
          totalScoredWeight > 0
            ? roundScore((provisionalScoredWeight / totalScoredWeight) * 100)
            : 0,
        criticalCriteriaCount: scoredRows.filter((row) => row.critical).length,
        unsupportedCriteria: caseRows
          .filter((row) => row.scored && !row.supported)
          .map((row) => row.criterionId),
        supportedScoredItemCount: scoredRows.length,
        maximumPossiblePoints: scoredRows.length,
        minimumRawPointsForPass:
          (scoredRows.length *
            FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage) /
          100,
        passThresholdRequiresRounding:
          (scoredRows.length *
            FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage) %
            100 !==
          0,
        competencyTotals: getCompetencyTotals(scoredRows),
      };
    }),
  };
}

export function buildFacultyRubricCalibrationCsv(
  rows = buildFacultyRubricCalibrationExport().rows,
): string {
  const header = [
    "caseId",
    "criterionId",
    "title",
    "competency",
    "evaluationMode",
    "expectation",
    "scored",
    "currentWeight",
    "proposedWeight",
    "approvedActiveScoreWeight",
    "passingScorePercentage",
    "metPoints",
    "notMetPoints",
    "uncertainPoints",
    "weightSource",
    "provisionalWeight",
    "critical",
    "criticalSource",
    "supported",
    "supportSource",
    "legacyMapping",
    "facultyDecisionRequired",
    "supportRationale",
  ];
  const lines = rows.map((row) =>
    [
      row.caseId,
      row.criterionId,
      row.title,
      row.competency,
      row.evaluationMode,
      row.expectation,
      row.scored,
      row.currentWeight,
      row.proposedWeight,
      row.activeScoreWeight,
      FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage,
      FINAL_FACULTY_RUBRIC_POLICY.metScore,
      FINAL_FACULTY_RUBRIC_POLICY.notMetScore,
      FINAL_FACULTY_RUBRIC_POLICY.uncertainScore,
      row.weightSource,
      row.provisionalWeight,
      row.critical,
      row.criticalSource,
      row.supported,
      row.supportSource,
      row.legacyMapping ?? "",
      row.facultyDecisionRequired,
      row.supportRationale,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function getFacultyRubricScenarioResults(): FacultyRubricScenarioResult[] {
  return facultyRubrics.flatMap((rubric) =>
    scenarioNames.map((scenario) => buildScenarioResult(rubric.caseId, scenario)),
  );
}

function buildScenarioResult(
  caseId: string,
  scenario: FacultyRubricScenarioName,
): FacultyRubricScenarioResult {
  const calibration = getResolvedFacultyRubricCalibration(caseId);
  const unsupportedCriterionIds = getUnsupportedFacultyRubricCriterionIds(caseId);
  const evaluations = buildScenarioEvaluations(caseId, scenario, calibration);
  const score = scoreFacultyRubricEvaluations({
    caseId,
    evaluations,
    unsupportedCriterionIds,
  });
  const activationReadiness = getFacultyRubricActivationReadiness({
    score,
    calibration,
  });

  return {
    caseId,
    scenario,
    score,
    activationReadiness,
    criticalPolicyProjections: getCriticalPolicyProjections({
      score,
      activationReadiness,
    }),
    weightingComparison: compareDirectAndCompetencyBalancedScore(score),
  };
}

function buildScenarioEvaluations(
  caseId: string,
  scenario: FacultyRubricScenarioName,
  calibration: ResolvedFacultyCriterionCalibration[],
): FacultyCriterionEvaluation[] {
  const scoredCriteria = calibration.filter(
    (criterion) => criterion.scored && criterion.supported,
  );

  return scoredCriteria.flatMap((criterion, index) => {
    if (scenario === "incomplete-semantic-evaluation" && index % 4 === 0) {
      return [];
    }

    return [createScenarioEvaluation(caseId, criterion, getScenarioStatus(criterion, scenario))];
  });
}

function getScenarioStatus(
  criterion: ResolvedFacultyCriterionCalibration,
  scenario: FacultyRubricScenarioName,
): FacultyCriterionEvaluation["status"] {
  if (scenario === "excellent-encounter") {
    return "met";
  }

  if (
    scenario === "strong-history-weak-management" &&
    criterion.competency === "management-planning"
  ) {
    return "not-met";
  }

  if (
    scenario === "weak-history-correct-diagnosis" &&
    criterion.competency === "information-gathering"
  ) {
    return "not-met";
  }

  if (
    scenario === "weak-history-correct-diagnosis" &&
    criterion.competency === "clinical-interpretation"
  ) {
    return "met";
  }

  if (
    scenario === "safety-critical-miss" &&
    criterion.critical &&
    isFirstCriticalCriterion(criterion)
  ) {
    return "not-met";
  }

  if (
    scenario === "uncertain-evidence" &&
    (criterion.critical || criterion.competency === "clinical-interpretation")
  ) {
    return "uncertain";
  }

  return "met";
}

function isFirstCriticalCriterion(
  criterion: ResolvedFacultyCriterionCalibration,
): boolean {
  const calibration = getResolvedFacultyRubricCalibration(criterion.caseId);
  return (
    calibration.find((candidate) => candidate.scored && candidate.critical)
      ?.criterionId === criterion.criterionId
  );
}

function createScenarioEvaluation(
  caseId: string,
  criterion: ResolvedFacultyCriterionCalibration,
  status: FacultyCriterionEvaluation["status"],
): FacultyCriterionEvaluation {
  return {
    caseId,
    criterionId: criterion.criterionId,
    status,
    confidence: status === "uncertain" ? 0.5 : 1,
    evidence: [
      {
        source: "student-message",
        messageId: `${criterion.criterionId}-${status}`,
        excerpt: `Scenario evidence for ${criterion.criterionId}.`,
      },
    ],
    rationale: `Scenario ${status} result for ${criterion.criterionId}.`,
    evaluationMethod: "deterministic",
    evaluatedAt: "2026-07-11T12:00:00.000Z",
  };
}

function getCompetencyTotals(
  rows: ResolvedFacultyCriterionCalibration[],
): Array<{ competency: FacultyRubricCompetency; weight: number }> {
  const competencies = Array.from(new Set(rows.map((row) => row.competency)));

  return competencies.map((competency) => ({
    competency,
    weight: roundScore(
      rows
        .filter((row) => row.competency === competency)
        .reduce((sum, row) => sum + row.proposedWeight, 0),
    ),
  }));
}

function csvCell(value: unknown): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export { FACULTY_RUBRIC_SCORING_VERSION };
