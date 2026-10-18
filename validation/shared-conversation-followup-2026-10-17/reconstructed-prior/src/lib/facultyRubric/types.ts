export type FacultyRubricCompetency =
  | "information-gathering"
  | "clinical-findings"
  | "clinical-interpretation"
  | "management-planning"
  | "patient-communication"
  | "procedural-decision"
  | "examination";

export type FacultyRubricEvaluationMode =
  | "conversation-question"
  | "finding-elicitation"
  | "clinical-statement"
  | "recommendation"
  | "patient-education"
  | "shared-decision-making"
  | "procedural-choice"
  | "examination-action"
  | "case-state"
  | "legacy-compatibility";

export type FacultyRubricExpectation =
  | "required"
  | "expected-case-state"
  | "neutral";

export type FacultyRubricSource =
  | "faculty-history-question"
  | "faculty-clinical-checklist"
  | "existing-case-data"
  | "legacy-checklist";

export type LegacyRubricMapping = {
  criterionId: string;
  patientChecklistIds?: string[];
  clinicalChecklistIds?: string[];
};

export type FacultyRubricCriterion = {
  id: string;
  name: string;
  title: string;
  description: string;
  competency: FacultyRubricCompetency;
  evaluationMode: FacultyRubricEvaluationMode;
  expectation: FacultyRubricExpectation;
  weight: number;
  provisionalWeight?: boolean;
  critical: boolean;
  source: FacultyRubricSource;
  acceptedConcepts?: string[];
  examples?: string[];
  expectedValue?: string | boolean | string[];
  legacyPatientChecklistIds?: string[];
  legacyClinicalChecklistIds?: string[];
  reportLabel?: string;
  facultyNotes?: string;
};

export type FacultyRubric = {
  caseId: string;
  title: string;
  criteria: FacultyRubricCriterion[];
};

export type FacultyRubricValidationIssue = {
  code: string;
  message: string;
  caseId?: string;
  criterionId?: string;
};

export type FacultyRubricValidationResult = {
  valid: boolean;
  issues: FacultyRubricValidationIssue[];
};
