import { PdfDocument } from "../../reportPdf";
import type { CanonicalFacultyReportPresentation } from "./presentation";
import {
  FACULTY_REPORT_DISPLAY_TITLES,
  formatFacultyReportDate,
  formatFacultyReportFilenameTimestamp,
  formatFacultyReportPercent,
  getCriticalSafetyDisplayMessage,
  getCriticalSafetyDisplayTitle,
  sanitizeFacultyReportFilenamePart,
} from "./displayContent";

export async function generateCanonicalFacultyPdfBlob(
  model: CanonicalFacultyReportPresentation,
) {
  const pdf = new PdfDocument();

  const report = model.report;
  pdf.addText(FACULTY_REPORT_DISPLAY_TITLES.report, {
    size: 20,
    bold: true,
    color: [0.16, 0.33, 0.36],
    lineHeight: 25,
  });
  pdf.addMetadataPanel([
    { label: "Student", value: model.studentName ?? "Unavailable" },
    { label: "Case", value: `${model.caseLabel} — ${model.caseTitle}` },
    { label: "Patient", value: model.patientName },
    { label: "Completed", value: formatFacultyReportDate(model.completedAt) },
    ...(model.attemptId
      ? [{ label: "Submission", value: model.attemptId }]
      : []),
  ]);
  pdf.addParagraph(report.overallResult.message);
  pdf.addGap(8);

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
  pdf.addStatusPanel(report.overallResult.label, "Required score: 84%");

  for (const section of model.comparisonSections) {
    pdf.addSectionHeading(section.title);
    for (const row of section.rows) {
      pdf.addComparisonCard({
        title: row.itemName,
        expected: row.expected,
        student: row.student,
        result: row.result,
        evidence: row.evidence.join("; ") || "-",
      });
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
    pdf.addCompetencyCard({
      title: competency.title,
      percentage: formatFacultyReportPercent(competency.percentage),
      detail: `${formatCompetencyStatus(
        competency.statusLabel,
      )} | ${competency.earnedPoints}/${competency.possiblePoints} points`,
      narrative: competency.summaryMessage,
    });
  }

  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.strengths);
  addGroupedStrengths(pdf, report);

  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.improvements);
  addGroupedImprovements(pdf, report);

  addEncounterTranscript(pdf, model.transcript);

  return pdf.toBlob();
}

export function buildCanonicalFacultyPdfFilename(
  model: CanonicalFacultyReportPresentation,
) {
  const caseNumber = model.caseId.match(/\d+/)?.[0];
  const filenameCaseLabel = caseNumber
    ? `case-${caseNumber.padStart(2, "0")}`
    : model.caseLabel;
  const parts = [
    "odontiq",
    model.studentName ?? "student",
    filenameCaseLabel,
    model.patientName,
    formatFacultyReportFilenameTimestamp(model.completedAt),
  ].map(sanitizeFacultyReportFilenamePart);

  return `${parts.filter(Boolean).join("-")}.pdf`;
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
      pdf.addPanelItem(
        item.title,
        criterionById.get(item.criterionId)?.critical
          ? "Critical strength"
          : undefined,
      );
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
      pdf.addPanelItem(
        item.title,
        item.status === "uncertain"
          ? "Uncertain - No credit awarded"
          : "Not Met",
      );
      if (criterionById.get(item.criterionId)?.critical) {
        pdf.addParagraph("Critical", {
          color: [0.52, 0.33, 0.03],
        });
      }
      if (item.status === "uncertain") {
        pdf.addParagraph(
          "This item could not be verified clearly from the encounter and received no credit.",
          { color: [0.38, 0.43, 0.46] },
        );
      }
    }
  }
}

function addEncounterTranscript(
  pdf: PdfDocument,
  transcript: CanonicalFacultyReportPresentation["transcript"],
) {
  pdf.addSectionHeading(FACULTY_REPORT_DISPLAY_TITLES.encounterTranscript);

  if (transcript.length === 0) {
    pdf.addParagraph("No transcript was recorded.", {
      color: [0.38, 0.43, 0.46],
    });
    return;
  }

  transcript.forEach((message, index) => {
    pdf.addParagraph(message.role === "student" ? "Provider:" : "Patient:", {
      bold: true,
    });
    pdf.addParagraph(message.text, {
      color: [0.38, 0.43, 0.46],
      indent: 12,
    });
    if (index < transcript.length - 1) {
      pdf.addGap(6);
    }
  });
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
