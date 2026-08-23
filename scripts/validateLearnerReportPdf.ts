import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { CASE_DATA } from "../src/data/cases";
import { getCaseDisplayLabel } from "../src/lib/caseDisplay";
import {
  buildLearnerReportPdfFilename,
  generateLearnerReportPdfBlob,
  type LearnerReportPdfModel,
} from "../src/lib/learnerReportPdf";

const completedAt = "2026-07-12T12:00:00.000Z";
const transcript = [
  {
    role: "student" as const,
    text: "How can I help you today?",
    timestamp: "2026-07-12T11:58:00.000Z",
  },
  {
    role: "patient" as const,
    text: "My tooth hurts when I bite.",
    timestamp: "2026-07-12T11:58:01.000Z",
  },
];

for (const caseData of CASE_DATA) {
  const model: LearnerReportPdfModel = {
    caseId: caseData.metadata.id,
    caseLabel: getCaseDisplayLabel(caseData.metadata.id),
    patientName: caseData.patient.name,
    complaint: caseData.metadata.chiefComplaint,
    completedAt,
    feedback: {
      status: "available",
      strengths: ["Strength one", "Strength two", "Strength three", "Strength four"],
      improvementAreas: [
        "Improvement one",
        "Improvement two",
        "Improvement three",
        "Improvement four",
      ],
    },
    transcript,
  };
  assert.equal(model.complaint, caseData.metadata.chiefComplaint);
  const before = JSON.stringify(model);
  const blob = generateLearnerReportPdfBlob(model);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdfText = new TextDecoder().decode(bytes);

  assert(pdfText.startsWith("%PDF-1.4"));
  assert(pdfText.trimEnd().endsWith("%%EOF"));
  assert(Number(pdfText.match(/\/Count (\d+)/)?.[1] ?? 0) >= 1);
  for (const expected of [
    "OdontIQ Consultation Report",
    model.caseLabel,
    model.patientName,
    "Completed",
    "Jul 12, 2026, 12:00:00 UTC",
    "Strengths",
    "Strength one",
    "Strength two",
    "Strength three",
    "Areas for Improvement",
    "Improvement one",
    "Improvement two",
    "Improvement three",
    "Consultation Transcript",
    "Provider - Jul 12, 2026, 11:58:00 UTC",
    transcript[0].text,
    "Patient - Jul 12, 2026, 11:58:01 UTC",
    transcript[1].text,
  ]) {
    assert(pdfText.includes(expected), `${caseData.metadata.id} PDF omitted: ${expected}`);
  }
  assertWordsInOrder(pdfText, model.complaint);
  assert(!pdfText.includes("Strength four"));
  assert(!pdfText.includes("Improvement four"));
  assert(pdfText.indexOf("Patient Complaint") < pdfText.indexOf("Completed"));
  assert(pdfText.indexOf("Completed") < pdfText.indexOf("Strengths"));
  assert(pdfText.indexOf(transcript[0].text) < pdfText.indexOf(transcript[1].text));
  assert.equal(JSON.stringify(model), before, "PDF generation must not mutate its model");

  const repeated = new Uint8Array(
    await generateLearnerReportPdfBlob(model).arrayBuffer(),
  );
  assert.deepEqual(repeated, bytes, "identical learner PDF input must produce identical bytes");

  for (const prohibited of [
    caseData.metadata.title,
    caseData.supportingInfo.diagnosis,
    "Overall score",
    "percentage",
    "pass/fail",
    "rubricVersion",
    "generationError",
    "semantic_batch_1_request_failed_timeout",
    "system prompt",
    "user-123",
    "attempt-123",
  ]) {
    assert(!pdfText.toLowerCase().includes(prohibited.toLowerCase()));
  }
}

const unavailableModel: LearnerReportPdfModel = {
  caseId: "case-01",
  caseLabel: "Case 1",
  patientName: "Jose Alvarez",
  complaint: `“I can’t sleep”—café pain.`,
  feedback: { status: "unavailable" },
  transcript: [],
};
const unavailableText = new TextDecoder().decode(
  await generateLearnerReportPdfBlob(unavailableModel).arrayBuffer(),
);
assert(unavailableText.includes("Personalized feedback was unavailable for this consultation."));
assert(unavailableText.includes("No transcript was recorded."));
assert(unavailableText.includes(`"I can't sleep"-cafe pain.`));
assert(!unavailableText.includes("Strengths"));
assert(!unavailableText.includes("Areas for Improvement"));
assert(!unavailableText.includes("Completed"));

const longTranscript = Array.from({ length: 100 }, (_, index) => ({
  role: index % 2 === 0 ? ("student" as const) : ("patient" as const),
  text: `Long transcript message ${index + 1}.`,
  timestamp: new Date(Date.parse(completedAt) + index * 1000).toISOString(),
}));
const longText = new TextDecoder().decode(
  await generateLearnerReportPdfBlob({
    ...unavailableModel,
    transcript: longTranscript,
  }).arrayBuffer(),
);
assert(Number(longText.match(/\/Count (\d+)/)?.[1] ?? 0) > 1);
assert(longText.includes("Long transcript message 1."));
assert(longText.includes("Long transcript message 100."));
assert(longText.indexOf("Long transcript message 1.") < longText.indexOf("Long transcript message 100."));

assert.equal(
  buildLearnerReportPdfFilename("case-01"),
  "odontiq-case-01-consultation-report.pdf",
);
assert.equal(
  buildLearnerReportPdfFilename(" CASE/01 "),
  "odontiq-case-01-consultation-report.pdf",
);
assert.equal(
  buildLearnerReportPdfFilename("***"),
  "odontiq-case-consultation-report.pdf",
);

const rendererSource = await readFile("src/lib/learnerReportPdf.ts", "utf8");
assert(!rendererSource.includes("facultyRubric/report/pdf"));
for (const prohibitedSource of [
  "fetch(",
  "localStorage",
  "sessionStorage",
  "navigator",
  "window.",
  "/api/",
  "evaluateFaculty",
  "scoreFaculty",
  "persist",
  "generationError",
  "userId",
  "clerk",
  "attemptId",
  "FacultyReport",
  "diagnosis",
  "overallScore",
  "passStatus",
  "rubric",
  "evaluate",
  "scoreFaculty",
]) {
  assert(!rendererSource.includes(prohibitedSource), `renderer contains: ${prohibitedSource}`);
}

console.log("Deterministic learner report PDF validation passed for all five cases.");

function assertWordsInOrder(pdfText: string, expected: string) {
  let cursor = 0;
  for (const word of normalizeFixtureText(expected).split(/\s+/)) {
    const index = pdfText.indexOf(word, cursor);
    assert(index >= cursor, `PDF omitted or reordered complaint word: ${word}`);
    cursor = index + word.length;
  }
}

function normalizeFixtureText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}
