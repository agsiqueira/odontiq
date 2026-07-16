import type { FacultyReport } from "./types";

export const FACULTY_REPORT_DISPLAY_TITLES = {
  report: "Faculty Rubric Report",
  criticalSafety: "Critical Safety",
  uncertainty: "Uncertainty Notice",
  competencySummary: "Competency Summary",
  strengths: "Strengths",
  improvements: "Areas for Improvement",
  encounterTranscript: "Encounter Transcript",
} as const;

export function getCriticalSafetyDisplayTitle(report: FacultyReport) {
  return report.criticalSafetySummary.status === "critical-uncertain"
    ? "Critical uncertainty"
    : "Critical miss";
}

export function getCriticalSafetyDisplayMessage(report: FacultyReport) {
  return `${report.criticalSafetySummary.message} Critical warnings are shown separately from the numeric score and do not imply an automatic failure or score cap.`;
}

export function formatFacultyReportPercent(value: number | null) {
  return value === null ? "Unavailable" : `${value}%`;
}

export function formatFacultyReportDate(value: string | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "long",
      }).format(date);
}

export function sanitizeFacultyReportFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatFacultyReportFilenameTimestamp(
  value: string | undefined,
) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}${part("second")}`;
}

export function getStudentDisplayName(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
}) {
  const joinedName = [input.firstName, input.lastName].filter(Boolean).join(" ");
  return (
    input.fullName?.trim() ||
    joinedName.trim() ||
    input.username?.trim() ||
    input.primaryEmailAddress?.emailAddress?.trim() ||
    undefined
  );
}
