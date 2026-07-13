import type { FacultyReport } from "./types";

export const FACULTY_REPORT_DISPLAY_TITLES = {
  report: "Faculty Rubric Report",
  criticalSafety: "Critical Safety",
  uncertainty: "Uncertainty Notice",
  competencySummary: "Competency Summary",
  strengths: "Strengths",
  improvements: "Areas for Improvement",
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
