import { facultyRubrics } from "../caseRubrics";
import { FINAL_FACULTY_RUBRIC_POLICY } from "./policy";
import type { FacultyRubric, FacultyRubricCriterion } from "../types";
import type {
  FacultyCriterionCalibration,
  FacultyRubricCalibrationCase,
  ResolvedFacultyCriterionCalibration,
  RubricCalibrationSource,
} from "./types";

const unsupportedProceduralCriteria: FacultyCriterionCalibration[] = [
  {
    criterionId: "C3-PD-003",
    supported: false,
    source: "awaiting-clarification",
    rationale:
      "Faculty source lists exact anesthetic formulations, but current encounter evidence does not reliably distinguish whether the learner must state the exact formulation versus the broader local-anesthetic strategy.",
    facultyDecisionRequired: true,
  },
  {
    criterionId: "C4-PD-001",
    supported: false,
    source: "awaiting-clarification",
    rationale:
      "The criterion depends on confirming tooth-location assumptions and how explicitly the learner must select maxillary infiltration before active scoring.",
    facultyDecisionRequired: true,
  },
  {
    criterionId: "C5-PD-002",
    supported: false,
    source: "awaiting-clarification",
    rationale:
      "Faculty source lists exact anesthetic formulations, but current encounter evidence does not reliably distinguish whether the learner must state the exact formulation versus the broader local-anesthetic strategy.",
    facultyDecisionRequired: true,
  },
];

export const facultyRubricCalibration: FacultyRubricCalibrationCase[] =
  facultyRubrics.map((rubric) => ({
    caseId: rubric.caseId,
    criteria: unsupportedProceduralCriteria.filter((criterion) =>
      rubric.criteria.some((item) => item.id === criterion.criterionId),
    ),
  }));

export function getResolvedFacultyRubricCalibration(
  caseId: string,
): ResolvedFacultyCriterionCalibration[] {
  const rubric = facultyRubrics.find((candidate) => candidate.caseId === caseId);

  if (!rubric) {
    return [];
  }

  return resolveRubricCalibration(rubric);
}

export function getAllResolvedFacultyRubricCalibration(): ResolvedFacultyCriterionCalibration[] {
  return facultyRubrics.flatMap((rubric) => resolveRubricCalibration(rubric));
}

export function getUnsupportedFacultyRubricCriterionIds(caseId: string) {
  return getResolvedFacultyRubricCalibration(caseId)
    .filter((criterion) => !criterion.supported && criterion.scored)
    .map((criterion) => criterion.criterionId);
}

function resolveRubricCalibration(
  rubric: FacultyRubric,
): ResolvedFacultyCriterionCalibration[] {
  const overrides = new Map(
    facultyRubricCalibration
      .find((calibration) => calibration.caseId === rubric.caseId)
      ?.criteria.map((criterion) => [criterion.criterionId, criterion]) ?? [],
  );

  return rubric.criteria.map((criterion) =>
    resolveCriterionCalibration(rubric.caseId, criterion, overrides.get(criterion.id)),
  );
}

