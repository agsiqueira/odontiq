import { facultyRubrics } from "../caseRubrics";
import type { FacultyRubricCriterion } from "../types";
import {
  getEligibleEncounterEvents,
  isExaminationEvent,
  normalizeFacultyEvaluationInput,
} from "./evidence";
import type {
  FacultyCriterionEvaluation,
  FacultyEvaluationEvent,
  FacultyEvaluationEvidence,
  FacultyEvaluationInput,
} from "./types";
import { validateFacultyCriterionEvaluation } from "./validation";

export type DeterministicFacultyEvaluationCoverageCaseReport = {
  caseId: string;
  totalCriteria: number;
  deterministicallyEvaluable: number;
  expectedCaseState: number;
  neutralCriteria: number;
  remainingForSemanticEvaluation: number;
  legacyMappedWithoutReliableRule: string[];
  examinationMappedCriteria: string[];
  criteriaLackingEvaluationPath: string[];
};

const deterministicEvaluationDate = "1970-01-01T00:00:00.000Z";

export function evaluateDeterministicFacultyCriteria(
  input: FacultyEvaluationInput,
): FacultyCriterionEvaluation[] {
  const normalizedInput = normalizeFacultyEvaluationInput(input);
  const rubric = getFacultyRubric(normalizedInput.caseId);

  if (!rubric) {
    return [];
  }

  const coveredChecklistIds = new Set(normalizedInput.coveredChecklistItems);
  const encounterEvents = getEligibleEncounterEvents(normalizedInput);
  const evaluations = rubric.criteria
    .map((criterion) =>
      evaluateCriterionDeterministically({
        caseId: rubric.caseId,
        criterion,
        coveredChecklistIds,
        encounterEvents,
      }),
    )
    .filter((evaluation): evaluation is FacultyCriterionEvaluation =>
      Boolean(evaluation),
    );

  return evaluations.filter(
    (evaluation) => validateFacultyCriterionEvaluation(evaluation).valid,
  );
}

export function getDeterministicFacultyEvaluationCoverageReport(
  caseId?: string,
): DeterministicFacultyEvaluationCoverageCaseReport[] {
  const rubrics = caseId
    ? facultyRubrics.filter((rubric) => rubric.caseId === caseId)
    : facultyRubrics;

  return rubrics.map((rubric) => {
    const criteria = rubric.criteria;
    const expectedCaseStateCriteria = criteria.filter(isExpectedCaseState);
    const neutralCriteria = criteria.filter(isNeutralCriterion);
    const deterministicCriteria = criteria.filter(isFullyDeterministicCriterion);
    const examinationMappedCriteria = criteria.filter(isExaminationCriterion);
    const legacyMappedWithoutReliableRule = criteria.filter(
      (criterion) =>
        hasLegacyMappings(criterion) &&
        !isFullyDeterministicCriterion(criterion) &&
        !isExpectedCaseState(criterion),
    );
    const criteriaLackingEvaluationPath = criteria.filter(
      (criterion) =>
        !hasLegacyMappings(criterion) &&
        !isFullyDeterministicCriterion(criterion) &&
        !isExpectedCaseState(criterion) &&
        !isNeutralCriterion(criterion),
    );

    return {
      caseId: rubric.caseId,
      totalCriteria: criteria.length,
      deterministicallyEvaluable: deterministicCriteria.length,
      expectedCaseState: expectedCaseStateCriteria.length,
      neutralCriteria: neutralCriteria.length,
      remainingForSemanticEvaluation:
        criteria.length -
        deterministicCriteria.length -
        expectedCaseStateCriteria.length -
        neutralCriteria.length,
      legacyMappedWithoutReliableRule: legacyMappedWithoutReliableRule.map(
        (criterion) => criterion.id,
      ),
      examinationMappedCriteria: examinationMappedCriteria.map(
        (criterion) => criterion.id,
      ),
      criteriaLackingEvaluationPath: criteriaLackingEvaluationPath.map(
        (criterion) => criterion.id,
      ),
    };
  });
}

function evaluateCriterionDeterministically({
  caseId,
  criterion,
  coveredChecklistIds,
  encounterEvents,
}: {
  caseId: string;
  criterion: FacultyRubricCriterion;
  coveredChecklistIds: Set<string>;
  encounterEvents: FacultyEvaluationEvent[];
}) {
  if (isExpectedCaseState(criterion)) {
    return createCaseStateEvaluation(caseId, criterion);
  }

  if (criterion.expectation === "neutral") {
    return undefined;
  }

  if (!isFullyDeterministicCriterion(criterion)) {
    return undefined;
  }

  const evidence = [
    ...getLegacyChecklistEvidence(criterion, coveredChecklistIds),
    ...getExaminationEventEvidence(criterion, encounterEvents),
  ];

  if (evidence.length > 0) {
    return createDeterministicEvaluation({
      caseId,
      criterion,
      status: "met",
      confidence: 0.95,
      evidence: deduplicateEvidence(evidence),
      rationale:
        "Structured encounter evidence satisfied this deterministic faculty rubric criterion.",
    });
  }

  return createDeterministicEvaluation({
    caseId,
    criterion,
    status: "not-met",
    confidence: 0.9,
    evidence: [],
    rationale:
      "No structured legacy checklist or examination event evidence was present for this deterministic criterion.",
  });
}

