import type {
  ReportDomainSection,
  ReportTimelineEvent,
  ReportTranscriptMessage,
  StructuredCaseReport,
} from "./reportTypes";
import {
  getDisplayDomainSection,
  getDisplayItem,
  getDisplayOverallSummary,
  getDisplayPracticeItems,
  REPORT_DOMAIN_LABELS,
  REPORT_SECTION_LABELS,
} from "./reportDisplay";

type PdfTextOptions = {
  size?: number;
  bold?: boolean;
  color?: PdfColor;
  lineHeight?: number;
  indent?: number;
  maxWidth?: number;
};

type PdfColor = [number, number, number];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BRAND_BLUE: PdfColor = [0.16, 0.33, 0.36];
const TEXT: PdfColor = [0.13, 0.16, 0.18];
const MUTED: PdfColor = [0.38, 0.43, 0.46];
const LIGHT_BLUE: PdfColor = [0.9, 0.96, 0.97];
const WARNING: PdfColor = [0.52, 0.33, 0.03];
const WARNING_BG: PdfColor = [1, 0.96, 0.86];

export async function generateReportPdfBlob(
  report: StructuredCaseReport,
): Promise<Blob> {
  const pdf = new PdfDocument();

  addReportHeader(pdf, report);
  addOverallPerformance(pdf, report);
  addDomainPerformance(pdf, report);
  addClinicalReasoning(pdf, report);
  addManagement(pdf, report);
  addPracticeNext(pdf, report);
  addTranscript(pdf, report.transcript);
  addTimeline(pdf, report.timeline);

  return pdf.toBlob();
}

export function buildReportPdfFilename(report: StructuredCaseReport) {
  const caseId = slugify(report.case.caseId);
  const patient = slugify(report.case.patientName);

  return `odontiq-${caseId}-${patient}-report.pdf`;
}

function addReportHeader(pdf: PdfDocument, report: StructuredCaseReport) {
  pdf.drawRect(MARGIN_X, 42, CONTENT_WIDTH, 5, BRAND_BLUE);
  pdf.addText("odontIQ", {
    size: 20,
    bold: true,
    color: BRAND_BLUE,
    lineHeight: 24,
  });
  pdf.addText(report.case.title, {
    size: 17,
    bold: true,
    lineHeight: 22,
  });
  pdf.addText(
    [
      report.case.patientName,
      report.case.completedAt
        ? `Completed ${formatDateTime(report.case.completedAt)}`
        : undefined,
    ]
      .filter(Boolean)
      .join(" | "),
    { size: 10, color: MUTED, lineHeight: 14 },
  );
  pdf.addGap(14);
}

function addOverallPerformance(
  pdf: PdfDocument,
  report: StructuredCaseReport,
) {
  pdf.addSectionHeadingWithFirstContent("Overall Performance", 46);
  pdf.addScoreLine("Overall score", report.overallPerformance.score);
  pdf.addParagraph(getDisplayOverallSummary(report.overallPerformance.summary));
  pdf.addCallout("Main takeaway", report.overallPerformance.mainTakeaway);
}

function addDomainPerformance(pdf: PdfDocument, report: StructuredCaseReport) {
  pdf.addSectionHeadingWithFirstContent(REPORT_SECTION_LABELS.domainScores, 92);

  REPORT_DOMAIN_LABELS.forEach(({ id, label }) => {
    addDomainSection(pdf, label, report.domains[id]);
  });
}

function addDomainSection(
  pdf: PdfDocument,
  label: string,
  section: ReportDomainSection,
) {
  const displaySection = getDisplayDomainSection(section);
  const estimatedHeight =
    48 +
    estimateParagraphHeight(displaySection.displayNarrative) +
    estimateListHeight(displaySection.displayStrengths) +
    estimateListHeight(displaySection.displayMissedOrIncomplete) +
    (displaySection.displayCriticalMisses.length > 0
      ? estimateListHeight(displaySection.displayCriticalMisses) + 20
      : 0);

  pdf.ensureBlockSpace(Math.min(estimatedHeight, 180));
  pdf.addSubheading(label);
  pdf.addScoreLine("Score", section.score);
  pdf.addParagraph(displaySection.displayNarrative);
  pdf.addList(
    "Strengths",
    displaySection.displayStrengths,
    displaySection.score === 0 && displaySection.completed === 0
      ? "No demonstrated strength was identified in this domain."
      : undefined,
  );
  pdf.addList(
    "Missed or incomplete",
    displaySection.displayMissedOrIncomplete,
    "No missed or incomplete areas identified.",
  );

  if (displaySection.displayCriticalMisses.length > 0) {
    pdf.addWarningList(
      "Priority safety point",
      displaySection.displayCriticalMisses,
    );
  }

  pdf.addGap(8);
}