function resolveCriterionCalibration(
  caseId: string,
  criterion: FacultyRubricCriterion,
  override: FacultyCriterionCalibration | undefined,
): ResolvedFacultyCriterionCalibration {
  const scored = isScoredCriterion(criterion);
  const defaultWeightSource = getDefaultWeightSource(criterion);
  const defaultCriticalSource = getDefaultCriticalSource(criterion);
  const defaultSupportSource = getDefaultSupportSource(criterion);
  const proposedWeight =
    override?.weight !== undefined ? override.weight : normalizeWeight(criterion.weight);
  const critical =
    override?.critical !== undefined ? override.critical : criterion.critical;
  const supported =
    override?.supported !== undefined ? override.supported : true;
  const facultyDecisionRequired =
    override?.facultyDecisionRequired === true ||
    criterion.provisionalWeight === true ||
    override?.source === "awaiting-clarification";

  return {
    caseId,
    criterionId: criterion.id,
    title: criterion.title,
    competency: criterion.competency,
    evaluationMode: criterion.evaluationMode,
    expectation: criterion.expectation,
    scored,
    currentWeight: scored ? normalizeWeight(criterion.weight) : 0,
    proposedWeight: scored ? proposedWeight : 0,
    activeScoreWeight: scored && supported
      ? FINAL_FACULTY_RUBRIC_POLICY.criterionWeight
      : 0,
    weightSource: override?.weight !== undefined ? override.source : defaultWeightSource,
    weightRationale:
      override?.weight !== undefined
        ? (override.rationale ?? "Calibration override supplies the proposed weight.")
        : getDefaultWeightRationale(criterion),
    provisionalWeight: criterion.provisionalWeight === true,
    critical,
    criticalSource:
      override?.critical !== undefined ? override.source : defaultCriticalSource,
    criticalRationale:
      override?.critical !== undefined
        ? (override.rationale ?? "Calibration override supplies the critical flag.")
        : getDefaultCriticalRationale(criterion),
    supported,
    supportSource:
      override?.supported !== undefined ? override.source : defaultSupportSource,
    supportRationale:
      override?.supported !== undefined
        ? (override.rationale ?? "Calibration override supplies support status.")
        : getDefaultSupportRationale(criterion),
    legacyMapping: getLegacyMapping(criterion),
    facultyDecisionRequired,
    rubricCriterion: criterion,
  };
}

function isScoredCriterion(criterion: FacultyRubricCriterion): boolean {
  return criterion.expectation === "required" && normalizeWeight(criterion.weight) > 0;
}

function getDefaultWeightSource(
  criterion: FacultyRubricCriterion,
): RubricCalibrationSource {
  if (criterion.provisionalWeight) {
    return "provisional-default";
  }

  if (hasLegacyMapping(criterion)) {
    return "legacy-derived";
  }

  return "repository-derived";
}

function getDefaultCriticalSource(
  criterion: FacultyRubricCriterion,
): RubricCalibrationSource {
  return criterion.critical ? "repository-derived" : "repository-derived";
}

function getDefaultSupportSource(
  criterion: FacultyRubricCriterion,
): RubricCalibrationSource {
  return hasLegacyMapping(criterion) ? "legacy-derived" : "repository-derived";
}

function getDefaultWeightRationale(criterion: FacultyRubricCriterion): string {
  if (criterion.provisionalWeight) {
    return "Default rubric-only weight retained pending faculty calibration.";
  }

  if (hasLegacyMapping(criterion)) {
    return "Weight retained from the current rubric with legacy checklist mapping present.";
  }

  return "Weight retained from the repository rubric definition.";
}

function getDefaultCriticalRationale(criterion: FacultyRubricCriterion): string {
  return criterion.critical
    ? "Critical flag retained from repository rubric definition."
    : "Non-critical flag retained from repository rubric definition.";
}

function getDefaultSupportRationale(criterion: FacultyRubricCriterion): string {
  return hasLegacyMapping(criterion)
    ? "Supported by existing legacy checklist mapping or deterministic/semantic evaluation pathway."
    : "Supported by current repository rubric and semantic evaluation pathway unless explicitly marked otherwise.";
}

function getLegacyMapping(criterion: FacultyRubricCriterion): string | null {
  const mappings = [
    ...(criterion.legacyPatientChecklistIds ?? []).map((id) => `patient:${id}`),
    ...(criterion.legacyClinicalChecklistIds ?? []).map((id) => `clinical:${id}`),
  ];

  return mappings.length > 0 ? mappings.join(", ") : null;
}

function hasLegacyMapping(criterion: FacultyRubricCriterion): boolean {
  return Boolean(
    criterion.legacyPatientChecklistIds?.length ||
      criterion.legacyClinicalChecklistIds?.length,
  );
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}
