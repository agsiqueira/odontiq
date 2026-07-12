export type FacultyCriterionStatus =
  | "met"
  | "not-met"
  | "uncertain"
  | "not-applicable";

export type FacultyEvaluationEvidenceSource =
  | "student-message"
  | "patient-response"
  | "conversation-exchange"
  | "examination-event"
  | "workflow-event"
  | "legacy-checklist-coverage";

export type FacultyEvaluationEvidence = {
  source: FacultyEvaluationEvidenceSource;
  messageId?: string;
  eventId?: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
};

export type FacultyCriterionEvaluationMethod =
  | "deterministic"
  | "deterministic-default"
  | "ai-semantic"
  | "hybrid"
  | "case-state";

export type FacultyCriterionEvaluation = {
  caseId: string;
  criterionId: string;
  status: FacultyCriterionStatus;
  confidence: number;
  evidence: FacultyEvaluationEvidence[];
  rationale: string;
  evaluationMethod: FacultyCriterionEvaluationMethod;
  evaluatedAt: string;
  expectedValue?: boolean;
  observedValue?: boolean;
};

export type FacultyEvaluationMessageRole =
  | "student"
  | "patient"
  | "mentor"
  | "system";

export type FacultyEvaluationMessage = {
  id: string;
  role: FacultyEvaluationMessageRole;
  content: string;
  createdAt?: string;
};

export type FacultyEvaluationEvent = {
  id: string;
  type: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type FacultyEvaluationInput = {
  caseId: string;
  messages: FacultyEvaluationMessage[];
  events: FacultyEvaluationEvent[];
  coveredChecklistItems: string[];
};

export type NormalizedFacultyEvaluationInput = FacultyEvaluationInput;

export type FacultyCriterionEvaluationValidationIssue = {
  code: string;
  message: string;
  caseId?: string;
  criterionId?: string;
};

export type FacultyCriterionEvaluationValidationResult = {
  valid: boolean;
  issues: FacultyCriterionEvaluationValidationIssue[];
};

export type MergeFacultyCriterionEvaluationsInput = {
  caseId: string;
  current: FacultyCriterionEvaluation[];
  incoming: FacultyCriterionEvaluation[];
};

export type MergeFacultyCriterionEvaluationsResult = {
  evaluations: FacultyCriterionEvaluation[];
  rejected: FacultyCriterionEvaluationValidationIssue[];
};
