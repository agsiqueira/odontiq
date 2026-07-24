export const PATIENT_QUESTION_CONFIDENCE_THRESHOLD = 0.85;

export type PatientQuestionId =
  | "c1-extraction-question"
  | "c2-antibiotic-effect-question"
  | "c3-follow-up-needed-question"
  | "c3-follow-up-why"
  | "c4-antibiotic-needed-question"
  | "c5-antibiotic-request";

export type PatientQuestionEventId =
  | "hospitalAdmissionOrSurgicalManagementDiscussed"
  | "antibioticsRecommendedAsCurrentPlan"
  | "incisionAndDrainageProposed"
  | "patientAgreedToIncisionAndDrainage"
  | "promptDentalFollowUpConfirmed"
  | "drainageTemporaryOrNondefinitiveExplained"
  | "definitiveDentalTreatmentExplained"
  | "painManagementOrDispositionDiscussed"
  | "antibioticsRecommended"
  | "antibioticsNotIndicatedExplained"
  | "patientPainDescribed";

export type PatientQuestionEvents = Record<PatientQuestionEventId, boolean>;

export type PatientQuestionState = {
  schemaVersion: 1;
  version: number;
  detectedEvents: PatientQuestionEvents;
  emittedQuestionIds: PatientQuestionId[];
};

export type PatientQuestionClassification = {
  schemaVersion: 1;
  caseId: string;
  analyzedStudentMessageId: string;
  detectedEvents: PatientQuestionEvents;
  eligibleQuestionId: PatientQuestionId | null;
  confidence: number;
  evidenceMessageIds: string[];
};

export const EMPTY_PATIENT_QUESTION_EVENTS: PatientQuestionEvents = {
  hospitalAdmissionOrSurgicalManagementDiscussed: false,
  antibioticsRecommendedAsCurrentPlan: false,
  incisionAndDrainageProposed: false,
  patientAgreedToIncisionAndDrainage: false,
  promptDentalFollowUpConfirmed: false,
  drainageTemporaryOrNondefinitiveExplained: false,
  definitiveDentalTreatmentExplained: false,
  painManagementOrDispositionDiscussed: false,
  antibioticsRecommended: false,
  antibioticsNotIndicatedExplained: false,
  patientPainDescribed: false,
};

export function createEmptyPatientQuestionState(): PatientQuestionState {
  return {
    schemaVersion: 1,
    version: 0,
    detectedEvents: { ...EMPTY_PATIENT_QUESTION_EVENTS },
    emittedQuestionIds: [],
  };
}
