import { PdfDocument } from "./reportPdf";

export type LearnerReportPdfTranscriptEntry = Readonly<{
  role: "student" | "patient";
  text: string;
  timestamp?: string;
}>;

export type LearnerReportPdfModel = Readonly<{
  caseId: string;
  caseLabel: string;
  patientName: string;
  complaint: string;
  completedAt?: string;
  feedback:
    | Readonly<{
        status: "available";
        strengths: readonly string[];
        improvementAreas: readonly string[];
      }>
    | Readonly<{
        status: "unavailable";
      }>;
  transcript: readonly LearnerReportPdfTranscriptEntry[];
}>;

export function generateLearnerReportPdfBlob(model: LearnerReportPdfModel) {
  const pdf = new PdfDocument();

  pdf.addText("OdontIQ Consultation Report", {
    size: 20,
    bold: true,
    color: [0.16, 0.33, 0.36],
    lineHeight: 25,
  });
  pdf.addMetadataPanel([
    { label: "Case", value: model.caseLabel },
    { label: "Patient", value: model.patientName },
  ]);

  pdf.addSectionHeading("Patient Complaint");
  pdf.addParagraph(model.complaint);
  if (model.completedAt) {
    pdf.addGap(6);
    pdf.addLabelValue("Completed", formatPdfTimestamp(model.completedAt));
  }

  if (model.feedback.status === "available") {
    addFeedbackSection(pdf, "Strengths", model.feedback.strengths.slice(0, 3));
    addFeedbackSection(
      pdf,
      "Areas for Improvement",
      model.feedback.improvementAreas.slice(0, 3),
    );
  } else {
    pdf.addSectionHeading("Personalized Feedback");
    pdf.addParagraph(
      "Personalized feedback was unavailable for this consultation.",
    );
  }

  pdf.addSectionHeading("Consultation Transcript");
  if (model.transcript.length === 0) {
    pdf.addParagraph("No transcript was recorded.");
  } else {
    model.transcript.forEach((message, index) => {
      const role = message.role === "student" ? "Provider" : "Patient";
      const timestamp = message.timestamp
        ? formatPdfTimestamp(message.timestamp)
        : "";
      pdf.addParagraph(timestamp ? `${role} - ${timestamp}` : role, {
        bold: true,
      });
      pdf.addParagraph(message.text, {
        color: [0.38, 0.43, 0.46],
        indent: 12,
      });
      if (index < model.transcript.length - 1) pdf.addGap(6);
    });
  }

  return pdf.toBlob();
}

export function buildLearnerReportPdfFilename(caseId: string) {
  const safeCaseId = caseId
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `odontiq-${safeCaseId || "case"}-consultation-report.pdf`;
}

function addFeedbackSection(
  pdf: PdfDocument,
  title: string,
  items: readonly string[],
) {
  pdf.addSectionHeading(title);
  if (items.length === 0) {
    pdf.addParagraph("No items were identified for this consultation.", {
      color: [0.38, 0.43, 0.46],
    });
    return;
  }
  items.forEach((item) => pdf.addPanelItem(item));
}

function formatPdfTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${month} ${day}, ${date.getUTCFullYear()}, ${hours}:${minutes}:${seconds} UTC`;
}
