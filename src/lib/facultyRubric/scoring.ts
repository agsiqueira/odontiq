import { evaluateEncounter } from "../checklistEvaluation";

import { facultyRubrics } from "./caseRubrics";
import { getResolvedFacultyRubricCalibration } from "./calibration/caseCalibration";
import { FINAL_FACULTY_RUBRIC_POLICY } from "./calibration/policy";
import { FACULTY_RUBRIC_VERSION } from "./evaluation/state";
import type { FacultyCriterionEvaluation } from "./evaluation/types";
import type { ResolvedFacultyCriterionCalibration } from "./calibration/types";
import type {
  FacultyRubric,
  FacultyRubricCompetency,
  FacultyRubricCriterion,
} from "./types";
import { getAuthoredExpectedValue } from "./report/comparison";

export const FACULTY_RUBRIC_SCORING_VERSION =
  "faculty-rubric-scoring-passive-credit-v2";

export const FACULTY_RUBRIC_UNCERTAINTY_EXPLANATION =
  FINAL_FACULTY_RUBRIC_POLICY.uncertaintyExplanation;

export type FacultyRubricSafetyStatus =
  | "clear"
  | "critical-miss"
  | "critical-review";

export type FacultyRubricScoringStatus =
  | "complete"
  | "partial"
  | "requires-review"
  | "unavailable"
  | "technical-invalid";

export type FacultyRubricPassStatus =
  | "pass"
  | "does-not-pass"
  | "technical-invalid";

export type FacultyRubricCriterionScore = {
  criterionId: string;
  competency: FacultyRubricCompetency;
  status: FacultyCriterionEvaluation["status"];
  weight: number;
  originalWeight: number;
  activeScoreWeight: number;
  earnedPoints: number;
  possiblePoints: number;
  expected: boolean;
  observedValue?: boolean;
  penaltyPoints: number;
  critical: boolean;
  provisionalWeight: boolean;
};

export type FacultyRubricCompetencyScore = {
  competency: FacultyRubricCompetency;
  earnedPoints: number;
  possiblePoints: number;
  percentage: number | null;
};

export type FacultyRubricScore = {
  caseId: string;
  rubricVersion: string;
  scoringVersion: string;
  status: FacultyRubricScoringStatus;
  earnedPoints: number;
  penaltyPoints: number;
  adjustedPoints: number;
  totalExpectedCriteria: number;
  possiblePoints: number;
  rawPercentage: number | null;
  percentage: number | null;
  passingScorePercentage: 84;
  passStatus: FacultyRubricPassStatus;
  metCount: number;
  notMetCount: number;
  uncertainCount: number;
  supportedScoredCriterionCount: number;
  evaluatedScoredWeight: number;
  configuredScoredWeight: number;
  evaluationCoveragePercentage: number;
  competencies: FacultyRubricCompetencyScore[];
  criteria: FacultyRubricCriterionScore[];
  safetyStatus: FacultyRubricSafetyStatus;
  criticalMetCriterionIds: string[];
  criticalMissCriterionIds: string[];
  criticalReviewCriterionIds: string[];
  criticalUncertainCriterionIds: string[];
  unsupportedCriterionIds: string[];
  missingEvaluationCriterionIds: string[];
  uncertainCriterionIds: string[];
  technicalValidationErrors: string[];
};

export type FacultyRubricScoringInput = {
  caseId: string;
  evaluations: FacultyCriterionEvaluation[];
  unsupportedCriterionIds?: string[];
};

export type FacultyRubricCriterionStatusDisplay = {
  label: "Met" | "Not Met" | "Uncertain - No credit awarded";
  tone: "success" | "neutral" | "warning";
};

export type FacultyRubricCalibrationCriterion = {
  caseId: string;
  criterionId: string;
  title: string;
  competency: FacultyRubricCompetency;
  weight: number;
  originalWeight: number;
  activeScoreWeight: number;
  scored: boolean;
  provisionalWeight: boolean;
  legacySource: string | null;
  critical: boolean;
  expectation: FacultyRubricCriterion["expectation"];
};

export type FacultyRubricCalibrationCaseReport = {
  caseId: string;
  totalConfiguredScoredWeight: number;
  totalProvisionalWeight: number;
  competencyTotals: FacultyRubricCompetencyScore[];
  criticalCriteria: string[];
  unsupportedCriteria: string[];
  expectedMaximumScore: number;
  singleMissEffects: Array<{
    criterionId: string;
    pointsLost: number;
    percentageLost: number;
  }>;
  criticalMissEffects: Array<{
    criterionId: string;
    pointsLost: number;
    percentageLost: number;
    safetyStatus: Extract<FacultyRubricSafetyStatus, "critical-miss">;
  }>;
  legacyEmptyScore: number;
  criteria: FacultyRubricCalibrationCriterion[];
};

