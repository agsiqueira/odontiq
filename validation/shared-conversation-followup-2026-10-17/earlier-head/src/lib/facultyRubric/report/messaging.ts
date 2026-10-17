import type { FacultyReportCompetencyStatus } from "./types";

export const FACULTY_REPORT_COMPETENCY_STRONG_THRESHOLD = 84;
export const FACULTY_REPORT_COMPETENCY_DEVELOPING_THRESHOLD = 50;

export const FACULTY_REPORT_COMPETENCY_TITLES: Record<string, string> = {
  "information-gathering": "Information Gathering",
  "clinical-findings": "Clinical Findings",
  "clinical-interpretation": "Clinical Interpretation",
  "management-planning": "Management Planning",
  "patient-communication": "Patient Communication",
  "procedural-decision": "Procedural Decisions",
  examination: "Examination",
};

export const FACULTY_REPORT_COMPETENCY_MESSAGES: Record<FacultyReportCompetencyStatus, string> = {
  strong: "You demonstrated this competency consistently.",
  developing: "You demonstrated several parts of this competency, but some items still need improvement.",
  "needs-attention": "Important items in this competency were not demonstrated clearly.",
  unavailable: "This competency was not assessed in this case.",
};

export const FACULTY_REPORT_OVERALL_MESSAGES = {
  pass: "You achieved the required score for this case.",
  "does-not-pass": "You did not reach the required score of 84% for this case.",
  "technical-invalid":
    "The faculty-rubric result could not be finalized because required evaluation data was unavailable.",
} as const;

export const FACULTY_REPORT_UNCERTAINTY_MESSAGE =
  "Some criteria could not be verified from the encounter and therefore received no credit. These items are marked as “Uncertain.”";

export const FACULTY_REPORT_CRITICAL_MISS_MESSAGE =
  "One or more critical safety criteria were not demonstrated.";

export const FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE =
  "One or more critical safety criteria could not be verified and received no credit.";

export function getCompetencyTitle(competency: string): string {
  return FACULTY_REPORT_COMPETENCY_TITLES[competency] ?? competency;
}

export function getCompetencyStatus(percentage: number | null): FacultyReportCompetencyStatus {
  if (percentage === null) {
    return "unavailable";
  }
  if (percentage >= FACULTY_REPORT_COMPETENCY_STRONG_THRESHOLD) {
    return "strong";
  }
  if (percentage >= FACULTY_REPORT_COMPETENCY_DEVELOPING_THRESHOLD) {
    return "developing";
  }
  return "needs-attention";
}

