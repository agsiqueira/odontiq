import type {
  PatientQuestionEventId,
  PatientQuestionId,
} from "./types";

export type PatientQuestionDefinition = {
  id: PatientQuestionId;
  caseId: string;
  text: string;
  semanticPrerequisites: PatientQuestionEventId[];
  deterministicPrerequisiteQuestionIds: PatientQuestionId[];
  onceOnly: true;
};

export const PATIENT_QUESTION_CATALOG = [
  {
    id: "c1-extraction-question",
    caseId: "case-01",
    text: "Will they pull out the bad tooth?",
    semanticPrerequisites: ["hospitalAdmissionOrSurgicalManagementDiscussed"],
    deterministicPrerequisiteQuestionIds: [],
    onceOnly: true,
  },
  {
    id: "c2-antibiotic-effect-question",
    caseId: "case-02",
    text: "Will the antibiotic make the tooth better?",
    semanticPrerequisites: ["antibioticsRecommendedAsCurrentPlan"],
    deterministicPrerequisiteQuestionIds: [],
    onceOnly: true,
  },
  {
    id: "c3-follow-up-needed-question",
    caseId: "case-03",
    text: "Since I am going to do this, do I still need to see my dentist soon?",
    semanticPrerequisites: [
      "incisionAndDrainageProposed",
      "patientAgreedToIncisionAndDrainage",
    ],
    deterministicPrerequisiteQuestionIds: [],
    onceOnly: true,
  },
  {
    id: "c3-follow-up-why",
    caseId: "case-03",
    text: "Why?",
    semanticPrerequisites: ["promptDentalFollowUpConfirmed"],
    deterministicPrerequisiteQuestionIds: ["c3-follow-up-needed-question"],
    onceOnly: true,
  },
  {
    id: "c4-antibiotic-needed-question",
    caseId: "case-04",
    text: "Do I need an antibiotic?",
    semanticPrerequisites: ["painManagementOrDispositionDiscussed"],
    deterministicPrerequisiteQuestionIds: [],
    onceOnly: true,
  },
  {
    id: "c5-antibiotic-request",
    caseId: "case-05",
    text: "Can I get an antibiotic? It has helped in the past when I had a toothache.",
    semanticPrerequisites: ["patientPainDescribed"],
    deterministicPrerequisiteQuestionIds: [],
    onceOnly: true,
  },
] as const satisfies readonly PatientQuestionDefinition[];

export function getPatientQuestion(id: PatientQuestionId) {
  return PATIENT_QUESTION_CATALOG.find((question) => question.id === id);
}

export function patientQuestionsForCase(caseId: string) {
  return PATIENT_QUESTION_CATALOG.filter((question) => question.caseId === caseId);
}
