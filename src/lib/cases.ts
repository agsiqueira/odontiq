import {
  CASE_DATA,
  type CaseStatus,
  type CaseUrgency,
  type EvaluatorDomain,
} from "@/data/cases";

export type { CaseStatus, CaseUrgency };

export type CaseExamination = {
  id: string;
  label: string;
  file: string;
};

export type CasePatientChecklistItem = {
  id: string;
  label: string;
  domain: EvaluatorDomain;
  triggers?: string[];
};

export type CaseClinicalChecklistItem = {
  id: string;
  label: string;
  domain: EvaluatorDomain;
};

export type OdontIQCase = {
  id: string;
  patientName: string;
  title: string;
  age: number;
  estimatedTime: string;
  urgency: CaseUrgency;
  status: CaseStatus;
  score: number | null;
  openingStatement: string;
  assets: {
    rest: string;
    talking: string;
    examinations: CaseExamination[];
  };
  patientChecklist: CasePatientChecklistItem[];
  clinicalChecklist: CaseClinicalChecklistItem[];
};

export const CASES: OdontIQCase[] = CASE_DATA.map((caseData) => ({
  id: caseData.metadata.id,
  patientName: caseData.patient.name,
  title: caseData.metadata.title,
  age: caseData.patient.age,
  estimatedTime: caseData.metadata.estimatedTime,
  urgency: caseData.metadata.urgency,
  status: caseData.metadata.status,
  score: caseData.metadata.score,
  openingStatement: caseData.metadata.chiefComplaint,
  assets: {
    rest: caseData.assets.rest,
    talking: caseData.assets.talking,
    examinations: caseData.assets.examinations.map((examination) => ({
      id: examination.id,
      label: examination.title,
      file: examination.image,
    })),
  },
  patientChecklist: caseData.patientChecklist.map((item) => ({
    id: item.id,
    label: item.label,
    domain: item.domain,
    triggers: item.triggers,
  })),
  clinicalChecklist: caseData.clinicalChecklist.map((item) => ({
    id: item.id,
    label: item.label,
    domain: item.domain,
  })),
}));

export function getCaseById(caseId: string) {
  return CASES.find((patientCase) => patientCase.id === caseId);
}
