import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  generateLearnerReportPdfBlob,
  type LearnerReportPdfModel,
} from "../src/lib/learnerReportPdf";

const [learnerSource, canonicalSource, facultySource, facultyPdfSource, mentorSource] =
  await Promise.all([
    readFile("src/components/LearnerCaseReport.tsx", "utf8"),
    readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
    readFile("src/components/FacultyCaseReport.tsx", "utf8"),
    readFile("src/lib/facultyRubric/report/pdf.ts", "utf8"),
    readFile("src/components/MentorGeneratedDebrief.tsx", "utf8"),
  ]);

assert.equal(count(learnerSource, "onClick={() => void downloadPdfReport()}"), 1);
assert.equal(count(learnerSource, 'aria-label="Download PDF Report"'), 1);
assert.equal(count(learnerSource, "const downloadPdfReport = useCallback"), 1);
assert(learnerSource.includes('isPreparingPdf ? "Preparing PDF…" : "Download PDF Report"'));
assert(!learnerSource.includes("Download Transcript"));
assert(!learnerSource.includes("downloadTranscript"));
assert(!learnerSource.includes("buildLearnerTranscript"));
assert(!learnerSource.includes("text/plain"));
assert(!learnerSource.includes(".txt"));
assert(!learnerSource.includes("new Blob("));

assert(learnerSource.includes("<EncounterTranscript messages={transcript} />"));
assert.match(learnerSource, /messages\.map\(\(message\) =>/);
assert(learnerSource.includes("message.role === \"student\" ? \"Provider\" : \"Patient\""));
assert(learnerSource.includes("{message.text}"));

const transcript = [
  { role: "student" as const, text: "Exact first provider message.", timestamp: "2026-08-23T10:00:00.000Z" },
  { role: "patient" as const, text: "Exact final patient message.", timestamp: "2026-08-23T10:00:01.000Z" },
];
const base: Omit<LearnerReportPdfModel, "feedback"> = {
  caseId: "case-01",
  caseLabel: "Case 1",
  patientName: "Test Patient",
  complaint: "Test complaint",
  completedAt: "2026-08-23T10:01:00.000Z",
  transcript,
};

const availableText = decode(await generateLearnerReportPdfBlob({
  ...base,
  feedback: {
    status: "available",
    strengths: ["Exact strength"],
    improvementAreas: ["Exact improvement"],
  },
}).arrayBuffer());
for (const expected of ["Exact strength", "Exact improvement", ...transcript.map((item) => item.text)]) {
  assert(availableText.includes(expected));
}

for (const state of ["pending", "in-progress", "failed", "unavailable"] as const) {
  const text = decode(await generateLearnerReportPdfBlob({
    ...base,
    feedback: { status: "unavailable" },
  }).arrayBuffer());
  assert(text.includes("Personalized feedback was unavailable for this consultation."), state);
  assert(text.indexOf(transcript[0].text) < text.indexOf(transcript[1].text), state);
}

assert.match(
  canonicalSource,
  /status === "ready"\s*&&\s*serverTranscript\s*&&\s*patientCase[\s\S]*<LearnerCaseReport/,
);
assert(canonicalSource.includes("payload.caseId !== caseId"));
assert(canonicalSource.includes("recovered.caseId === caseId"));
assert(canonicalSource.includes("transcript={presentation?.transcript ?? serverTranscript}"));

const downloadStart = learnerSource.indexOf("const downloadPdfReport = useCallback");
const downloadEnd = learnerSource.indexOf("return (", downloadStart);
const downloadSource = learnerSource.slice(downloadStart, downloadEnd);
for (const prohibited of [
  "fetch(", '"POST"', "/api/", "evaluate", "scoreFaculty", "persist", "debrief",
  "encounter", "router.", "attemptId", "userId", "clerk",
]) {
  assert(!downloadSource.includes(prohibited), `PDF download contains prohibited action: ${prohibited}`);
}
assert(downloadSource.includes("downloadInProgressRef.current || isPreparingPdf"));
assert(downloadSource.includes("setPdfError(true)"));
assert(learnerSource.includes("The PDF report could not be downloaded. Please try again."));

assert(facultySource.includes("<EncounterTranscript messages={transcript} />"));
assert(facultySource.includes("Download PDF"));
assert(facultyPdfSource.includes("generateCanonicalFacultyPdfBlob"));
assert(mentorSource.includes("Retry mentor debrief"));
assert(mentorSource.includes("View saved report"));
assert(mentorSource.includes("savedReportHref"));

const references = await findReferences(["src", "scripts"], [
  "learnerTranscriptDownload",
  "buildLearnerTranscriptFilename",
  "buildLearnerTranscriptText",
]);
assert.deepEqual(references, [], `obsolete learner TXT references remain: ${references.join(", ")}`);

console.log("Learner PDF-only download validation passed.");

function count(source: string, value: string) {
  return source.split(value).length - 1;
}

function decode(buffer: ArrayBuffer) {
  return new TextDecoder().decode(buffer);
}

async function findReferences(roots: string[], needles: string[]) {
  const matches: string[] = [];
  for (const root of roots) await visit(root);
  return matches;

  async function visit(target: string): Promise<void> {
    const targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      for (const entry of await readdir(target)) await visit(path.join(target, entry));
      return;
    }
    if (!/\.(?:ts|tsx|js|mjs)$/.test(target) || target.endsWith("validateLearnerPdfOnly.ts")) return;
    const source = await readFile(target, "utf8");
    if (needles.some((needle) => source.includes(needle))) matches.push(target);
  }
}
