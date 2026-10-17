import type { FacultyRubricCompetency } from "../types";
import type {
  FacultyRubricActivationPolicy,
  FacultyRubricActivationReadiness,
  FacultyRubricPolicyProjection,
  CompetencyWeightingComparison,
  CriticalMissPolicy,
  EvaluationCoveragePolicy,
  FinalFacultyRubricPolicy,
  ResolvedFacultyCriterionCalibration,
} from "./types";
import type { FacultyRubricScore } from "../scoring";

export const DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY: FacultyRubricActivationPolicy =
  {
    criticalMissPolicy: "warning-only",
    uncertainCriticalPolicy: "review-only",
  };

export const FINAL_FACULTY_RUBRIC_POLICY: FinalFacultyRubricPolicy = {
  scoringModel: "equal-item-direct",
  criterionWeight: 1,
  passingScorePercentage: 84,
  criticalMissPolicy: "warning-only",
  uncertainCriticalPolicy: "review-only",
  uncertainScore: 0,
  notMetScore: 0,
  metScore: 1,
  requireResultForEverySupportedCriterion: true,
  missingEvaluationBehavior: "technical-invalid",
  uncertaintyExplanation:
    "Some criteria could not be verified from the encounter and therefore received no credit. These items are marked as \"Uncertain.\"",
};

export const DEFAULT_EVALUATION_COVERAGE_POLICY: EvaluationCoveragePolicy = {
  minimumCoveragePercentage: 100,
  allowUnsupportedCriteriaExclusion: false,
  allowUncertainCriteria: true,
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

export function getFacultyRubricActivationReadiness({
  score,
  calibration,
  coveragePolicy = DEFAULT_EVALUATION_COVERAGE_POLICY,
}: {
  score: FacultyRubricScore;
  calibration: ResolvedFacultyCriterionCalibration[];
  coveragePolicy?: EvaluationCoveragePolicy;
}): FacultyRubricActivationReadiness {
  const unsupportedScoredCriteria = calibration.filter(
    (criterion) => criterion.scored && !criterion.supported,
  );
  const uncertainWeight = score.criteria
    .filter((criterion) => criterion.status === "uncertain")
    .reduce((sum, criterion) => sum + criterion.possiblePoints, 0);

  if (score.status === "technical-invalid") {
    return "insufficient-evaluation-coverage";
  }

  if (
    unsupportedScoredCriteria.length > 0 &&
    !coveragePolicy.allowUnsupportedCriteriaExclusion
  ) {
    return "unsupported-criteria-remain";
  }

  if (
    score.evaluationCoveragePercentage < coveragePolicy.minimumCoveragePercentage
  ) {
    return "insufficient-evaluation-coverage";
  }

  if (
    score.uncertainCriterionIds.length > 0 &&
    (!coveragePolicy.allowUncertainCriteria ||
      (coveragePolicy.maximumUncertainScoredWeight !== undefined &&
        uncertainWeight > coveragePolicy.maximumUncertainScoredWeight))
  ) {
    return "requires-faculty-review";
  }

  if (score.safetyStatus !== "clear") {
    return "requires-faculty-review";
  }

  return "ready";
}

export function projectCriticalMissPolicy({
  score,
  policy,
  activationReadiness,
}: {
  score: FacultyRubricScore;
  policy: FacultyRubricActivationPolicy;
  activationReadiness: FacultyRubricActivationReadiness;
}): FacultyRubricPolicyProjection {
  return {
    policy: policy.criticalMissPolicy,
    percentage: getProjectedPercentage(score, policy),
    safetyStatus: score.safetyStatus,
    activationReadiness,
  };
}

export function getCriticalPolicyProjections({
  score,
  activationReadiness,
}: {
  score: FacultyRubricScore;
  activationReadiness: FacultyRubricActivationReadiness;
}): FacultyRubricPolicyProjection[] {
  const policies: FacultyRubricActivationPolicy[] = [
    {
      criticalMissPolicy: "warning-only",
      uncertainCriticalPolicy: "review-only",
    },
    {
      criticalMissPolicy: "score-cap",
      criticalMissScoreCap: 70,
      uncertainCriticalPolicy: "review-only",
    },
    {
      criticalMissPolicy: "automatic-fail",
      uncertainCriticalPolicy: "review-only",
    },
  ];

  return policies.map((policy) =>
    projectCriticalMissPolicy({ score, policy, activationReadiness }),
  );
}

export function compareDirectAndCompetencyBalancedScore(
  score: FacultyRubricScore,
): CompetencyWeightingComparison {
  const availableCompetencies = score.competencies.filter(
    (competency) => competency.possiblePoints > 0,
  );
  const balancedWeight =
    availableCompetencies.length > 0 ? 1 / availableCompetencies.length : 0;
  const competencyWeights = competencies.map((competency) => {
    const scoreForCompetency = score.competencies.find(
      (item) => item.competency === competency,
    );
    const available =
      scoreForCompetency !== undefined && scoreForCompetency.possiblePoints > 0;

    return {
      competency,
      weight: available ? roundScore(balancedWeight * 100) : 0,
      percentage: scoreForCompetency?.percentage ?? null,
    };
  });
  const competencyBalancedPercentage =
    availableCompetencies.length > 0
      ? roundScore(
          availableCompetencies.reduce(
            (sum, competency) => sum + (competency.percentage ?? 0),
            0,
          ) / availableCompetencies.length,
        )
      : null;

  return {
    directPercentage: score.percentage,
    competencyBalancedPercentage,
    competencyWeights,
  };
}

function getProjectedPercentage(
  score: FacultyRubricScore,
  policy: FacultyRubricActivationPolicy,
): number | null {
  if (score.percentage === null) {
    return null;
  }

  if (score.safetyStatus !== "critical-miss") {
    return score.percentage;
  }

  if (policy.criticalMissPolicy === "automatic-fail") {
    return 0;
  }

  if (policy.criticalMissPolicy === "score-cap") {
    return Math.min(score.percentage, policy.criticalMissScoreCap ?? 0);
  }

  return score.percentage;
}

export function isCriticalMissPolicy(value: string): value is CriticalMissPolicy {
  return (
    value === "warning-only" ||
    value === "score-cap" ||
    value === "automatic-fail"
  );
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
