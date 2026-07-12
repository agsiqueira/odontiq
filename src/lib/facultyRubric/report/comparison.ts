import { facultyRubrics } from "../caseRubrics";
import type { FacultyCriterionEvaluation } from "../evaluation/types";
import type { FacultyRubricCriterion } from "../types";

export type FacultyComparisonLabel =
  | "Met"
  | "Correctly avoided"
  | "Missed"
  | "Incorrect finding"
  | "Incorrect recommendation"
  | "Not applicable"
  | "Uncertain";

export type FacultyComparisonRow = {
  criterionId: string;
  itemName: string;
  expected: "Yes" | "No" | "Not applicable";
  student: "Yes" | "No" | "Uncertain" | "Not applicable";
  result: FacultyComparisonLabel;
  evidence: string[];
};

export type FacultyComparisonSection = { title: string; rows: FacultyComparisonRow[] };

export function buildFacultyComparisonSections(
  caseId: string,
  evaluations: FacultyCriterionEvaluation[],
): FacultyComparisonSection[] {
  const rubric = facultyRubrics.find((item) => item.caseId === caseId);
  if (!rubric) return [];
  const byId = new Map(evaluations.map((item) => [item.criterionId, item]));
  const sections = new Map<string, FacultyComparisonRow[]>();
  for (const criterion of rubric.criteria) {
    const evaluation = byId.get(criterion.id);
    const row = buildFacultyComparisonRow(criterion, evaluation);
    const title = getSectionTitle(criterion);
    const rows = sections.get(title) ?? [];
    rows.push(row);
    sections.set(title, rows);
  }
  return [...sections].map(([title, rows]) => ({ title, rows }));
}

export function buildFacultyComparisonRow(
  criterion: FacultyRubricCriterion,
  evaluation?: FacultyCriterionEvaluation,
): FacultyComparisonRow {
  if (!evaluation || evaluation.status === "not-applicable") {
    return {
      criterionId: criterion.id,
      itemName: criterion.reportLabel ?? criterion.title,
      expected: "Not applicable",
      student: "Not applicable",
      result: "Not applicable",
      evidence: [],
    };
  }
  const expected = evaluation.expectedValue ?? getAuthoredExpectedValue(criterion);
  const observed = evaluation.observedValue ?? (evaluation.status === "met");
  return {
    criterionId: criterion.id,
    itemName: criterion.reportLabel ?? criterion.title,
    expected: expected ? "Yes" : "No",
    student: evaluation.status === "uncertain" ? "Uncertain" : observed ? "Yes" : "No",
    result: getFacultyComparisonResultLabel({ criterion, expected, observed, status: evaluation.status }),
    evidence: evaluation.evidence.map((item) => item.excerpt ?? item.eventId ?? item.source),
  };
}

export function getFacultyComparisonResultLabel({
  criterion,
  expected,
  observed,
  status,
}: {
  criterion: FacultyRubricCriterion;
  expected: boolean;
  observed: boolean;
  status: FacultyCriterionEvaluation["status"];
}): FacultyComparisonLabel {
  if (status === "not-applicable") return "Not applicable";
  if (status === "uncertain") return "Uncertain";
  if (expected === observed) return expected ? "Met" : "Correctly avoided";
  if (expected) return "Missed";
  return criterion.evaluationMode === "recommendation"
    ? "Incorrect recommendation"
    : "Incorrect finding";
}

export function getAuthoredExpectedValue(criterion: FacultyRubricCriterion) {
  if (typeof criterion.expectedValue === "boolean") return criterion.expectedValue;
  if (criterion.evaluationMode === "recommendation") return false;
  return true;
}

function getSectionTitle(criterion: FacultyRubricCriterion) {
  if (criterion.competency === "information-gathering") return "Signs and symptoms";
  if (criterion.competency === "clinical-findings") return "Emergency assessment";
  if (criterion.competency === "clinical-interpretation") return "Airway patency";
  if (criterion.competency === "examination") return "Examination";
  return "Immediate recommendations";
}
