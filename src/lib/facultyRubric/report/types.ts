import type {
  FacultyRubricCriterionScore,
  FacultyRubricPassStatus,
  FacultyRubricScore,
} from "../scoring";

export type FacultyReportStatus = "met" | "not-met" | "uncertain" | "not-applicable";

export type FacultyReportEvidenceReference = {
  source: string;
  eventId?: string;
  checklistItemId?: string;
  excerpt?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type FacultyReportRubricCriterion = {
  id: string;
  title: string;
  competency: string;
  critical?: boolean;
  neutral?: boolean;
  expectation?: string;
  learnerDescription?: string;
  description?: string;
  rationale?: string;
};

export type FacultyReportRubric = {
  caseId: string;
  version?: string;
  rubricVersion?: string;
  criteria: FacultyReportRubricCriterion[];
};

export type FacultyReportEvaluation = {
  criterionId: string;
  status: FacultyReportStatus;
  rationale?: string;
  evidence?: FacultyReportEvidenceReference[];
};

export type FacultyReportCriterionResult = {
  criterionId: string;
  title: string;
  competency: string;
  status: FacultyReportStatus;
  critical: boolean;
  uncertain: boolean;
  supported: boolean;
  rationale?: string;
  evidence: FacultyReportEvidenceReference[];
  learnerDescription?: string;
  score?: FacultyRubricCriterionScore;
};

export type FacultyReportCompetencySummary = {
  competencyId: string;
  competency: string;
  title: string;
  earnedPoints: number;
  possiblePoints: number;
  rawPercentage: number | null;
  percentage: number | null;
  displayPercentage: number | null;
  metCount: number;
  notMetCount: number;
  uncertainCount: number;
  criticalMissCount: number;
  criticalUncertainCount: number;
  statusLabel: FacultyReportCompetencyStatus;
  summaryMessage: string;
};

export type FacultyReportCompetencyStatus =
  | "strong"
  | "developing"
  | "needs-attention"
  | "unavailable";

export type FacultyReportOverallResult = {
  passStatus: FacultyRubricPassStatus;
  label: string;
  message: string;
};

export type FacultyReportUncertaintySummary = {
  uncertainItemCount: number;
  hasCriticalUncertainItems: boolean;
  message?: string;
};

export type FacultyReportCriticalSafetySummary = {
  status: "clear" | "critical-miss" | "critical-uncertain";
  criticalMissCount: number;
  criticalUncertainCount: number;
  message?: string;
};

export type FacultyReportStrength = {
  criterionId: string;
  competency: string;
  title: string;
  supportingEvidence: FacultyReportEvidenceReference[];
  displayPriority: number;
};

export type FacultyReportImprovementStatus = "not-met" | "uncertain";

export type FacultyReportImprovementArea = {
  criterionId: string;
  competency: string;
  title: string;
  status: FacultyReportImprovementStatus;
  evidence: FacultyReportEvidenceReference[];
  displayPriority: number;
};

export type FacultyReportCriticalSafetyItem = {
  criterion: FacultyReportCriterionResult;
  status: FacultyReportStatus;
  rationale?: string;
  evidence: FacultyReportEvidenceReference[];
};

export type FacultyReportUncertainItem = {
  criterion: FacultyReportCriterionResult;
  rationale?: string;
  evidence: FacultyReportEvidenceReference[];
};

export type FacultyReportMetadata = {
  generatedAt: string;
  modelVersion: "faculty-report-3d-1-v1";
  source: "inactive-faculty-rubric";
  validationErrors: string[];
};

export type FacultyReport = {
  caseId: string;
  rubricVersion: string;
  scoringVersion: string;
  overallScore: {
    earnedPoints: number;
    possiblePoints: number;
    percentage: number | null;
    rawPercentage: number | null;
  };
  passStatus: FacultyRubricPassStatus;
  overallResult: FacultyReportOverallResult;
  competencyScores: FacultyReportCompetencySummary[];
  strengths: FacultyReportStrength[];
  improvementAreas: FacultyReportImprovementArea[];
  criticalSafetyItems: FacultyReportCriticalSafetyItem[];
  uncertainItems: FacultyReportUncertainItem[];
  uncertaintySummary: FacultyReportUncertaintySummary;
  criticalSafetySummary: FacultyReportCriticalSafetySummary;
  criterionResults: FacultyReportCriterionResult[];
  reportMetadata: FacultyReportMetadata;
};

export type BuildFacultyReportInput = {
  rubric: FacultyReportRubric;
  completedEvaluations: FacultyReportEvaluation[];
  score: FacultyRubricScore;
  generatedAt?: string;
};
