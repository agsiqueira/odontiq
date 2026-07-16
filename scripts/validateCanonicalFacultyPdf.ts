import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { getResolvedFacultyRubricCalibration } from "../src/lib/facultyRubric/calibration";
import { FACULTY_RUBRIC_VERSION } from "../src/lib/facultyRubric/evaluation/state";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import {
  buildCanonicalFacultyPdfFilename,
  generateCanonicalFacultyPdfBlob,
} from "../src/lib/facultyRubric/report/pdf";
import { formatEncounterTranscriptTimestamp } from "../src/lib/facultyRubric/report/displayContent";
import { buildCanonicalFacultyReportPresentation } from "../src/lib/facultyRubric/report/presentation";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";
import type { LocalEncounterSummary } from "../src/lib/localEncounter";

const generatedAt = "2026-07-12T12:00:00.000Z";

for (const rubric of facultyRubrics) {
  const patientName = `Validation patient ${rubric.caseId}`;
  const caseTitle = `Validation case ${rubric.caseId}`;

  const supportedCriteria = getResolvedFacultyRubricCalibration(rubric.caseId)
    .filter((criterion) => criterion.scored && criterion.supported);
  const evaluations: FacultyCriterionEvaluation[] = supportedCriteria.map(
    (criterion, index) => ({
      caseId: rubric.caseId,
      criterionId: criterion.criterionId,
      status: "met",
      confidence: 1,
      evidence: [],
      rationale: "Validated canonical finding.",
      evaluationMethod:
        index === 0 ? "deterministic-default" : "deterministic",
      evaluatedAt: generatedAt,
    }),
  );
  const score = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations,
  });
  const report = buildFacultyReport({
    rubric,
    completedEvaluations: evaluations,
    score,
    generatedAt,
  });
  const summary: LocalEncounterSummary = {
    caseId: rubric.caseId,
    conversationHistory: [
      {
        id: "provider-opening",
        role: "student",
        text: "Hello, what brings you in today?",
        timestamp: "2026-07-12T11:58:00.000Z",
      },
      {
        id: "patient-opening",
        role: "patient",
        text: "My tooth has been hurting for three days.",
        timestamp: "2026-07-12T11:58:01.000Z",
      },
    ],
    coveredFacts: [],
    coveredChecklistItems: [],
    encounterEvents: [],
    examinationsViewed: [],
    savedAt: generatedAt,
    lifecycleStatus: "completed",
    facultyRubricEvaluation: {
      caseId: rubric.caseId,
      rubricVersion: FACULTY_RUBRIC_VERSION,
      transcriptRevision: "canonical-pdf-validation",
      status: "complete",
      evaluations,
      evaluatedAt: generatedAt,
    },
    facultyRubricScore: score,
    facultyReport: report,
    metadata: { completedAt: generatedAt },
  };
  const presentation = buildCanonicalFacultyReportPresentation(
    summary,
    patientName,
    caseTitle,
    {
      studentName: "Bruna Smith",
      attemptId: `attempt-${rubric.caseId}`,
    },
  );

  assert(presentation, `Canonical presentation unavailable for ${rubric.caseId}.`);
  assert.equal(presentation.report, report, "Presentation must retain the persisted report object.");
  assert.deepEqual(
    presentation.transcript,
    summary.conversationHistory,
    "Presentation must retain every stored transcript message in order.",
  );
  assert.equal(presentation.report.overallScore.percentage, score.percentage);
  assert.equal(presentation.report.overallScore.earnedPoints, score.earnedPoints);
  assert.equal(presentation.report.overallScore.possiblePoints, score.possiblePoints);
  assert.deepEqual(
    presentation.criteria.map((criterion) => criterion.criterionId).sort(),
    report.criterionResults.map((criterion) => criterion.criterionId).sort(),
  );
  assert(
    presentation.criteria.some(
      (criterion) => criterion.evaluationMethod === "deterministic-default",
    ),
    "Deterministic-default findings must remain in canonical PDF data.",
  );
  assert(
    presentation.criteria.every(
      (criterion) => !score.unsupportedCriterionIds.includes(criterion.criterionId),
    ),
    "Unsupported criteria must be excluded from canonical PDF data.",
  );
  assert(
    presentation.comparisonSections
      .flatMap((section) => section.rows)
      .every((row) =>
        presentation.criteria.some(
          (criterion) => criterion.criterionId === row.criterionId,
        ),
      ),
    "PDF comparison rows must be limited to canonical report criteria.",
  );

  const blob = await generateCanonicalFacultyPdfBlob(presentation);
  assert(blob.size > 0, `Canonical PDF was empty for ${rubric.caseId}.`);
  const pdfText = new TextDecoder().decode(await blob.arrayBuffer());
  for (const expectedText of [
    "Faculty Rubric Report",
    "Bruna Smith",
    presentation.caseLabel,
    caseTitle,
    patientName,
    "COMPLETED",
    "SUBMISSION",
    report.overallResult.message,
    "Competency Summary",
    "Strengths",
    "Areas for Improvement",
    "Encounter Transcript",
    `Provider - ${formatEncounterTranscriptTimestamp("2026-07-12T11:58:00.000Z")}`,
    "Hello, what brings you in today?",
    `Patient - ${formatEncounterTranscriptTimestamp("2026-07-12T11:58:01.000Z")}`,
    "My tooth has been hurting for three days.",
  ]) {
    assert(
      pdfText.includes(expectedText),
      `Canonical PDF for ${rubric.caseId} omitted: ${expectedText}`,
    );
  }
  for (const section of presentation.comparisonSections) {
    assert(
      pdfText.includes(section.title),
      `Canonical PDF for ${rubric.caseId} omitted comparison section ${section.title}.`,
    );
  }
  assert(
    pdfText.indexOf("Competency Summary") < pdfText.indexOf("Strengths") &&
      pdfText.indexOf("Strengths") < pdfText.indexOf("Areas for Improvement"),
    "Canonical PDF section order must match the browser report.",
  );
  assert(
    pdfText.indexOf("Areas for Improvement") <
      pdfText.indexOf("Encounter Transcript") &&
      pdfText.indexOf("Provider -") < pdfText.indexOf("Patient -"),
    "Encounter transcript must follow improvements and preserve message order.",
  );
  if (rubric.caseId === "case-01") {
    const longTranscript = Array.from({ length: 80 }, (_, index) => ({
      id: `long-transcript-${index + 1}`,
      role: index % 2 === 0 ? ("student" as const) : ("patient" as const),
      text: `Transcript message ${index + 1}.`,
      timestamp: new Date(Date.parse(generatedAt) + index * 1000).toISOString(),
    }));
    const longBlob = await generateCanonicalFacultyPdfBlob({
      ...presentation,
      transcript: longTranscript,
    });
    const longPdfText = new TextDecoder().decode(await longBlob.arrayBuffer());
    assert(longPdfText.includes("Transcript message 1."));
    assert(longPdfText.includes("Transcript message 80."));
    const regularPageCount = Number(pdfText.match(/\/Count (\d+)/)?.[1] ?? 0);
    const longPageCount = Number(longPdfText.match(/\/Count (\d+)/)?.[1] ?? 0);
    assert(
      longPageCount > regularPageCount,
      "Long transcripts must paginate without truncation.",
    );
  }
  assert(
    !pdfText.includes("Criterion Results"),
    "Production PDF must not add a PDF-only criterion appendix.",
  );
  const filename = buildCanonicalFacultyPdfFilename(presentation);
  assert.match(
    filename,
    /^odontiq-bruna-smith-case-\d{2}-validation-patient-case-\d+-\d{8}-\d{6}\.pdf$/,
  );

  const criticalCriterion = supportedCriteria.find(
    (criterion) => criterion.critical,
  );
  if (criticalCriterion) {
    const criticalEvaluations = evaluations.map((evaluation) =>
      evaluation.criterionId === criticalCriterion.criterionId
        ? { ...evaluation, status: "not-met" as const }
        : evaluation,
    );
    const criticalScore = scoreFacultyRubricEvaluations({
      caseId: rubric.caseId,
      evaluations: criticalEvaluations,
    });
    const criticalReport = buildFacultyReport({
      rubric,
      completedEvaluations: criticalEvaluations,
      score: criticalScore,
      generatedAt,
    });
    assert.equal(
      criticalScore.possiblePoints,
      criticalScore.totalExpectedCriteria,
      "Critical warnings must not reduce available points or cap the score.",
    );
    assert(
      criticalReport.criticalSafetyItems.some(
        (item) => item.criterion.criterionId === criticalCriterion.criterionId,
      ),
      "Critical misses must remain visible as warning-only items.",
    );
  }

  assert.equal(
    buildCanonicalFacultyReportPresentation(
      { ...summary, facultyRubricEvaluation: undefined },
      patientName,
      caseTitle,
    ),
    null,
    "Missing evaluation must not produce PDF data.",
  );
  assert.equal(
    buildCanonicalFacultyReportPresentation(
      {
        ...summary,
        facultyRubricScore: { ...score, passStatus: "technical-invalid" },
      },
      patientName,
      caseTitle,
    ),
    null,
    "Technical-invalid score must not produce PDF data.",
  );
}

