import {
  CASE_DATA,
  type CaseStatus,
  type CaseUrgency,
  type EvaluatorDomain,
} from "@/data/cases";

export type { CaseStatus, CaseUrgency };

export type CaseExamination =
  | {
      id: string;
      label: string;
      type: "image";
      file: string;
    }
  | {
      id: string;
      label: string;
      type: "vital-signs";
      findings: Array<{
        label: string;
        value: string;
      }>;
    }
  | {
      id: string;
      label: string;
      type: "clinical-findings";
      findings: Array<{
        label: string;
        value: string;
      }>;
    }
  | {
      id: string;
      label: string;
      type: "diagnostic-results";
      findings: Array<{
        label: string;
        value: string;
      }>;
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
    examinations: caseData.assets.examinations.flatMap(
      (examination): CaseExamination[] => {
        if (
          (examination.type === "vital-signs" ||
            examination.type === "clinical-findings" ||
            examination.type === "diagnostic-results") &&
          examination.title.trim() &&
          Array.isArray(examination.findings) &&
          examination.findings.length > 0 &&
          examination.findings.every(
            (finding) => finding.label.trim() && finding.value.trim(),
          )
        ) {
          return [
            {
              id: examination.id,
              label: examination.title,
              type: examination.type,
              findings: examination.findings.map((finding) => ({
                ...finding,
              })),
            },
          ];
        }

        if (
          examination.type !== "vital-signs" &&
          examination.type !== "clinical-findings" &&
          examination.type !== "diagnostic-results" &&
          examination.id.trim() &&
          examination.title.trim() &&
          examination.image.trim()
        ) {
          return [
            {
              id: examination.id,
              label: examination.title,
              type: "image",
              file: examination.image,
            },
          ];
        }

        return [];
      },
    ),
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

export { getCaseDisplayLabel } from "./caseDisplay";
