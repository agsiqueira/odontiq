import { facultyRubrics } from "./caseRubrics";
import type { FacultyRubricCompetency } from "./types";

export { facultyRubrics } from "./caseRubrics";
export {
  buildFacultyConversationExchanges,
  buildFacultyEvaluationInput,
  buildFacultySemanticEvaluationUserPrompt,
  createFacultyRubricTranscriptRevision,
  evaluateDeterministicFacultyCriteria,
  evaluateFacultyRubricForEncounter,
  evaluateSemanticFacultyCriteria,
  FACULTY_SEMANTIC_EVALUATION_SYSTEM_PROMPT,
  FACULTY_RUBRIC_VERSION,
  getContextualPatientMessages,
  getDeterministicFacultyEvaluationCoverageReport,
  getEligibleEncounterEvents,
  getEligibleLearnerMessages,
  getSemanticFacultyCriteria,
  getSemanticFacultyEvaluationCoverageReport,
  isExaminationEvent,
  isFacultyRubricEvaluationStateStale,
  isWorkflowEvent,
  isValidFacultyCriterionEvaluation,
  mergeFacultyCriterionEvaluations,
  normalizeFacultyEvaluationInput,
  parseAndValidateAiFacultyEvaluationResponse,
  validateFacultyCriterionEvaluation,
  validateFacultyCriterionEvaluations,
} from "./evaluation";
export type {
  AiFacultyCriterionEvaluation,
  AiFacultyCriterionEvaluationParseResult,
  DeterministicFacultyEvaluationCoverageCaseReport,
  EvaluateFacultyRubricForEncounterInput,
  EvaluateSemanticFacultyCriteriaInput,
  EvaluateSemanticFacultyCriteriaResult,
  FacultyCriterionEvaluation,
  FacultyCriterionEvaluationMethod,
  FacultyCriterionEvaluationValidationIssue,
  FacultyCriterionEvaluationValidationResult,
  FacultyCriterionStatus,
  FacultyConversationExchange,
  FacultyRubricEncounterEvaluationInput,
  FacultyRubricEncounterEventInput,
  FacultyRubricEvaluationState,
  FacultyRubricEvaluationStatus,
  FacultyEvaluationEvent,
  FacultyEvaluationEvidence,
  FacultyEvaluationEvidenceSource,
  FacultyEvaluationInput,
  FacultyEvaluationMessage,
  FacultyEvaluationMessageRole,
  FacultySemanticEvaluationModel,
  MergeFacultyCriterionEvaluationsInput,
  MergeFacultyCriterionEvaluationsResult,
  NormalizedFacultyEvaluationInput,
} from "./evaluation";
export type {
  FacultyRubric,
  FacultyRubricCompetency,
  FacultyRubricCriterion,
  FacultyRubricEvaluationMode,
  FacultyRubricExpectation,
  FacultyRubricSource,
  FacultyRubricValidationIssue,
  FacultyRubricValidationResult,
  LegacyRubricMapping,
} from "./types";
export { validateFacultyRubrics } from "./validation";
export {
  FACULTY_RUBRIC_SCORING_VERSION,
  FACULTY_RUBRIC_UNCERTAINTY_EXPLANATION,
  getFacultyRubricCalibrationReport,
  getFacultyRubricCriterionStatusDisplay,
  getFacultyRubricPassStatus,
  scoreFacultyRubricEvaluations,
} from "./scoring";
export type {
  FacultyRubricCalibrationCaseReport,
  FacultyRubricCalibrationCriterion,
  FacultyRubricCompetencyScore,
  FacultyRubricCriterionStatusDisplay,
  FacultyRubricCriterionScore,
  FacultyRubricPassStatus,
  FacultyRubricSafetyStatus,
  FacultyRubricScore,
  FacultyRubricScoringInput,
  FacultyRubricScoringStatus,
} from "./scoring";
export {
  buildFacultyRubricCalibrationCsv,
  buildFacultyRubricCalibrationExport,
  compareDirectAndCompetencyBalancedScore,
  DEFAULT_EVALUATION_COVERAGE_POLICY,
  DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
  FINAL_FACULTY_RUBRIC_POLICY,
  facultyRubricCalibration,
  getAllResolvedFacultyRubricCalibration,
  getCriticalPolicyProjections,
  getFacultyRubricActivationReadiness,
  getFacultyRubricScenarioResults,
  getResolvedFacultyRubricCalibration,
  getUnsupportedFacultyRubricCriterionIds,
  isCriticalMissPolicy,
  projectCriticalMissPolicy,
  validateEvaluationCoveragePolicy,
  validateFacultyRubricActivationPolicy,
  validateFacultyRubricCalibration,
} from "./calibration";
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
} from "./calibration";

export function getFacultyRubric(caseId: string) {
  return facultyRubrics.find((rubric) => rubric.caseId === caseId);
}

export function getFacultyRubricCriterion(
  caseId: string,
  criterionId: string,
) {
  return getFacultyRubric(caseId)?.criteria.find(
    (criterion) => criterion.id === criterionId,
  );
}

export function getFacultyRubricByCompetency(
  caseId: string,
  competency: FacultyRubricCompetency,
) {
  return (
    getFacultyRubric(caseId)?.criteria.filter(
      (criterion) => criterion.competency === competency,
    ) ?? []
  );
}
export * from "./report";