function addClinicalReasoning(
  pdf: PdfDocument,
  report: StructuredCaseReport,
) {
  pdf.addSectionHeadingWithFirstContent(
    REPORT_SECTION_LABELS.clinicalReasoningDetails,
    48,
  );
  pdf.addSubheading("Expected diagnosis");
  pdf.addParagraph(report.clinicalReasoning.expectedDiagnosis);
  pdf.addList(
    "Differential diagnosis",
    report.clinicalReasoning.differentialDiagnosis,
  );
  pdf.addList("Supporting findings", report.clinicalReasoning.supportingFindings);
  pdf.addList("Key red flags", report.clinicalReasoning.keyRedFlags);
}

function addManagement(pdf: PdfDocument, report: StructuredCaseReport) {
  pdf.addSectionHeadingWithFirstContent(
    REPORT_SECTION_LABELS.managementPlanExpectations,
    48,
  );
  pdf.addList(
    "Required investigations",
    report.management.requiredInvestigations,
  );
  pdf.addList(
    "Treatment expectations",
    report.management.treatmentExpectations,
  );
  pdf.addList("Referral or escalation", report.management.referralExpectations);
  pdf.addList("Safety-netting", report.management.safetyNettingExpectations);
}

function addPracticeNext(pdf: PdfDocument, report: StructuredCaseReport) {
  const items = getDisplayPracticeItems(report.practiceNext);

  pdf.addSectionHeadingWithFirstContent(
    "What to Practice Next",
    estimateListHeight(items),
  );
  items.forEach((item, index) => {
    pdf.addParagraph(`${index + 1}. ${item}`, {
      indent: 12,
      lineHeight: 15,
    });
  });
}

function addTranscript(pdf: PdfDocument, transcript: ReportTranscriptMessage[]) {
  pdf.startNewPageIfContentExists();
  pdf.addSectionHeadingWithFirstContent(
    REPORT_SECTION_LABELS.transcriptAppendix,
    40,
  );

  if (transcript.length === 0) {
    pdf.addParagraph("No transcript was recorded.", { color: MUTED });
    return;
  }

  transcript.forEach((message) => {
    const timestamp = message.timestamp
      ? ` (${formatDateTime(message.timestamp)})`
      : "";

    pdf.addParagraph(`${roleLabel(message.role)}${timestamp}`, {
      bold: true,
      lineHeight: 14,
    });
    pdf.addParagraph(message.text, {
      color: MUTED,
      indent: 12,
      lineHeight: 14,
    });
    pdf.addGap(2);
  });
}

function addTimeline(pdf: PdfDocument, timeline: ReportTimelineEvent[]) {
  pdf.startNewPageIfContentExists();
  pdf.addSectionHeadingWithFirstContent(
    REPORT_SECTION_LABELS.timelineAppendix,
    40,
  );

  if (timeline.length === 0) {
    pdf.addParagraph("No timeline events were recorded.", { color: MUTED });
    return;
  }

  timeline.forEach((event) => {
    const timestamp = event.timestamp ? ` - ${formatDateTime(event.timestamp)}` : "";
    pdf.addParagraph(`${getDisplayItem(event.label)}${timestamp}`, {
      indent: 12,
      lineHeight: 14,
    });
  });
}

export class PdfDocument {
  private pages: string[][] = [];
  private y = MARGIN_TOP;

  constructor() {
    this.addPage();
  }

  addSectionHeading(title: string) {
    this.addSectionHeadingWithFirstContent(title, 20);
  }