const competencies: FacultyRubricCompetency[] = [
  "information-gathering",
  "clinical-findings",
  "clinical-interpretation",
  "management-planning",
  "patient-communication",
  "procedural-decision",
  "examination",
];

export function scoreFacultyRubricEvaluations({
  caseId,
  evaluations,
  unsupportedCriterionIds = [],
}: FacultyRubricScoringInput): FacultyRubricScore {
  const rubric = getRubric(caseId);

  if (!rubric) {
    return createUnavailableScore(caseId, unsupportedCriterionIds);
  }

  const unsupportedIds = new Set(unsupportedCriterionIds);
  for (const criterion of getResolvedFacultyRubricCalibration(caseId)) {
    if (criterion.scored && !criterion.supported) {
      unsupportedIds.add(criterion.criterionId);
    }
  }
  const resolvedCalibration = getResolvedFacultyRubricCalibration(caseId);
  const configuredScoredCriteria = resolvedCalibration.filter(
    (criterion) => criterion.scored,
  );
  const scoreableConfiguredCriteria = configuredScoredCriteria.filter(
    (criterion) => !unsupportedIds.has(criterion.criterionId),
  );
  const validation = validateEvaluationSet({
    caseId,
    evaluations,
    resolvedCalibration,
    scoreableConfiguredCriteria,
  });
  const evaluationsByCriterionId = validation.evaluationsByCriterionId;
  const criteria: FacultyRubricCriterionScore[] = [];
  const missingEvaluationCriterionIds: string[] = [];
  const uncertainCriterionIds: string[] = [];
  const criticalMetCriterionIds: string[] = [];
  const criticalMissCriterionIds: string[] = [];
  const criticalReviewCriterionIds: string[] = [];
  const activeScoreWeight = FINAL_FACULTY_RUBRIC_POLICY.criterionWeight;
  const rubricCriteriaById = new Map(
    rubric.criteria.map((criterion) => [criterion.id, criterion]),
  );

  for (const criterion of scoreableConfiguredCriteria) {
    const evaluation = evaluationsByCriterionId.get(criterion.criterionId);

    if (!evaluation) {
      missingEvaluationCriterionIds.push(criterion.criterionId);
      continue;
    }

    const rubricCriterion = rubricCriteriaById.get(criterion.criterionId);
    if (!rubricCriterion) {
      continue;
    }
    const expected = getEffectiveExpectedValue({
      criterion: rubricCriterion,
      rubric,
    });
    const observedValue = getObservedValue(evaluation);
    const penaltyPoints =
      !expected &&
      observedValue === true &&
      isPenaltyEligible({ criterion: rubricCriterion, rubric })
        ? activeScoreWeight
        : 0;
    const earnedPoints =
      expected && evaluation.status === "met"
        ? FINAL_FACULTY_RUBRIC_POLICY.metScore
        : 0;
    const possiblePoints =
      evaluation.status === "not-applicable" ? 0 : activeScoreWeight;

    if (evaluation.status === "uncertain") {
      uncertainCriterionIds.push(criterion.criterionId);
    }

    if (criterion.critical) {
      if (evaluation.status === "met") {
        criticalMetCriterionIds.push(criterion.criterionId);
      } else if (evaluation.status === "not-met") {
        criticalMissCriterionIds.push(criterion.criterionId);
      } else if (evaluation.status === "uncertain") {
        criticalReviewCriterionIds.push(criterion.criterionId);
      }
    }

    criteria.push({
      criterionId: criterion.criterionId,
      competency: criterion.competency,
      status: evaluation.status,
      weight: activeScoreWeight,
      originalWeight: criterion.currentWeight,
      activeScoreWeight,
      earnedPoints,
      possiblePoints,
      expected,
      observedValue,
      penaltyPoints,
      critical: criterion.critical,
      provisionalWeight: criterion.provisionalWeight,
    });
  }

  const earnedPoints = roundScore(
    criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0),
  );
  const penaltyPoints = roundScore(
    criteria.reduce((sum, criterion) => sum + criterion.penaltyPoints, 0),
  );
  const adjustedPoints = roundScore(Math.max(0, earnedPoints - penaltyPoints));
  const totalExpectedCriteria = criteria.filter(
    (criterion) => criterion.expected && criterion.status !== "not-applicable",
  ).length;
  const possiblePoints = totalExpectedCriteria;
  const configuredScoredWeight = roundScore(
    configuredScoredCriteria.reduce(
      (sum, criterion) =>
        unsupportedIds.has(criterion.criterionId)
          ? sum
          : sum + activeScoreWeight,
      0,
    ),
  );
  const evaluatedScoredWeight = criteria.length;
  const evaluationCoveragePercentage =
    configuredScoredWeight > 0
      ? roundScore((evaluatedScoredWeight / configuredScoredWeight) * 100)
      : 0;
  const safetyStatus = getSafetyStatus({
    criticalMissCriterionIds,
    criticalReviewCriterionIds,
  });
  const metCount = criteria.filter((criterion) => criterion.status === "met")
    .length;
  const notMetCount = criteria.filter(
    (criterion) => criterion.status === "not-met",
  ).length;
  const uncertainCount = criteria.filter(
    (criterion) => criterion.status === "uncertain",
  ).length;
  const hasTechnicalErrors = validation.technicalValidationErrors.length > 0;
  const rawPercentage =
    hasTechnicalErrors || possiblePoints <= 0
      ? null
      : (adjustedPoints / possiblePoints) * 100;
  const percentage =
    rawPercentage === null ? null : roundDisplayPercentage(rawPercentage);
  const passStatus = getFacultyRubricPassStatus(
    rawPercentage,
    hasTechnicalErrors,
  );

  return {
    caseId,
    rubricVersion: FACULTY_RUBRIC_VERSION,
    scoringVersion: FACULTY_RUBRIC_SCORING_VERSION,
    status: hasTechnicalErrors
      ? "technical-invalid"
      : getScoringStatus({ configuredScoredWeight, possiblePoints }),
    earnedPoints,
    penaltyPoints,
    adjustedPoints,
    totalExpectedCriteria,
    possiblePoints,
    rawPercentage,
    percentage,
    passingScorePercentage:
      FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage,
    passStatus,
    metCount,
    notMetCount,
    uncertainCount,
    supportedScoredCriterionCount: criteria.filter(
      (criterion) => criterion.status !== "not-applicable",
    ).length,
    evaluatedScoredWeight,
    configuredScoredWeight,
    evaluationCoveragePercentage,
    competencies: scoreCompetencies(criteria),
    criteria,
    safetyStatus,
    criticalMetCriterionIds,
    criticalMissCriterionIds,
    criticalReviewCriterionIds,
    criticalUncertainCriterionIds: criticalReviewCriterionIds,
    unsupportedCriterionIds: [...unsupportedIds].sort(),
    missingEvaluationCriterionIds,
    uncertainCriterionIds,
    technicalValidationErrors: validation.technicalValidationErrors,
  };
}

