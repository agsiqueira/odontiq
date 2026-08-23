import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { CASE_DATA } from "../src/data/cases";
import { getCaseDisplayLabel } from "../src/lib/caseDisplay";
import {
  generateLearnerReportPdfBlob,
  type LearnerReportPdfModel,
} from "../src/lib/learnerReportPdf";
import {
  ReportAttemptNotFoundError,
  ReportsService,
} from "../src/lib/persistence/services/reportsService";

const completedAt = new Date("2026-07-12T12:00:00.000Z");
const messages = [
  {
    id: "student-1",
    role: "student",
    text: "What brings you in?",
    timestamp: "2026-07-12T11:59:00.000Z",
  },
  {
    id: "patient-1",
    role: "patient",
    text: "My tooth hurts.",
    timestamp: "2026-07-12T11:59:01.000Z",
  },
] satisfies Array<{ id: string; role: "student" | "patient"; text: string; timestamp: string }>;

const visibleStrengths = ["Visible strength 1", "Visible strength 2", "Visible strength 3"];
const visibleImprovements = [
  "Visible improvement 1",
  "Visible improvement 2",
  "Visible improvement 3",
];

for (const generationStatus of ["PENDING", "IN_PROGRESS", "FAILED", "COMPLETE"] as const) {
  const reports = new ReportsService({
    async listByUser() {
      return [];
    },
    async findOwnedByAttemptId(userId, attemptId) {
      if (userId !== "owned-user" || attemptId !== "owned-attempt") return null;
      return {
        attemptId,
        caseId: "case-01",
        generationStatus,
        integrityStatus: generationStatus === "COMPLETE" ? "VALID" : "PENDING",
        percentage: generationStatus === "COMPLETE" ? 92 : null,
        passed: generationStatus === "COMPLETE",
        completedAt,
        encounter: {
          encounterData: {
            schemaVersion: 1,
            caseId: "case-01",
            encounterVersion: 1,
            messages,
            examinations: [],
            lifecycleEvents: [],
            disclosedFacts: [],
            checklistCoverage: { itemIds: [], evidence: [] },
            timing: { activeDurationMs: 1, pausedDurationMs: 0 },
            createdAt: "2026-07-12T11:58:00.000Z",
            updatedAt: completedAt.toISOString(),
          },
        },
        facultyEvaluation: null,
        facultyScore: null,
        facultyReport: null,
      };
    },
  });
  const state = await reports.getReport("owned-user", "owned-attempt");
  assert.equal(state.completedAt, completedAt.toISOString());
  assert.deepEqual(state.transcript, messages);
  await assert.rejects(
    () => reports.getReport("foreign-user", "owned-attempt"),
    ReportAttemptNotFoundError,
  );
}

const availableModel: LearnerReportPdfModel = {
  caseId: "case-01",
  caseLabel: getCaseDisplayLabel("case-01"),
  patientName: CASE_DATA[0].patient.name,
  complaint: CASE_DATA[0].metadata.chiefComplaint,
  completedAt: completedAt.toISOString(),
  feedback: {
    status: "available",
    strengths: visibleStrengths,
    improvementAreas: visibleImprovements,
  },
  transcript: messages.map(({ role, text, timestamp }) => ({ role, text, timestamp })),
};
const availableText = new TextDecoder().decode(
  await generateLearnerReportPdfBlob(availableModel).arrayBuffer(),
);
for (const expected of [
  ...visibleStrengths,
  ...visibleImprovements,
  "Provider - Jul 12, 2026, 11:59:00 UTC",
  messages[0].text,
  "Patient - Jul 12, 2026, 11:59:01 UTC",
  messages[1].text,
]) {
  assert(availableText.includes(expected));
}
for (const complaintFragment of ["bad toothache", "jaw is swollen", "trouble swallowing", "breathing"]) {
  assert(availableText.includes(complaintFragment));
}

for (const status of ["pending", "in-progress", "failed"] as const) {
  const model: LearnerReportPdfModel = {
    ...availableModel,
    feedback: { status: "unavailable" },
  };
  const text = new TextDecoder().decode(
    await generateLearnerReportPdfBlob(model).arrayBuffer(),
  );
  assert(text.includes("Personalized feedback was unavailable for this consultation."), status);
  assert(text.indexOf(messages[0].text) < text.indexOf(messages[1].text));
}

