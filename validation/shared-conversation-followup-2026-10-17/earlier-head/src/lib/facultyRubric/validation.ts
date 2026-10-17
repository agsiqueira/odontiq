import { CASE_DATA } from "@/data/cases";
import { facultyRubrics } from "./caseRubrics";
import type {
  FacultyRubric,
  FacultyRubricCriterion,
  FacultyRubricValidationIssue,
  FacultyRubricValidationResult,
} from "./types";

const expectedCaseIds = CASE_DATA.map((caseData) => caseData.metadata.id);

export function validateFacultyRubrics(
  rubrics: FacultyRubric[] = facultyRubrics,
): FacultyRubricValidationResult {
  const issues: FacultyRubricValidationIssue[] = [];
  const globalCriterionIds = new Map<string, string>();

  for (const caseId of expectedCaseIds) {
    if (!rubrics.some((rubric) => rubric.caseId === caseId)) {
      issues.push({
        code: "missing-case-rubric",
        message: `Missing faculty rubric for ${caseId}.`,
        caseId,
      });
    }
  }

  for (const rubric of rubrics) {
    const caseData = CASE_DATA.find(
      (candidate) => candidate.metadata.id === rubric.caseId,
    );
    const caseCriterionNames = new Set<string>();
    const patientChecklistIds = new Set(
      caseData?.patientChecklist.map((item) => item.id) ?? [],
    );
    const clinicalChecklistIds = new Set(
      caseData?.clinicalChecklist.map((item) => item.id) ?? [],
    );

    if (!caseData) {
      issues.push({
        code: "unknown-case-id",
        message: `Faculty rubric references unknown case ${rubric.caseId}.`,
        caseId: rubric.caseId,
      });
    }

    for (const criterion of rubric.criteria) {
      validateCriterionShape(rubric.caseId, criterion, issues);

      const previousCaseId = globalCriterionIds.get(criterion.id);
      if (previousCaseId) {
        issues.push({
          code: "duplicate-criterion-id",
          message: `${criterion.id} is used by both ${previousCaseId} and ${rubric.caseId}.`,
          caseId: rubric.caseId,
          criterionId: criterion.id,
        });
      } else {
        globalCriterionIds.set(criterion.id, rubric.caseId);
      }

      if (caseCriterionNames.has(criterion.name)) {
        issues.push({
          code: "duplicate-criterion-name",
          message: `${criterion.name} appears more than once in ${rubric.caseId}.`,
          caseId: rubric.caseId,
          criterionId: criterion.id,
        });
      }
      caseCriterionNames.add(criterion.name);

      for (const patientChecklistId of criterion.legacyPatientChecklistIds ??
        []) {
        if (!patientChecklistIds.has(patientChecklistId)) {
          issues.push({
            code: "invalid-legacy-patient-mapping",
            message: `${criterion.id} maps to missing patient checklist item ${patientChecklistId}.`,
            caseId: rubric.caseId,
            criterionId: criterion.id,
          });
        }
      }

      for (const clinicalChecklistId of criterion.legacyClinicalChecklistIds ??
        []) {
        if (!clinicalChecklistIds.has(clinicalChecklistId)) {
          issues.push({
            code: "invalid-legacy-clinical-mapping",
            message: `${criterion.id} maps to missing clinical checklist item ${clinicalChecklistId}.`,
            caseId: rubric.caseId,
            criterionId: criterion.id,
          });
        }
      }
    }

    assertSerializable(rubric, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function validateCriterionShape(
  caseId: string,
  criterion: FacultyRubricCriterion,
  issues: FacultyRubricValidationIssue[],
) {
  const requiredStringFields: Array<keyof FacultyRubricCriterion> = [
    "id",
    "name",
    "title",
    "description",
    "competency",
    "evaluationMode",
    "expectation",
    "source",
  ];

  for (const field of requiredStringFields) {
    if (typeof criterion[field] !== "string" || criterion[field] === "") {
      issues.push({
        code: "missing-required-field",
        message: `${criterion.id || "(missing id)"} has invalid ${field}.`,
        caseId,
        criterionId: criterion.id,
      });
    }
  }

  if (criterion.expectation === "neutral") {
    if (criterion.weight !== 0) {
      issues.push({
        code: "neutral-weight",
        message: `${criterion.id} is neutral but carries weight ${criterion.weight}.`,
        caseId,
        criterionId: criterion.id,
      });
    }
  } else if (
    criterion.expectation === "required" &&
    criterion.weight <= 0
  ) {
    issues.push({
      code: "non-positive-required-weight",
      message: `${criterion.id} must have a positive score weight.`,
      caseId,
      criterionId: criterion.id,
    });
  } else if (criterion.weight < 0) {
    issues.push({
      code: "negative-weight",
      message: `${criterion.id} must not have a negative score weight.`,
      caseId,
      criterionId: criterion.id,
    });
  }

  if (
    criterion.expectation === "expected-case-state" &&
    criterion.evaluationMode !== "case-state"
  ) {
    issues.push({
      code: "case-state-mode",
      message: `${criterion.id} is an expected case state but does not use case-state mode.`,
      caseId,
      criterionId: criterion.id,
    });
  }

  if (criterion.critical && criterion.description.length < 30) {
    issues.push({
      code: "critical-description-too-short",
      message: `${criterion.id} is critical but has an underspecified description.`,
      caseId,
      criterionId: criterion.id,
    });
  }
}

function assertSerializable(
  rubric: FacultyRubric,
  issues: FacultyRubricValidationIssue[],
) {
  try {
    JSON.parse(JSON.stringify(rubric)) as FacultyRubric;
  } catch {
    issues.push({
      code: "serialization-failed",
      message: `${rubric.caseId} faculty rubric cannot be safely serialized.`,
      caseId: rubric.caseId,
    });
  }
}
