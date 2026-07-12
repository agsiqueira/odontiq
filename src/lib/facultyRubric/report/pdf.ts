import { PdfDocument } from "../../reportPdf";
import type { CanonicalFacultyReportPresentation } from "./presentation";

export async function generateCanonicalFacultyPdfBlob(
  model: CanonicalFacultyReportPresentation,
) {
  const pdf = new PdfDocument();
  const report = model.report;
  pdf.addText("odontIQ Faculty Rubric Report", { size: 20, bold: true });
  pdf.addParagraph(model.caseTitle, { bold: true });
  pdf.addParagraph(`${model.patientName} | ${model.caseId}`);
  if (model.completedAt) pdf.addParagraph(`Completed: ${model.completedAt}`);
  pdf.addSectionHeading("Overall Result");
  pdf.addParagraph(report.overallResult.label, { bold: true });
  pdf.addParagraph(report.overallResult.message);
  pdf.addParagraph(
    `Score: ${report.overallScore.earnedPoints}/${report.overallScore.possiblePoints} (${report.overallScore.percentage ?? "Unavailable"}%)`,
    { bold: true },
  );
  for (const section of model.comparisonSections) {
    pdf.addSectionHeading(section.title);
    for (const row of section.rows) {
      pdf.addSubheading(row.itemName);
      pdf.addParagraph(
        `Expected: ${row.expected} | Student: ${row.student} | Result: ${row.result}`,
        { bold: true },
      );
      if (row.evidence.length > 0) {
        pdf.addList("Evidence", row.evidence);
      }
    }
  }
  pdf.addSectionHeading("Competency Summary");
  for (const competency of report.competencyScores) {
    if (competency.possiblePoints <= 0) continue;
    pdf.addSubheading(competency.title);
    pdf.addParagraph(
      `${competency.earnedPoints}/${competency.possiblePoints} (${competency.percentage ?? "Unavailable"}%) - ${competency.statusLabel}`,
    );
    pdf.addParagraph(competency.summaryMessage);
  }
  pdf.addSectionHeading("Strengths");
  pdf.addList("Met criteria", report.strengths.map((item) => item.title), "No strengths recorded.");
  pdf.addSectionHeading("Improvement Opportunities");
  pdf.addList(
    "Not met or uncertain",
    report.improvementAreas.map(
      (item) => `${item.title} - ${item.status === "uncertain" ? "Uncertain (no credit)" : "Not Met"}`,
    ),
    "No improvement opportunities recorded.",
  );
  if (report.criticalSafetyItems.length > 0) {
    pdf.addWarningList(
      "Critical warnings (warning only; score unchanged)",
      report.criticalSafetyItems.map(
        (item) => `${item.criterion.title} - ${item.status}`,
      ),
    );
  }
  if (report.uncertaintySummary.message) {
    pdf.addSectionHeading("Uncertainty Notice");
    pdf.addParagraph(report.uncertaintySummary.message);
  }
  pdf.startNewPageIfContentExists();
  pdf.addSectionHeading("Criterion Results");
  for (const criterion of model.criteria) {
    pdf.addSubheading(`${criterion.title} (${criterion.criterionId})`);
    pdf.addParagraph(
      `${criterion.status} | ${criterion.evaluationMethod} | confidence ${criterion.confidence}`,
      { bold: true },
    );
    pdf.addParagraph(criterion.rationale ?? "No rationale stored.");
    pdf.addList(
      "Evidence",
      criterion.evidence.map(
        (item) => item.excerpt ?? item.eventId ?? item.source,
      ),
      "No supporting evidence was found in the completed encounter.",
    );
  }
  return pdf.toBlob();
}

export function buildCanonicalFacultyPdfFilename(
  model: CanonicalFacultyReportPresentation,
) {
  return `odontiq-${slug(model.caseId)}-${slug(model.patientName)}-faculty-report.pdf`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