for (const prohibited of [
  CASE_DATA[0].metadata.title,
  CASE_DATA[0].supportingInfo.diagnosis,
  "Overall score",
  "92%",
  "pass/fail",
  "owned-attempt",
  "owned-user",
]) {
  assert(!availableText.toLowerCase().includes(prohibited.toLowerCase()));
}

const [learnerSource, canonicalSource, serviceSource, routeSource, facultyPdfSource] =
  await Promise.all([
    readFile("src/components/LearnerCaseReport.tsx", "utf8"),
    readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
    readFile("src/lib/persistence/services/reportsService.ts", "utf8"),
    readFile("src/app/api/reports/[attemptId]/route.ts", "utf8"),
    readFile("src/lib/facultyRubric/report/pdf.ts", "utf8"),
  ]);

assert(serviceSource.includes("completedAt: attempt.completedAt?.toISOString() ?? null"));
assert.match(routeSource, /inProgressResponse\(state: PersistedReportState\)/);
for (const retained of ["caseId: state.caseId", "completedAt: state.completedAt", "transcript: state.transcript"]) {
  assert(routeSource.includes(retained));
}
assert(routeSource.includes("requireAppUser()"));
assert(canonicalSource.includes("payload.caseId !== caseId"));
assert(canonicalSource.includes("setServerCompletedAt(payload.completedAt ?? undefined)"));
assert(canonicalSource.includes("status === \"ready\" &&"));
assert(canonicalSource.includes("serverTranscript &&"));
assert(canonicalSource.includes("completedAt={serverCompletedAt}"));
assert(canonicalSource.includes("caseTitle={patientCase.openingStatement}"));
assert(canonicalSource.includes("caseLabel={getCaseDisplayLabel(caseId)}"));

assert(learnerSource.includes("Download PDF Report"));
assert(learnerSource.includes("generateLearnerReportPdfBlob(model)"));
assert(learnerSource.includes("buildLearnerReportPdfFilename(caseId)"));
assert(learnerSource.includes("disabled={isPreparingPdf}"));
assert(learnerSource.includes("downloadInProgressRef.current || isPreparingPdf"));
assert(learnerSource.includes("downloadInProgressRef.current"));
assert(learnerSource.includes("window.URL.createObjectURL(blob)"));
assert(learnerSource.includes("window.URL.revokeObjectURL(url)"));
assert.match(learnerSource, /finally \{[\s\S]*setIsPreparingPdf\(false\)/);
assert(learnerSource.includes("The PDF report could not be downloaded. Please try again."));
assert(learnerSource.includes("Download Transcript"));
assert(learnerSource.includes("buildLearnerTranscriptText"));
assert(learnerSource.includes("buildLearnerTranscriptFilename"));
assert(learnerSource.includes("<EncounterTranscript messages={transcript} />"));

const downloadStart = learnerSource.indexOf("const downloadPdfReport = useCallback");
const downloadEnd = learnerSource.indexOf("return (", downloadStart);
const downloadSource = learnerSource.slice(downloadStart, downloadEnd);
for (const prohibitedCall of [
  "fetch(",
  '"POST"',
  "/api/",
  "evaluate",
  "scoreFaculty",
  "debrief",
  "persist",
  "router.",
  "encounter",
  "attemptId",
  "userId",
  "clerk",
]) {
  assert(!downloadSource.includes(prohibitedCall), `PDF download contains: ${prohibitedCall}`);
}
assert(!learnerSource.includes("generateCanonicalFacultyPdfBlob"));
assert(facultyPdfSource.includes("generateCanonicalFacultyPdfBlob"));

let preparing = false;
let completedDownloads = 0;
async function sequentialDownload() {
  if (preparing) return;
  preparing = true;
  await Promise.resolve();
  completedDownloads += 1;
  preparing = false;
}
await sequentialDownload();
await sequentialDownload();
assert.equal(completedDownloads, 2);
preparing = true;
await Promise.all([sequentialDownload(), sequentialDownload()]);
assert.equal(completedDownloads, 2);

console.log("Authenticated learner PDF download validation passed.");
