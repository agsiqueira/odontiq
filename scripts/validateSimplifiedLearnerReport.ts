import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildLearnerTranscriptFilename,
  buildLearnerTranscriptText,
} from "../src/lib/learnerTranscriptDownload";

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
  "Overall score",
  "Strengths",
  "Areas for Improvement",
  "Consultation Transcript",
  "Download Transcript",
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
assert(learnerSource.includes("facultyReport.overallScore.percentage"));
assert(learnerSource.includes("facultyReport.strengths.slice(0, 3)"));
assert.match(
  learnerSource,
  /facultyReport\.improvementAreas\s*\.filter\(\(item\) => item\.status === "not-met"\)\s*\.slice\(0, 3\)/,
);

for (const prohibitedLearnerText of [
  "Back to Mentor",
  "Download PDF",
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

const transcript = [
  {
    id: "student-1",
    role: "student" as const,
    text: "Exact provider wording.",
    timestamp: "2026-08-04T14:30:00.000Z",
  },
  {
    id: "patient-1",
    role: "patient" as const,
    text: "Exact patient wording.",
    timestamp: "2026-08-04T14:30:05.000Z",
  },
];
const download = buildLearnerTranscriptText(
  {
    patientName: "Test Patient",
    caseTitle: "Test Case",
    caseLabel: "Case 01",
    completedAt: "2026-08-04T14:31:00.000Z",
  },
  transcript,
);

for (const expected of [
  "Test Patient",
  "Case 01",
  "2026-08-04T14:31:00.000Z",
  "Exact provider wording.",
  "2026-08-04T14:30:00.000Z",
  "Exact patient wording.",
  "2026-08-04T14:30:05.000Z",
]) {
  assert(download.includes(expected), `Transcript export omitted: ${expected}`);
}

for (const prohibitedExportText of [
  "score",
  "strength",
  "improvement",
  "pass",
  "rubric",
  "evidence",
  "critical",
  "diagnostic",
]) {
  assert.equal(
    download.toLowerCase().includes(prohibitedExportText),
    false,
    `Transcript export contains prohibited report content: ${prohibitedExportText}`,
  );
}

assert.equal(buildLearnerTranscriptFilename("case/01"), "odontiq-case-01-transcript.txt");
assert(facultySource.includes("Critical Safety Items") || facultySource.includes("criticalSafetySummary"));
assert(facultySource.includes("Download PDF"));
assert(pdfSource.includes("generateCanonicalFacultyPdfBlob"));

console.log("Simplified learner consultation report validation passed.");
