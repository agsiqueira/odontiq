import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { CASE_DATA } from "../src/data/cases";
import { buildLearnerTranscriptFilename } from "../src/lib/learnerTranscriptDownload";

const reportsDashboardSource = await readFile("src/app/reports/page.tsx", "utf8");
const canonicalReportSource = await readFile(
  "src/components/CanonicalCaseReport.tsx",
  "utf8",
);
const learnerReportSource = await readFile(
  "src/components/LearnerCaseReport.tsx",
  "utf8",
);
const patientCardSource = await readFile(
  "src/lib/patientCardPresentation.ts",
  "utf8",
);
const caseSource = await readFile("src/lib/cases.ts", "utf8");
const transcriptSource = await readFile(
  "src/lib/learnerTranscriptDownload.ts",
  "utf8",
);

assert.equal(CASE_DATA.length, 5);
assert.equal(
  CASE_DATA[0]?.metadata.chiefComplaint,
  "I have a bad toothache, my jaw is swollen, and I am having trouble swallowing and breathing when I lie down.",
);

for (const caseData of CASE_DATA) {
  const filename = buildLearnerTranscriptFilename(caseData.metadata.id);
  assert(filename.includes(caseData.metadata.id));
  assert(!filename.includes(caseData.metadata.title));

  assert(
    !reportsDashboardSource.includes(`>${caseData.metadata.title}<`),
    `${caseData.metadata.id} diagnosis must not be hard-coded into the reports dashboard`,
  );
  assert(
    !learnerReportSource.includes(caseData.metadata.title),
    `${caseData.metadata.id} diagnosis must not be hard-coded into learner reports`,
  );
}

assert.match(caseSource, /openingStatement: caseData\.metadata\.chiefComplaint/);
assert.match(patientCardSource, /openingStatement: patientCase\.openingStatement/);
assert.match(patientCardSource, /caseLabel: getCaseDisplayLabel\(patientCase\.id\)/);
assert.match(patientCardSource, /href: `\/encounter\/\$\{patientCase\.id\}`/);
assert.match(reportsDashboardSource, /\{card\.patientCase\.openingStatement\}/);
assert.doesNotMatch(reportsDashboardSource, /\{card\.patientCase\.title\}/);
assert.match(canonicalReportSource, /patientCase\.openingStatement/);
assert.match(canonicalReportSource, /caseTitle=\{patientCase\.openingStatement\}/);

// The same learner report renders successful feedback, transcript fallback,
// failed feedback, automatic retry, and manual retry states.
for (const state of [
  'feedbackState?: "available" | "failed" | "automatic-retrying" | "retrying"',
  "<FeedbackUnavailableSection",
  "transcript={presentation?.transcript ?? serverTranscript}",
]) {
  assert(
    learnerReportSource.includes(state) || canonicalReportSource.includes(state),
    `learner report state coverage is missing: ${state}`,
  );
}

assert.match(learnerReportSource, /\{caseLabel \? `\$\{caseLabel\} · ` : ""\}\{caseTitle\}/);
assert.doesNotMatch(learnerReportSource, /diagnosis|patientCase\.title/i);
assert.doesNotMatch(canonicalReportSource, /caseTitle=\{patientCase\.title\}/);
assert.doesNotMatch(reportsDashboardSource, /aria-(?:label|description)=.*patientCase\.title/);
assert.doesNotMatch(learnerReportSource, /aria-(?:label|description)=.*caseTitle/);
assert.doesNotMatch(transcriptSource, /diagnosis|metadata\.title|patientCase\.title/i);
assert.match(transcriptSource, /odontiq-\$\{safeCaseId\}-transcript\.txt/);

// Diagnostic metadata remains present for internal clinical and faculty use.
for (const caseData of CASE_DATA) {
  assert(caseData.metadata.title.trim());
  assert(caseData.supportingInfo.diagnosis.trim());
}

console.log("Learner report complaint validation passed for all five cases.");
