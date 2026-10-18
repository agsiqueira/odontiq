import { facultyRubrics } from "../caseRubrics";
import type { FacultyRubricCriterion } from "../types";
import type {
  FacultyCriterionEvaluation,
  FacultyCriterionEvaluationValidationIssue,
  FacultyCriterionEvaluationValidationResult,
  FacultyCriterionStatus,
  FacultyEvaluationEvidence,
  FacultyEvaluationEvidenceSource,
  FacultyCriterionEvaluationMethod,
} from "./types";

const validStatuses = new Set<FacultyCriterionStatus>([
  "met",
  "not-met",
  "uncertain",
  "not-applicable",
]);

const validEvidenceSources = new Set<FacultyEvaluationEvidenceSource>([
  "student-message",
  "patient-response",
  "conversation-exchange",
  "examination-event",
  "workflow-event",
  "legacy-checklist-coverage",
]);

const validEvaluationMethods = new Set<FacultyCriterionEvaluationMethod>([
  "deterministic",
  "deterministic-default",
  "ai-semantic",
  "hybrid",
  "case-state",
]);

export function validateFacultyCriterionEvaluation(
  evaluation: unknown,
): FacultyCriterionEvaluationValidationResult {
  const issues: FacultyCriterionEvaluationValidationIssue[] = [];

  if (!isRecord(evaluation)) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid-evaluation",
          message: "Evaluation must be an object.",
        },
      ],
    };
  }

  const caseId = getString(evaluation.caseId);
  const criterionId = getString(evaluation.criterionId);

  if (!caseId) {
    issues.push({
      code: "missing-case-id",
      message: "Evaluation is missing caseId.",
    });
  }

  if (!criterionId) {
    issues.push({
      code: "missing-criterion-id",
      message: "Evaluation is missing criterionId.",
      caseId,
    });
  }

  const rubric = caseId ? getFacultyRubric(caseId) : undefined;
  if (caseId && !rubric) {
    issues.push({
      code: "invalid-case-id",
      message: `${caseId} is not a known faculty rubric case.`,
      caseId,
      criterionId,
    });
  }

  const criterion =
    caseId && criterionId
      ? getFacultyRubricCriterion(caseId, criterionId)
      : undefined;
  if (caseId && criterionId && !criterion) {
    issues.push({
      code: "invalid-criterion-id",
      message: `${criterionId} does not belong to ${caseId}.`,
      caseId,
      criterionId,
    });
  }

  validateStatus(evaluation.status, issues, caseId, criterionId);
  validateConfidence(evaluation.confidence, issues, caseId, criterionId);
  validateEvaluationMethod(
    evaluation.evaluationMethod,
    issues,
    caseId,
    criterionId,
  );
  validateRequiredString(
    evaluation.rationale,
    "rationale",
    issues,
    caseId,
    criterionId,
  );
  validateRequiredString(
    evaluation.evaluatedAt,
    "evaluatedAt",
    issues,
    caseId,
    criterionId,
  );
  validateEvidence(evaluation.evidence, issues, caseId, criterionId);

  const isAuthoredNegativeRecommendationMatch =
    criterion?.evaluationMode === "recommendation" &&
    evaluation.expectedValue === false &&
    evaluation.observedValue === false;

  if (
    evaluation.status === "met" &&
    evaluation.evaluationMethod !== "case-state" &&
    !isAuthoredNegativeRecommendationMatch &&
    (!Array.isArray(evaluation.evidence) || evaluation.evidence.length === 0)
  ) {
    issues.push({
      code: "met-without-evidence",
      message: "Met evaluations require supporting evidence unless the method is case-state.",
      caseId,
      criterionId,
    });
  }

  if (evaluation.status === "not-applicable") {
    validateNotApplicableUse(
      criterion,
      evaluation.evaluationMethod,
      issues,
      caseId,
      criterionId,
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateFacultyCriterionEvaluations(
  evaluations: unknown[],
): FacultyCriterionEvaluationValidationResult {
  const issues = evaluations.flatMap(
    (evaluation) => validateFacultyCriterionEvaluation(evaluation).issues,
  );

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function isValidFacultyCriterionEvaluation(
  evaluation: unknown,
): evaluation is FacultyCriterionEvaluation {
  return validateFacultyCriterionEvaluation(evaluation).valid;
}

function validateStatus(
  status: unknown,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  if (
    typeof status !== "string" ||
    !validStatuses.has(status as FacultyCriterionStatus)
  ) {
    issues.push({
      code: "invalid-status",
      message: "Evaluation has an invalid status.",
      caseId,
      criterionId,
    });
  }
}

function validateConfidence(
  confidence: unknown,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  if (
    typeof confidence !== "number" ||
    Number.isNaN(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    issues.push({
      code: "invalid-confidence",
      message: "Evaluation confidence must be between 0 and 1.",
      caseId,
      criterionId,
    });
  }
}

function validateEvaluationMethod(
  evaluationMethod: unknown,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  if (
    typeof evaluationMethod !== "string" ||
    !validEvaluationMethods.has(
      evaluationMethod as FacultyCriterionEvaluationMethod,
    )
  ) {
    issues.push({
      code: "invalid-evaluation-method",
      message: "Evaluation has an invalid evaluationMethod.",
      caseId,
      criterionId,
    });
  }
}

function validateRequiredString(
  value: unknown,
  field: string,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({
      code: "missing-required-field",
      message: `Evaluation is missing ${field}.`,
      caseId,
      criterionId,
    });
  }
}

function validateEvidence(
  evidence: unknown,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  if (!Array.isArray(evidence)) {
    issues.push({
      code: "invalid-evidence",
      message: "Evaluation evidence must be an array.",
      caseId,
      criterionId,
    });
    return;
  }

  for (const item of evidence) {
    if (!isValidEvidence(item)) {
      issues.push({
        code: "invalid-evidence-source",
        message: "Evaluation evidence contains an invalid source or shape.",
        caseId,
        criterionId,
      });
    }
  }
}

function validateNotApplicableUse(
  criterion: FacultyRubricCriterion | undefined,
  evaluationMethod: unknown,
  issues: FacultyCriterionEvaluationValidationIssue[],
  caseId?: string,
  criterionId?: string,
) {
  const validConditionalRecommendation =
    criterion?.name === "selected-appropriate-iv-antibiotic" &&
    criterion.expectedValue === false;
  if (validConditionalRecommendation) {
    return;
  }
  if (
    !criterion ||
    criterion.expectation !== "expected-case-state" ||
    criterion.weight !== 0 ||
    evaluationMethod !== "case-state"
  ) {
    issues.push({
      code: "invalid-not-applicable",
      message:
        "not-applicable is only valid for non-scoring expected-case-state criteria evaluated by case-state.",
      caseId,
      criterionId,
    });
  }
}

function isValidEvidence(value: unknown): value is FacultyEvaluationEvidence {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.source !== "string" ||
    !validEvidenceSources.has(value.source as FacultyEvaluationEvidenceSource)
  ) {
    return false;
  }

  return (
    optionalString(value.messageId) &&
    optionalString(value.eventId) &&
    optionalString(value.excerpt) &&
    optionalMetadata(value.metadata)
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function optionalMetadata(value: unknown) {
  return value === undefined || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFacultyRubric(caseId: string) {
  return facultyRubrics.find((rubric) => rubric.caseId === caseId);
}

function getFacultyRubricCriterion(caseId: string, criterionId: string) {
  return getFacultyRubric(caseId)?.criteria.find(
    (criterion) => criterion.id === criterionId,
  );
}
