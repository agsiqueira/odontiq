import type { EvaluatorDomain } from "@/data/cases";
import type { ChecklistEvaluation } from "@/lib/checklistEvaluation";

export type ReportTranscriptRole = "student" | "patient";

export type ReportTranscriptMessage = {
  role: ReportTranscriptRole;
  text: string;
  timestamp?: string;
};

export type ReportTimelineEvent = {
  type: string;
  label: string;
  timestamp?: string;
};

export type ReportDomainSection = {
  score: number;
  completed: number;
  total: number;
  earnedWeight: number;
  availableWeight: number;
  completedCriteria: string[];
  strengths: string[];
  missedOrIncomplete: string[];
  narrative: string;
  criticalMisses: string[];
};

export type ReportClinicalReasoningSection = {
  expectedDiagnosis: string;
  differentialDiagnosis: string[];
  supportingFindings: string[];
  keyRedFlags: string[];
};

export type ReportManagementSection = {
  requiredInvestigations: string[];
  treatmentExpectations: string[];
  referralExpectations: string[];
  safetyNettingExpectations: string[];
};

export type StructuredCaseReport = {
  case: {
    caseId: string;
    title: string;
    patientName: string;
    chiefComplaint: string;
    completedAt?: string;
  };
  overallPerformance: {
    score: number;
    summary: string;
    mainTakeaway: string;
  };
  domains: Record<EvaluatorDomain, ReportDomainSection>;
  clinicalReasoning: ReportClinicalReasoningSection;
  management: ReportManagementSection;
  practiceNext: string[];
  transcript: ReportTranscriptMessage[];
  timeline: ReportTimelineEvent[];
  grading: ChecklistEvaluation;
};