export function getFacultyRubricCriterionStatusDisplay(
  status: FacultyCriterionEvaluation["status"],
): FacultyRubricCriterionStatusDisplay {
  if (status === "met") {
    return { label: "Met", tone: "success" };
  }

  if (status === "uncertain") {
    return { label: "Uncertain - No credit awarded", tone: "warning" };
  }

  return { label: "Not Met", tone: "neutral" };
}

export function getFacultyRubricCalibrationReport(): FacultyRubricCalibrationCaseReport[] {
  return facultyRubrics.map((rubric) => {
    const criteria = getResolvedFacultyRubricCalibration(rubric.caseId).map(
      createCalibrationCriterion,
    );
    const scoredCriteria = criteria.filter((criterion) => criterion.scored);
    const totalConfiguredScoredWeight = roundScore(
      scoredCriteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    );
    const totalProvisionalWeight = roundScore(
      scoredCriteria
        .filter((criterion) => criterion.provisionalWeight)
        .reduce((sum, criterion) => sum + criterion.weight, 0),
    );
    const singleMissEffects = scoredCriteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      pointsLost: criterion.weight,
      percentageLost:
        totalConfiguredScoredWeight > 0
          ? roundScore((criterion.weight / totalConfiguredScoredWeight) * 100)
          : 0,
    }));
    const criticalMissEffects = singleMissEffects
      .filter((effect) =>
        scoredCriteria.some(
          (criterion) =>
            criterion.criterionId === effect.criterionId && criterion.critical,
        ),
      )
      .map((effect) => ({
        ...effect,
        safetyStatus: "critical-miss" as const,
      }));

    return {
      caseId: rubric.caseId,
      totalConfiguredScoredWeight,
      totalProvisionalWeight,
      competencyTotals: scoreCompetencies(
        scoredCriteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          competency: criterion.competency,
          status: "met",
          weight: criterion.weight,
          originalWeight: criterion.originalWeight,
          activeScoreWeight: criterion.activeScoreWeight,
          earnedPoints: criterion.weight,
          possiblePoints: criterion.weight,
          expected: true,
          observedValue: true,
          penaltyPoints: 0,
          critical: criterion.critical,
          provisionalWeight: criterion.provisionalWeight,
        })),
      ),
      criticalCriteria: scoredCriteria
        .filter((criterion) => criterion.critical)
        .map((criterion) => criterion.criterionId),
      unsupportedCriteria: getResolvedFacultyRubricCalibration(rubric.caseId)
        .filter((criterion) => criterion.scored && !criterion.supported)
        .map((criterion) => criterion.criterionId),
      expectedMaximumScore: 100,
      singleMissEffects,
      criticalMissEffects,
      legacyEmptyScore: evaluateEncounter({
        caseId: rubric.caseId,
        coveredChecklistItems: [],
      }).overall,
      criteria,
    };
  });
}

