import type {
  FacultyRubricCompetency,
  FacultyRubricCriterion,
  FacultyRubricEvaluationMode,
  FacultyRubricExpectation,
} from "../types";
import type { FacultyRubricSafetyStatus, FacultyRubricScore } from "../scoring";

export type RubricCalibrationSource =
  | "faculty-confirmed"
  | "legacy-derived"
  | "provisional-default"
  | "repository-derived"
  | "awaiting-clarification";

export type FacultyCriterionCalibration = {
  criterionId: string;
  weight?: number;
  critical?: boolean;
  supported?: boolean;
  source: RubricCalibrationSource;
  rationale?: string;
  facultyDecisionRequired?: boolean;
};

export type ResolvedFacultyCriterionCalibration = {
  caseId: string;
  criterionId: string;
  title: string;
  competency: FacultyRubricCompetency;
  evaluationMode: FacultyRubricEvaluationMode;
  expectation: FacultyRubricExpectation;
  scored: boolean;
  currentWeight: number;
  proposedWeight: number;
  activeScoreWeight: number;
  weightSource: RubricCalibrationSource;
  weightRationale: string;
  provisionalWeight: boolean;
  critical: boolean;
  criticalSource: RubricCalibrationSource;
  criticalRationale: string;
  supported: boolean;
  supportSource: RubricCalibrationSource;
  supportRationale: string;
  legacyMapping: string | null;
  facultyDecisionRequired: boolean;
  rubricCriterion: FacultyRubricCriterion;
};

export type FacultyRubricCalibrationCase = {
  caseId: string;
  criteria: FacultyCriterionCalibration[];
};

export type CriticalMissPolicy =
  | "warning-only"
  | "score-cap"
  | "automatic-fail";

export type FacultyRubricActivationPolicy = {
  criticalMissPolicy: CriticalMissPolicy;
  criticalMissScoreCap?: number;
  uncertainCriticalPolicy: "review-only" | "treat-as-miss";
};

export type FinalFacultyRubricPolicy = {
  scoringModel: "equal-item-direct";
  criterionWeight: 1;
  passingScorePercentage: 84;
  criticalMissPolicy: Extract<CriticalMissPolicy, "warning-only">;
  uncertainCriticalPolicy: "review-only";
  uncertainScore: 0;
  notMetScore: 0;
  metScore: 1;
  requireResultForEverySupportedCriterion: true;
  missingEvaluationBehavior: "technical-invalid";
  uncertaintyExplanation: string;
};

export type EvaluationCoveragePolicy = {
  minimumCoveragePercentage: number;
  allowUnsupportedCriteriaExclusion: boolean;
  allowUncertainCriteria: boolean;
  maximumUncertainScoredWeight?: number;
};

export type FacultyRubricActivationReadiness =
  | "ready"
  | "requires-faculty-review"
  | "insufficient-evaluation-coverage"
  | "unsupported-criteria-remain";

export type FacultyRubricPolicyProjection = {
  policy: CriticalMissPolicy;
  percentage: number | null;
  safetyStatus: FacultyRubricSafetyStatus;
  activationReadiness: FacultyRubricActivationReadiness;
};

export type CompetencyWeightingComparison = {
  directPercentage: number | null;
  competencyBalancedPercentage: number | null;
  competencyWeights: Array<{
    competency: FacultyRubricCompetency;
    weight: number;
    percentage: number | null;
  }>;
};

export type FacultyRubricScenarioName =
  | "excellent-encounter"
  | "strong-history-weak-management"
  | "weak-history-correct-diagnosis"
  | "safety-critical-miss"
  | "incomplete-semantic-evaluation"
  | "uncertain-evidence";

export type FacultyRubricScenarioResult = {
  caseId: string;
  scenario: FacultyRubricScenarioName;
  score: FacultyRubricScore;
  activationReadiness: FacultyRubricActivationReadiness;
  criticalPolicyProjections: FacultyRubricPolicyProjection[];
  weightingComparison: CompetencyWeightingComparison;
};

export type FacultyRubricCalibrationValidationIssue = {
  code: string;
  message: string;
  caseId?: string;
  criterionId?: string;
};

export type FacultyRubricCalibrationValidationResult = {
  valid: boolean;
  issues: FacultyRubricCalibrationValidationIssue[];
};

export type FacultyRubricCalibrationExport = {
  generatedAt: string;
  rows: ResolvedFacultyCriterionCalibration[];
  summaries: Array<{
    caseId: string;
    totalScoredWeight: number;
    provisionalScoredWeight: number;
    provisionalWeightPercentage: number;
    criticalCriteriaCount: number;
    unsupportedCriteria: string[];
    supportedScoredItemCount: number;
    maximumPossiblePoints: number;
    minimumRawPointsForPass: number;
    passThresholdRequiresRounding: boolean;
    competencyTotals: Array<{
      competency: FacultyRubricCompetency;
      weight: number;
    }>;
  }>;
};