  addSectionHeadingWithFirstContent(title: string, firstContentHeight: number) {
    this.ensureBlockSpace(40 + firstContentHeight);
    this.addGap(10);
    this.drawRect(MARGIN_X, this.y, 26, 3, BRAND_BLUE);
    this.y += 10;
    this.addText(title, {
      size: 15,
      bold: true,
      color: BRAND_BLUE,
      lineHeight: 20,
    });
  }

  addSubheading(title: string) {
    this.ensureSpace(28);
    this.addText(title, {
      size: 12,
      bold: true,
      lineHeight: 16,
    });
  }

  addScoreLine(label: string, score: number) {
    this.addText(`${label}: ${formatScore(score)}%`, {
      size: 10,
      bold: true,
      color: BRAND_BLUE,
      lineHeight: 15,
    });
  }

  addParagraph(text: string, options: PdfTextOptions = {}) {
    this.addText(text, {
      size: 10,
      color: TEXT,
      lineHeight: 14,
      ...options,
    });
  }

  addCallout(title: string, body: string) {
    const lines = [
      ...wrapText(title.toUpperCase(), 9, CONTENT_WIDTH - 28),
      ...wrapText(body, 10, CONTENT_WIDTH - 28),
    ];
    const height = lines.length * 14 + 20;

    this.ensureSpace(height + 8);
    this.drawRect(MARGIN_X, this.y, CONTENT_WIDTH, height, LIGHT_BLUE);
    this.y += 12;
    this.addText(title.toUpperCase(), {
      size: 8,
      bold: true,
      color: BRAND_BLUE,
      lineHeight: 12,
      indent: 14,
      maxWidth: CONTENT_WIDTH - 28,
    });
    this.addText(body, {
      size: 10,
      lineHeight: 14,
      indent: 14,
      maxWidth: CONTENT_WIDTH - 28,
    });
    this.y += 8;
  }

  addList(title: string, items: string[], emptyText?: string) {
    const displayItems = items.map(getDisplayItem);
    this.ensureBlockSpace(
      14 +
        (displayItems.length > 0
          ? Math.min(estimateListHeight(displayItems), 86)
          : 18),
    );
    this.addText(title.toUpperCase(), {
      size: 8,
      bold: true,
      color: MUTED,
      lineHeight: 12,
    });

    if (displayItems.length === 0) {
      if (emptyText) {
        this.addParagraph(emptyText, { color: MUTED, indent: 12 });
      }

      return;
    }

    displayItems.forEach((item) => {
      this.addParagraph(`- ${item}`, {
        color: MUTED,
        indent: 12,
        lineHeight: 14,
      });
    });
  }

  addWarningList(title: string, items: string[]) {
    const displayItems = items.map(getDisplayItem);
    const itemLines = displayItems.flatMap((item) =>
      wrapText(`- ${item}`, 10, CONTENT_WIDTH - 28),
    );
    const height = Math.max(48, itemLines.length * 14 + 28);

    this.ensureBlockSpace(height + 8);
    this.drawRect(MARGIN_X, this.y, CONTENT_WIDTH, height, WARNING_BG);
    this.y += 12;
    this.addText(title.toUpperCase(), {
      size: 8,
      bold: true,
      color: WARNING,
      lineHeight: 12,
      indent: 14,
      maxWidth: CONTENT_WIDTH - 28,
    });
    displayItems.forEach((item) => {
      this.addParagraph(`- ${item}`, {
        color: WARNING,
        indent: 14,
        maxWidth: CONTENT_WIDTH - 28,
      });
    });
    this.y += 8;
  }

  addText(text: string, options: PdfTextOptions = {}) {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size + 4;
    const indent = options.indent ?? 0;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;
    const lines = wrapText(text, size, maxWidth);

    lines.forEach((line) => {
      this.ensureSpace(lineHeight);
      this.writeText(line, MARGIN_X + indent, this.y, {
        size,
        bold: options.bold,
        color: options.color ?? TEXT,
      });
      this.y += lineHeight;
    });
  }