const productionPdfSources = await Promise.all(
  [
    "src/components/CanonicalCaseReport.tsx",
    "src/components/FacultyCaseReport.tsx",
    "src/lib/facultyRubric/report/pdf.ts",
    "src/lib/facultyRubric/report/presentation.ts",
  ].map((file) => readFile(file, "utf8")),
);
const activePdfSource = productionPdfSources.join("\n");
const facultyScreenSource = productionPdfSources[1];
assert(
  !/fetch\(["']\/api\/report["']/.test(activePdfSource),
  "Canonical PDF path must not call the legacy report API.",
);
assert(!/legacy pdf/i.test(activePdfSource), "Production report flow must not identify the PDF as legacy.");
assert(!activePdfSource.includes("generateReportPdfBlob"), "Canonical PDF path must not call the legacy PDF generator.");
assert(
  facultyScreenSource.indexOf("FACULTY_REPORT_DISPLAY_TITLES.improvements") <
    facultyScreenSource.indexOf("<EncounterTranscript messages={transcript}"),
  "Browser transcript must render immediately after Areas for Improvement.",
);
assert(
  facultyScreenSource.includes(
    "<CollapsibleReportCard\n        title={FACULTY_REPORT_DISPLAY_TITLES.encounterTranscript}",
  ),
  "Browser transcript must reuse the canonical collapsible report card.",
);
assert(
  facultyScreenSource.includes(
    "formatEncounterTranscriptTimestamp(message.timestamp)",
  ),
  "Browser transcript must render each stored message timestamp.",
);
assert(
  facultyScreenSource.includes("aria-expanded={isOpen}") &&
    facultyScreenSource.includes("aria-controls={contentId}"),
  "Collapsible report cards must expose expansion state and controlled content.",
);

console.log("Canonical faculty PDF validation passed for all five cases.");