function getRubric(caseId: string): FacultyRubric | undefined {
  return facultyRubrics.find((rubric) => rubric.caseId === caseId);
}

function scoreCompetencies(
  criteria: FacultyRubricCriterionScore[],
): FacultyRubricCompetencyScore[] {
  return competencies.map((competency) => {
    const competencyCriteria = criteria.filter(
      (criterion) => criterion.competency === competency,
    );
    const grossEarnedPoints = roundScore(
      competencyCriteria
        .filter((criterion) => criterion.expected)
        .reduce(
        (sum, criterion) => sum + criterion.earnedPoints,
        0,
      ),
    );
    const penaltyPoints = roundScore(
      competencyCriteria.reduce(
        (sum, criterion) => sum + criterion.penaltyPoints,
        0,
      ),
    );
    const earnedPoints = Math.max(0, grossEarnedPoints - penaltyPoints);
    const possiblePoints = roundScore(
      competencyCriteria.filter(
        (criterion) => criterion.expected && criterion.status !== "not-applicable",
      ).length,
    );

    return {
      competency,
      earnedPoints,
      possiblePoints,
      percentage:
        possiblePoints > 0
          ? roundScore((earnedPoints / possiblePoints) * 100)
          : null,
    };
  });
}

function getSafetyStatus({
  criticalMissCriterionIds,
  criticalReviewCriterionIds,
}: {
  criticalMissCriterionIds: string[];
  criticalReviewCriterionIds: string[];
}): FacultyRubricSafetyStatus {
  if (criticalMissCriterionIds.length > 0) {
    return "critical-miss";
  }

  if (criticalReviewCriterionIds.length > 0) {
    return "critical-review";
  }

  return "clear";
}

function validateEvaluationSet({
  caseId,
  evaluations,
  resolvedCalibration,
  scoreableConfiguredCriteria,
}: {
  caseId: string;
  evaluations: FacultyCriterionEvaluation[];
  resolvedCalibration: ResolvedFacultyCriterionCalibration[];
  scoreableConfiguredCriteria: ResolvedFacultyCriterionCalibration[];
}) {
  const technicalValidationErrors: string[] = [];
  const evaluationsByCriterionId = new Map<string, FacultyCriterionEvaluation>();
  const allCriterionIds = new Set(
    resolvedCalibration.map((criterion) => criterion.criterionId),
  );
  const supportedScoredCriterionIds = new Set(
    scoreableConfiguredCriteria.map((criterion) => criterion.criterionId),
  );
  const countsByCriterionId = new Map<string, number>();

  for (const evaluation of evaluations.filter(
    (item) => item.caseId === caseId,
  )) {
    if (!allCriterionIds.has(evaluation.criterionId)) {
      technicalValidationErrors.push(
        `unknown-criterion:${evaluation.criterionId}`,
      );
      continue;
    }

    if (!supportedScoredCriterionIds.has(evaluation.criterionId)) {
      continue;
    }

    if (
      evaluation.status !== "met" &&
      evaluation.status !== "not-met" &&
      evaluation.status !== "uncertain" &&
      !isValidConditionalNotApplicable(caseId, evaluation)
    ) {
      technicalValidationErrors.push(
        `invalid-supported-status:${evaluation.criterionId}`,
      );
      continue;
    }

    countsByCriterionId.set(
      evaluation.criterionId,
      (countsByCriterionId.get(evaluation.criterionId) ?? 0) + 1,
    );
    evaluationsByCriterionId.set(evaluation.criterionId, evaluation);
  }

  for (const criterion of scoreableConfiguredCriteria) {
    const count = countsByCriterionId.get(criterion.criterionId) ?? 0;

    if (count === 0) {
      technicalValidationErrors.push(`missing-result:${criterion.criterionId}`);
    } else if (count > 1) {
      technicalValidationErrors.push(
        `duplicate-result:${criterion.criterionId}`,
      );
    }
  }

  return {
    evaluationsByCriterionId,
    technicalValidationErrors,
  };
}