function createCaseStateEvaluation(
  caseId: string,
  criterion: FacultyRubricCriterion,
): FacultyCriterionEvaluation {
  return {
    caseId,
    criterionId: criterion.id,
    status: "not-applicable",
    confidence: 1,
    evidence: [],
    rationale:
      "This non-scoring expected case-state criterion requires no learner action.",
    evaluationMethod: "case-state",
    evaluatedAt: deterministicEvaluationDate,
  };
}

function createDeterministicEvaluation({
  caseId,
  criterion,
  status,
  confidence,
  evidence,
  rationale,
}: Omit<FacultyCriterionEvaluation, "criterionId" | "evaluationMethod" | "evaluatedAt"> & {
  criterion: FacultyRubricCriterion;
}): FacultyCriterionEvaluation {
  return {
    caseId,
    criterionId: criterion.id,
    status,
    confidence,
    evidence,
    rationale,
    evaluationMethod: "deterministic",
    evaluatedAt: deterministicEvaluationDate,
  };
}

function getLegacyChecklistEvidence(
  criterion: FacultyRubricCriterion,
  coveredChecklistIds: Set<string>,
): FacultyEvaluationEvidence[] {
  return [
    ...(criterion.legacyPatientChecklistIds ?? []),
    ...(criterion.legacyClinicalChecklistIds ?? []),
  ]
    .filter((checklistId) => coveredChecklistIds.has(checklistId))
    .map((checklistId) => ({
      source: "legacy-checklist-coverage",
      excerpt: `Covered legacy checklist item: ${checklistId}`,
      metadata: {
        checklistItemId: checklistId,
      },
    }));
}

function getExaminationEventEvidence(
  criterion: FacultyRubricCriterion,
  encounterEvents: FacultyEvaluationEvent[],
): FacultyEvaluationEvidence[] {
  if (!isExaminationCriterion(criterion)) {
    return [];
  }

  return encounterEvents
    .filter(isSpecificExaminationViewedEvent)
    .map((event) => ({
      source: "examination-event",
      eventId: event.id,
      excerpt: `Viewed examination asset: ${getEventExaminationId(event) ?? event.type}`,
      metadata: {
        eventType: event.type,
        ...(event.metadata ?? {}),
      },
    }));
}

function isFullyDeterministicCriterion(criterion: FacultyRubricCriterion) {
  return (
    criterion.evaluationMode === "examination-action" ||
    criterion.evaluationMode === "legacy-compatibility"
  );
}

function isExpectedCaseState(criterion: FacultyRubricCriterion) {
  return (
    criterion.expectation === "expected-case-state" &&
    criterion.evaluationMode === "case-state" &&
    criterion.weight === 0
  );
}

function isNeutralCriterion(criterion: FacultyRubricCriterion) {
  return criterion.expectation === "neutral";
}

function isExaminationCriterion(criterion: FacultyRubricCriterion) {
  return (
    criterion.competency === "examination" ||
    criterion.evaluationMode === "examination-action"
  );
}

function hasLegacyMappings(criterion: FacultyRubricCriterion) {
  return Boolean(
    criterion.legacyPatientChecklistIds?.length ||
      criterion.legacyClinicalChecklistIds?.length,
  );
}

function isSpecificExaminationViewedEvent(event: FacultyEvaluationEvent) {
  if (!isExaminationEvent(event)) {
    return false;
  }

  return Boolean(getEventExaminationId(event));
}

function getEventExaminationId(event: FacultyEvaluationEvent) {
  return getStringMetadata(event, "examinationId") ?? getStringMetadata(event, "assetId");
}

function getStringMetadata(event: FacultyEvaluationEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function deduplicateEvidence(
  evidence: FacultyEvaluationEvidence[],
): FacultyEvaluationEvidence[] {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = [
      item.source,
      item.messageId ?? "",
      item.eventId ?? "",
      item.excerpt ?? "",
      JSON.stringify(item.metadata ?? {}),
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getFacultyRubric(caseId: string) {
  return facultyRubrics.find((rubric) => rubric.caseId === caseId);
}
