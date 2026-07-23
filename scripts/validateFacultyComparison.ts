import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  buildFacultyComparisonSections,
  getAuthoredExpectedValue,
  getFacultyComparisonResultLabel,
} from "../src/lib/facultyRubric/report/comparison";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const recommendation = facultyRubrics[0]?.criteria.find(
  (item) => item.evaluationMode === "recommendation",
);
assert(recommendation, "Case 1 recommendation fixture missing");
const label = (expected: boolean, observed: boolean) =>
  getFacultyComparisonResultLabel({
    criterion: recommendation,
    expected,
    observed,
    status: expected === observed ? "met" : "not-met",
  });
assert(label(true, true) === "Met", "Marked + observed should be full credit");
assert(label(true, false) === "Missed", "Marked + absent should be zero");
assert(label(false, false) === "Correctly avoided", "Unmarked + absent should be full credit");
assert(label(false, true) === "Incorrect recommendation", "Unmarked + observed should be zero");

const rubric = facultyRubrics[0];
assert(rubric, "Case 1 rubric missing");
const evaluations = rubric.criteria.map((criterion) => ({
  caseId: rubric.caseId,
  criterionId: criterion.id,
  status:
    criterion.name === "selected-appropriate-iv-antibiotic"
      ? ("not-applicable" as const)
      : ("met" as const),
  confidence: 1,
  evidence: [],
  rationale: "Comparison validation.",
  evaluationMethod: "deterministic" as const,
  evaluatedAt: "2026-07-12T00:00:00.000Z",
  expectedValue: getAuthoredExpectedValue(criterion),
  observedValue: true,
}));
const sections = buildFacultyComparisonSections(rubric.caseId, evaluations);
const rows = sections.flatMap((section) => section.rows);
assert(
  rows.length === rubric.criteria.filter((criterion) => criterion.expectation !== "neutral").length,
  "Every active authored item should appear once and neutral items should be omitted",
);
assert(
  sections.every((section) => {
    const positions = section.rows.map((row) =>
      rubric.criteria.findIndex((criterion) => criterion.id === row.criterionId),
    );
    return positions.every((position, index) => index === 0 || position > positions[index - 1]!);
  }),
  "Authored item order should be preserved within each section",
);
const recommended = rows.find((row) => row.criterionId === "C1-MP-001");
assert(recommended?.result === "Met", "Completed Case 1 recommendation should be met");
const antibiotic = rows.find((row) => row.criterionId === "C1-MP-004");
assert(antibiotic?.result === "Not applicable", "Conditional antibiotic selection should be not applicable");

console.log("Faculty comparison validation passed.");