function isValidConditionalNotApplicable(
  caseId: string,
  evaluation: FacultyCriterionEvaluation,
) {
  if (evaluation.status !== "not-applicable" || evaluation.expectedValue !== false) {
    return false;
  }
  return getRubric(caseId)?.criteria.some(
    (criterion) =>
      criterion.id === evaluation.criterionId &&
      criterion.name === "selected-appropriate-iv-antibiotic",
  );
}

function getEffectiveExpectedValue({
  criterion,
  rubric,
}: {
  criterion: FacultyRubricCriterion;
  rubric: FacultyRubric;
}) {
  if (criterion.name === "selected-appropriate-iv-antibiotic") {
    const parent = rubric.criteria.find(
      (candidate) => candidate.name === "recommended-iv-antibiotics",
    );
    return parent ? getAuthoredExpectedValue(parent) : false;
  }
  return getAuthoredExpectedValue(criterion);
}

function getObservedValue(evaluation: FacultyCriterionEvaluation) {
  if (evaluation.status === "uncertain") return undefined;
  return evaluation.observedValue ?? evaluation.status === "met";
}

function isPenaltyEligible({
  criterion,
  rubric,
}: {
  criterion: FacultyRubricCriterion;
  rubric: FacultyRubric;
}) {
  if (criterion.name === "selected-appropriate-iv-antibiotic") {
    const parent = rubric.criteria.find(
      (candidate) => candidate.name === "recommended-iv-antibiotics",
    );
    return Boolean(parent && getAuthoredExpectedValue(parent));
  }
  return (
    criterion.evaluationMode === "recommendation" ||
    criterion.evaluationMode === "clinical-statement" ||
    criterion.evaluationMode === "procedural-choice"
  );
}

function getScoringStatus({
  configuredScoredWeight,
  possiblePoints,
}: {
  configuredScoredWeight: number;
  possiblePoints: number;
}): FacultyRubricScoringStatus {
  if (configuredScoredWeight <= 0 || possiblePoints <= 0) {
    return "unavailable";
  }

  return "complete";
}

export function getFacultyRubricPassStatus(
  rawPercentage: number | null,
  hasTechnicalErrors: boolean,
): FacultyRubricPassStatus {
  if (hasTechnicalErrors || rawPercentage === null) {
    return "technical-invalid";
  }

  return rawPercentage >= FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage
    ? "pass"
    : "does-not-pass";
}

function createUnavailableScore(
  caseId: string,
  unsupportedCriterionIds: string[],
): FacultyRubricScore {
  return {
    caseId,
    rubricVersion: FACULTY_RUBRIC_VERSION,
    scoringVersion: FACULTY_RUBRIC_SCORING_VERSION,
    status: "unavailable",
    earnedPoints: 0,
    penaltyPoints: 0,
    adjustedPoints: 0,
    totalExpectedCriteria: 0,
    possiblePoints: 0,
    rawPercentage: null,
    percentage: null,
    passingScorePercentage:
      FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage,
    passStatus: "technical-invalid",
    metCount: 0,
    notMetCount: 0,
    uncertainCount: 0,
    supportedScoredCriterionCount: 0,
    evaluatedScoredWeight: 0,
    configuredScoredWeight: 0,
    evaluationCoveragePercentage: 0,
    competencies: scoreCompetencies([]),
    criteria: [],
    safetyStatus: "clear",
    criticalMetCriterionIds: [],
    criticalMissCriterionIds: [],
    criticalReviewCriterionIds: [],
    criticalUncertainCriterionIds: [],
    unsupportedCriterionIds: [...unsupportedCriterionIds].sort(),
    missingEvaluationCriterionIds: [],
    uncertainCriterionIds: [],
    technicalValidationErrors: ["unknown-case-or-unavailable-rubric"],
  };
}

function createCalibrationCriterion(
  criterion: ResolvedFacultyCriterionCalibration,
): FacultyRubricCalibrationCriterion {
  const scored = criterion.scored && criterion.supported;

  return {
    caseId: criterion.caseId,
    criterionId: criterion.criterionId,
    title: criterion.title,
    competency: criterion.competency,
    weight: scored ? normalizeWeight(criterion.proposedWeight) : 0,
    originalWeight: criterion.currentWeight,
    activeScoreWeight: criterion.activeScoreWeight,
    scored,
    provisionalWeight: criterion.provisionalWeight,
    legacySource: criterion.legacyMapping,
    critical: criterion.critical,
    expectation: criterion.expectation,
  };
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundDisplayPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}
