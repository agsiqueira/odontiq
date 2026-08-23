import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [learnerSource, canonicalSource, facultySource, pdfSource, reportPage] =
  await Promise.all([
    readSource("src/components/LearnerCaseReport.tsx"),
    readSource("src/components/CanonicalCaseReport.tsx"),
    readSource("src/components/FacultyCaseReport.tsx"),
    readSource("src/lib/facultyRubric/report/pdf.ts"),
    readSource("src/app/reports/[caseId]/page.tsx"),
  ]);

for (const requiredLearnerText of [
  "Consultation Report",
  "Strengths",
  "Areas for Improvement",
  "Consultation Transcript",
  "Download PDF Report",
  "Try Another Case",
  "Return Home",
]) {
  assert(
    learnerSource.includes(requiredLearnerText),
    `Learner report is missing: ${requiredLearnerText}`,
  );
}

assert(reportPage.includes('title="Consultation Report"'));
assert(learnerSource.includes("{patientName}"));
assert(learnerSource.includes("{caseTitle}"));
assert(learnerSource.includes("facultyReport.strengths.slice(0, 3)"));
assert.match(
  learnerSource,
  /facultyReport\.improvementAreas\s*\.filter\(\(item\) => item\.status === "not-met"\)\s*\.slice\(0, 3\)/,
);

for (const prohibitedLearnerText of [
  "Back to Mentor",
  "Overall score",
  "facultyReport.overallScore",
  "formatFacultyReportPercent",
  "Required score",
  "minimum score",
  "earnedPoints",
  "possiblePoints",
  "comparisonSections",
  "Competency Summary",
  "Not Met",
  "Criterion evidence",
  "Critical safety",
  "criticalSafetySummary",
  "rubricVersion",
  "scoringVersion",
  "reportMetadata",
]) {
  assert.equal(
    learnerSource.includes(prohibitedLearnerText),
    false,
    `Learner presentation exposes prohibited detail: ${prohibitedLearnerText}`,
  );
}

assert(canonicalSource.includes("<LearnerCaseReport"));
assert.equal(canonicalSource.includes("<FacultyCaseReport"), false);
assert.equal(canonicalSource.includes("generateCanonicalFacultyPdfBlob"), false);

assert.equal(learnerSource.includes("Download Transcript"), false);
assert.equal(learnerSource.includes("text/plain"), false);
assert.equal(learnerSource.includes(".txt"), false);
assert(facultySource.includes("Critical Safety Items") || facultySource.includes("criticalSafetySummary"));
assert(facultySource.includes("Download PDF"));
assert(pdfSource.includes("generateCanonicalFacultyPdfBlob"));

console.log("Simplified learner consultation report validation passed.");