  addGap(height: number) {
    this.ensureSpace(height);
    this.y += height;
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN_BOTTOM) {
      this.addPage();
    }
  }

  ensureBlockSpace(height: number) {
    this.ensureSpace(height);
  }

  startNewPageIfContentExists() {
    if (this.y > MARGIN_TOP + 6) {
      this.addPage();
    }
  }

  drawRect(x: number, y: number, width: number, height: number, color: PdfColor) {
    this.currentPage().push(
      `${colorOp(color)} ${formatNumber(x)} ${formatNumber(
        PAGE_HEIGHT - y - height,
      )} ${formatNumber(width)} ${formatNumber(height)} re f`,
    );
  }

  toBlob() {
    this.pages.forEach((page, index) => {
      page.push(...footerOps(index + 1, this.pages.length));
    });

    return new Blob([buildPdfDocument(this.pages)], {
      type: "application/pdf",
    });
  }

  private addPage() {
    this.pages.push([]);
    this.y = MARGIN_TOP;
  }

  private currentPage() {
    return this.pages[this.pages.length - 1];
  }

  private writeText(
    text: string,
    x: number,
    y: number,
    options: {
      size: number;
      bold?: boolean;
      color: PdfColor;
    },
  ) {
    this.currentPage().push(
      `BT ${colorOp(options.color)} /${options.bold ? "F2" : "F1"} ${
        options.size
      } Tf ${formatNumber(x)} ${formatNumber(PAGE_HEIGHT - y)} Td (${escapePdfText(
        text,
      )}) Tj ET`,
    );
  }
}

function buildPdfDocument(pageOps: string[][]) {
  const objects: string[] = [];
  const pageIds = pageOps.map((_, index) => 5 + index * 2);
  const contentIds = pageOps.map((_, index) => 6 + index * 2);

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageOps.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pageOps.forEach((ops, index) => {
    const stream = `${ops.join("\n")}\n`;
    const pageObjectIndex = pageIds[index] - 1;
    const contentObjectIndex = contentIds[index] - 1;

    objects[pageObjectIndex] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objects[contentObjectIndex] =
      `<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function footerOps(pageNumber: number, pageCount: number) {
  const footer = `odontIQ report | Page ${pageNumber} of ${pageCount}`;

  return [
    `${colorOp([0.82, 0.86, 0.88])} ${MARGIN_X} 42 ${CONTENT_WIDTH} 0.5 re f`,
    `BT ${colorOp(MUTED)} /F1 8 Tf ${MARGIN_X} 28 Td (${escapePdfText(
      footer,
    )}) Tj ET`,
  ];
}

function estimateParagraphHeight(
  text: string,
  options: {
    size?: number;
    lineHeight?: number;
    indent?: number;
    maxWidth?: number;
  } = {},
) {
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? 14;
  const indent = options.indent ?? 0;
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH - indent;

  return wrapText(text, size, maxWidth).length * lineHeight;
}

function estimateListHeight(items: string[]) {
  if (items.length === 0) {
    return 18;
  }

  return (
    14 +
    items.reduce(
      (height, item) =>
        height +
        estimateParagraphHeight(`- ${getDisplayItem(item)}`, {
          indent: 12,
          lineHeight: 14,
        }),
      0,
    )
  );
}

function wrapText(text: string, fontSize: number, maxWidth: number) {
  const normalized = normalizePdfText(text);
  const maxChars = Math.max(18, Math.floor(maxWidth / (fontSize * 0.52)));
  const paragraphs = normalized.split(/\n+/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let currentLine = "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;

      if (nextLine.length <= maxChars) {
        currentLine = nextLine;
        return;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  return lines.length > 0 ? lines : [""];
}

function colorOp(color: PdfColor) {
  return `${formatNumber(color[0])} ${formatNumber(color[1])} ${formatNumber(
    color[2],
  )} rg`;
}

function escapePdfText(text: string) {
  return normalizePdfText(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function normalizePdfText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function formatScore(score: number) {
  return Number.isInteger(score) ? score.toString() : score.toFixed(1);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function roleLabel(role: ReportTranscriptMessage["role"]) {
  return role === "student" ? "Student" : "Patient";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
