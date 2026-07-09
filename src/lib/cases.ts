import {
  CASE_DATA,
  type CaseStatus,
  type CaseUrgency,
} from "@/data/cases";

export type { CaseStatus, CaseUrgency };

export type CaseExamination = {
  id: string;
  label: string;
  file: string;
};

export type OdontIQCase = {
  id: string;
  patientName: string;
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
};

export const CASES: OdontIQCase[] = CASE_DATA.map((caseData) => ({
  id: caseData.metadata.id,
  patientName: caseData.patient.name,
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
}));

export function getCaseById(caseId: string) {
  return CASES.find((patientCase) => patientCase.id === caseId);
}

export function getRecommendedCase() {
  const unfinished = CASES.find(
    (patientCase) => patientCase.status === "in-progress"
  );

  if (unfinished) {
    return {
      patientCase: unfinished,
      label: "Continue Consultation",
      message: undefined,
    };
  }

  const nextPatient = CASES.find(
    (patientCase) => patientCase.status === "not-started"
  );

  if (nextPatient) {
    return {
      patientCase: nextPatient,
      label: "Next Patient",
      message: undefined,
    };
  }

  const lowestScorePatient = CASES.reduce((lowest, patientCase) => {
    const currentScore = patientCase.score ?? 100;
    const lowestScore = lowest.score ?? 100;
    return currentScore < lowestScore ? patientCase : lowest;
  }, CASES[0]);

  return {
    patientCase: lowestScorePatient,
    label: "Recommended Retry",
    message:
      "You completed all patient cases. This patient has the greatest opportunity for improvement.",
  };
}
