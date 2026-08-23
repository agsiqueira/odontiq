import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [
  learnerSource,
  canonicalSource,
  dashboardApiSource,
  scoringSource,
  reportBuilderSource,
  persistenceSource,
  facultyReportSource,
  facultyPdfSource,
] = await Promise.all([
  readSource("src/components/LearnerCaseReport.tsx"),
  readSource("src/components/CanonicalCaseReport.tsx"),
  readSource("src/lib/persistence/services/reportsService.ts"),
  readSource("src/lib/facultyRubric/scoring.ts"),
  readSource("src/lib/facultyRubric/report/builder.ts"),
  readSource("src/lib/persistence/completedAttemptClient.ts"),
  readSource("src/components/FacultyCaseReport.tsx"),
  readSource("src/lib/facultyRubric/report/pdf.ts"),
]);

for (const prohibited of [
  "Overall score",
  "Overall Score",
  "overallScore.percentage",
  "facultyReport.overallScore",
  "formatFacultyReportPercent",
]) {
  assert(
    !learnerSource.includes(prohibited),
    `learner report exposes aggregate scoring: ${prohibited}`,
  );
}
assert.doesNotMatch(learnerSource, /aria-(?:label|description)=.*(?:score|percent)/i);
assert.doesNotMatch(learnerSource, /title=.*(?:score|percent)/i);
assert.doesNotMatch(learnerSource, />\s*\{?[^<\n]*%[^<\n]*\}?\s*</);

// Successful, reopened, and retry-success reports all converge on this one
// learner presentation; fallback continues through the same component without a report.
assert.match(canonicalSource, /<LearnerCaseReport/);
assert.match(canonicalSource, /facultyReport=\{presentation\?\.report\}/);
assert.match(canonicalSource, /feedbackState=\{/);
assert.match(canonicalSource, /presentation\s*\?\s*"available"/);
assert.match(canonicalSource, /transcript=\{presentation\?\.transcript \?\? serverTranscript\}/);

assert.match(learnerSource, /facultyReport\.strengths\.slice\(0, 3\)/);
assert.match(
  learnerSource,
  /facultyReport\.improvementAreas\s*\.filter\(\(item\) => item\.status === "not-met"\)\s*\.slice\(0, 3\)/,
);
for (const preserved of [
  "Consultation Transcript",
  "Download Transcript",
  "Retry personalized feedback",
  "Personalized feedback was not generated",
]) {
  assert(learnerSource.includes(preserved), `learner report lost: ${preserved}`);
}

// Internal evaluation, persistence, pass/fail, faculty output, and the dashboard
// API percentage remain intentionally unchanged.
assert.match(scoringSource, /percentage/);
assert.match(scoringSource, /passStatus/);
assert.match(reportBuilderSource, /overallScore/);
assert.match(persistenceSource, /score: summary\.facultyRubricScore/);
assert.match(persistenceSource, /percentage: summary\.facultyRubricScore\?\.percentage/);
assert.match(dashboardApiSource, /percentage: attempt\.percentage/);
assert.match(facultyReportSource, /facultyReport\.overallScore\.percentage/);
assert.match(facultyPdfSource, /report\.overallScore\.percentage/);

console.log("Learner report no-score validation passed.");
