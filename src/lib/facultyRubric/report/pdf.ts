import { PdfDocument } from "../../reportPdf";
import type { CanonicalFacultyReportPresentation } from "./presentation";
import {
  FACULTY_REPORT_DISPLAY_TITLES,
  formatFacultyReportPercent,
  getCriticalSafetyDisplayMessage,
  getCriticalSafetyDisplayTitle,
} from "./displayContent";

export async function generateCanonicalFacultyPdfBlob(
  model: CanonicalFacultyReportPresentation,
) {
  const pdf = new PdfDocument();
  const report = model.report;
  pdf.addText(FACULTY_REPORT_DISPLAY_TITLES.report, {
    size: 11,
    bold: true,
    color: [0.16, 0.33, 0.36],
    lineHeight: 15,
  });
  pdf.addText(model.caseTitle, { size: 20, bold: true, lineHeight: 25 });
  pdf.addParagraph(model.patientName, { color: [0.38, 0.43, 0.46] });
  pdf.addGap(8);
  pdf.addParagraph(report.overallResult.message);
  pdf.addMetrics([
    {
      label: "Overall",
      value: formatFacultyReportPercent(report.overallScore.percentage),
    },
    { label: "Required", value: "84%", description: "minimum score" },
    {
      label: "Points",
      value: `${report.overallScore.earnedPoints}/${report.overallScore.possiblePoints}`,
      description: "earned",
    },
  ]);
  pdf.addParagraph(report.overallResult.label, { bold: true });
  pdf.addParagraph("Required score: 84%", { size: 9, color: [0.38, 0.43, 0.46] });

  for (const section of model.comparisonSections) {
    pdf.addSectionHeading(section.title);
    for (const row of section.rows) {
      pdf.ensureBlockSpace(62);
      pdf.addSubheading(row.itemName);
      pdf.addParagraph(
        `Expected: ${row.expected} | Student: ${row.student} | Result: ${row.result}`,
        { bold: true },
      );
      pdf.addParagraph(`Evidence: ${row.evidence.join("; ") || "-"}`, {
        color: [0.38, 0.43, 0.46],
      });
      pdf.addGap(4);
    }
  }

  if (report.criticalSafetySummary.message) {
    pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.criticalSafety);
    pdf.addSubheading(getCriticalSafetyDisplayTitle(report));
    pdf.addParagraph(getCriticalSafetyDisplayMessage(report));
    for (const item of report.criticalSafetyItems) {
      pdf.ensureBlockSpace(34);
      pdf.addParagraph(item.criterion.title, { bold: true });
      pdf.addParagraph(
        item.status === "uncertain"
          ? "Critical uncertainty"
          : "Critical miss",
        { color: [0.52, 0.33, 0.03] },
      );
    }
  }

  if (report.uncertaintySummary.message) {
    pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.uncertainty);
    pdf.addSubheading(
      `${report.uncertaintySummary.uncertainItemCount} ${pluralize(
        "uncertain item",
        report.uncertaintySummary.uncertainItemCount,
      )}`,
    );
    pdf.addParagraph(report.uncertaintySummary.message);
  }

  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.competencySummary);
  for (const competency of report.competencyScores) {
    if (competency.possiblePoints <= 0) continue;
    pdf.ensureBlockSpace(64);
    pdf.addSubheading(competency.title);
    pdf.addParagraph(
      `${formatFacultyReportPercent(competency.percentage)} | ${formatCompetencyStatus(
        competency.statusLabel,
      )} | ${competency.earnedPoints}/${competency.possiblePoints} points`,
      { bold: true },
    );
    pdf.addParagraph(competency.summaryMessage);
    pdf.addGap(5);
  }

  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.strengths);
  addGroupedStrengths(pdf, report);

  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.improvements);
  addGroupedImprovements(pdf, report);

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

function addGroupedStrengths(
  pdf: PdfDocument,
  report: CanonicalFacultyReportPresentation["report"],
) {
  const criterionById = new Map(
    report.criterionResults.map((criterion) => [criterion.criterionId, criterion]),
  );
  const groups = groupByCompetency(
    [...report.strengths].sort(
      (left, right) =>
        Number(criterionById.get(right.criterionId)?.critical) -
          Number(criterionById.get(left.criterionId)?.critical) ||
        left.displayPriority - right.displayPriority,
    ),
  );
  if (groups.length === 0) {
    pdf.addParagraph("No deterministic strengths were identified.", {
      color: [0.38, 0.43, 0.46],
    });
    return;
  }
  for (const [competency, items] of groups) {
    pdf.addSubheading(competencyTitle(competency));
    for (const item of items) {
      pdf.addParagraph(item.title, { indent: 12 });
      if (criterionById.get(item.criterionId)?.critical) {
        pdf.addParagraph("Critical strength", {
          color: [0.16, 0.33, 0.36],
          indent: 12,
        });
      }
    }
  }
}

function addGroupedImprovements(
  pdf: PdfDocument,
  report: CanonicalFacultyReportPresentation["report"],
) {
  const criterionById = new Map(
    report.criterionResults.map((criterion) => [criterion.criterionId, criterion]),
  );
  const groups = groupByCompetency(
    [...report.improvementAreas].sort(
      (left, right) =>
        Number(criterionById.get(right.criterionId)?.critical) -
          Number(criterionById.get(left.criterionId)?.critical) ||
        Number(right.status === "uncertain") -
          Number(left.status === "uncertain") ||
        left.displayPriority - right.displayPriority,
    ),
  );
  if (groups.length === 0) {
    pdf.addParagraph("No deterministic improvement areas were identified.", {
      color: [0.38, 0.43, 0.46],
    });
    return;
  }
  for (const [competency, items] of groups) {
    pdf.addSubheading(competencyTitle(competency));
    for (const item of items) {
      pdf.ensureBlockSpace(42);
      pdf.addParagraph(item.title, { bold: true, indent: 12 });
      pdf.addParagraph(
        item.status === "uncertain"
          ? "Uncertain - No credit awarded"
          : "Not Met",
        { color: [0.52, 0.33, 0.03], indent: 12 },
      );
      if (criterionById.get(item.criterionId)?.critical) {
        pdf.addParagraph("Critical", {
          color: [0.52, 0.33, 0.03],
          indent: 12,
        });
      }
      if (item.status === "uncertain") {
        pdf.addParagraph(
          "This item could not be verified clearly from the encounter and received no credit.",
          { color: [0.38, 0.43, 0.46], indent: 12 },
        );
      }
    }
  }
}

function groupByCompetency<T extends { competency: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(item.competency, [...(groups.get(item.competency) ?? []), item]);
  }
  return [...groups.entries()].sort(
    ([left], [right]) =>
      competencyOrderIndex(left) - competencyOrderIndex(right),
  );
}

const COMPETENCY_ORDER = [
  "information-gathering",
  "clinical-findings",
  "clinical-interpretation",
  "management-planning",
  "patient-communication",
  "procedural-decision",
  "examination",
];

function competencyOrderIndex(value: string) {
  const index = COMPETENCY_ORDER.indexOf(value);
  return index === -1 ? COMPETENCY_ORDER.length : index;
}

function competencyTitle(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCompetencyStatus(value: string) {
  if (value === "needs-attention") return "Needs Attention";
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
