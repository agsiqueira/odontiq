import case01 from "./case-01/case.json";
import case02 from "./case-02/case.json";
import case03 from "./case-03/case.json";
import case04 from "./case-04/case.json";
import case05 from "./case-05/case.json";

export type CaseStatus = "not-started" | "in-progress" | "completed";
export type CaseUrgency = "Routine" | "Urgent" | "Emergency";
export type EvaluatorDomain =
  | "communication"
  | "history"
  | "examination"
  | "reasoning"
  | "management";

type ChecklistItem = {
  id: string;
  label: string;
  domain: EvaluatorDomain;
  triggers?: string[];
  weight: number;
  critical?: boolean;
};

export type CaseData = {
  metadata: {
    schemaVersion: "1.0";
    id: string;
    title: string;
    estimatedTime: string;
    urgency: CaseUrgency;
    status: CaseStatus;
    score: number | null;
    chiefComplaint: string;
  };
  patient: {
    name: string;
    age: number;
    sex: string;
  };
  voicePreference?: {
    provider: "navigator";
    voiceId?: string;
    preferredVoiceId?: string;
    fallbackVoices?: Array<{
      voiceId: string;
      speed: number;
    }>;
    speed?: number;
    gender?: "male" | "female" | "nonbinary" | "unspecified";
    ageGroup?: "child" | "young_adult" | "adult" | "older";
    bodyHabitus?: "heavier_set" | "average" | "slender" | "unspecified";
    tone?: string;
    speakingStyle?: string;
    demeanor?: string[];
  };
  assets: {
    rest: string;
    talking: string;
    examinations: Array<{
      id: string;
      title: string;
      image: string;
      description: string;
    }>;
  };
  conversation: {
    openingGreeting: string;
    scripted: Array<{
      id: string;
      intent: string;
      triggers: string[];
      response: string;
      requiredFactsCovered?: string[];
      checklistItemId?: string;
    }>;
  };
  patientChecklist: ChecklistItem[];
  clinicalChecklist: ChecklistItem[];
  supportingInfo: {
    history: {
      onset: string;
      duration: string;
      pain: string;
      medications: string;
      allergies: string;
      medicalHistory: string;
      dentalHistory: string;
      socialHistory: string;
    };
    hpiFacts: string[];
    redFlags: string[];
    examinationFindings: string[];
    expectedQuestions: string[];
    diagnosis: string;
    differentialDiagnosis: string[];
    managementExpectations: string[];
    requiredInvestigations: string[];
    treatmentExpectations: string[];
    referralExpectations: string[];
    safetyNettingExpectations: string[];
    learningObjectives: string[];
    reportData: {
      keyFindings: string[];
      criticalMisses: string[];
      idealSummary: string;
    };
    evaluation: {
      patientChecklistWeight: number;
      clinicalChecklistWeight: number;
      totalScore: string;
    };
  };
};

export const CASE_DATA: CaseData[] = [
  case01 as CaseData,
  case02 as CaseData,
  case03 as CaseData,
  case04 as CaseData,
  case05 as CaseData,
];

export function loadCase(caseId: string) {
  return CASE_DATA.find((caseData) => caseData.metadata.id === caseId);
}
