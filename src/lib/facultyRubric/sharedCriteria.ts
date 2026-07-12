import type { FacultyRubricCriterion } from "./types";

type SharedCriterionTemplate = Omit<
  FacultyRubricCriterion,
  | "id"
  | "legacyPatientChecklistIds"
  | "legacyClinicalChecklistIds"
  | "weight"
  | "critical"
  | "provisionalWeight"
>;

type SharedCriterionOverrides = Pick<
  FacultyRubricCriterion,
  "id" | "weight" | "critical"
> &
  Partial<
    Pick<
      FacultyRubricCriterion,
      | "title"
      | "description"
      | "acceptedConcepts"
      | "examples"
      | "expectedValue"
      | "legacyPatientChecklistIds"
      | "legacyClinicalChecklistIds"
      | "reportLabel"
      | "facultyNotes"
      | "provisionalWeight"
    >
  >;

export function composeSharedCriterion(
  template: SharedCriterionTemplate,
  overrides: SharedCriterionOverrides,
): FacultyRubricCriterion {
  return {
    ...template,
    ...overrides,
    acceptedConcepts:
      overrides.acceptedConcepts ?? template.acceptedConcepts
        ? [...(overrides.acceptedConcepts ?? template.acceptedConcepts ?? [])]
        : undefined,
    examples:
      overrides.examples ?? template.examples
        ? [...(overrides.examples ?? template.examples ?? [])]
        : undefined,
    legacyPatientChecklistIds: overrides.legacyPatientChecklistIds
      ? [...overrides.legacyPatientChecklistIds]
      : undefined,
    legacyClinicalChecklistIds: overrides.legacyClinicalChecklistIds
      ? [...overrides.legacyClinicalChecklistIds]
      : undefined,
  };
}

export const sharedCriterionTemplates = {
  askedAboutFever: {
    name: "asked-about-fever",
    title: "Asked About Fever",
    description:
      "Asked a direct or clearly targeted follow-up about fever, chills, malaise, fatigue, weakness, body aches, nausea, vomiting, or systemic illness. Broad chief-complaint prompts do not count, and patient-volunteered symptoms require an explicit learner follow-up.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: [
      "fever",
      "chills",
      "temperature",
      "feeling unwell",
      "malaise",
      "fatigue",
      "weakness",
      "body aches",
      "nausea",
      "vomiting",
      "systemic symptoms",
    ],
    examples: [
      "Positive: Have you had a fever or chills?",
      "Positive: You mentioned feeling sick—have you had fever, chills, or fatigue?",
      "Negative: What brings you in?",
      "Negative: Tell me what happened.",
      "Negative: A patient volunteers fever without a targeted learner follow-up.",
    ],
    reportLabel: "Asked about fever or systemic symptoms",
  },
  askedAboutPenicillinAllergy: {
    name: "asked-about-penicillin-allergy",
    title: "Asked About Penicillin Allergy",
    description: "Asked about penicillin allergy or medication allergies.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: ["penicillin allergy", "medication allergy", "allergies"],
    reportLabel: "Checked for medication allergies",
  },
  askedAboutColdPain: {
    name: "asked-about-cold-pain",
    title: "Asked About Cold Pain",
    description: "Asked whether cold triggers or changes the dental pain.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: ["cold pain", "thermal sensitivity", "temperature sensitivity"],
    reportLabel: "Asked about cold or temperature sensitivity",
  },
  askedAboutLingeringColdPain: {
    name: "asked-about-lingering-cold-pain",
    title: "Asked Whether Cold Pain Lingers",
    description:
      "Asked whether cold-triggered pain resolves immediately or persists after the cold stimulus is removed.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: [
      "cold pain lingers",
      "cold pain resolves",
      "pain after cold is removed",
    ],
    reportLabel: "Clarified whether cold pain lingered",
  },
  askedAboutBitingPain: {
    name: "asked-about-biting-pain",
    title: "Asked About Biting Pain",
    description:
      "Asked about pain with biting, chewing, tapping, or percussion-like pressure.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: ["biting pain", "chewing pain", "tapping pain", "percussion pain"],
    reportLabel: "Asked about pain with biting or chewing",
  },
  askedAboutHomeMedicationUse: {
    name: "asked-about-home-medication-use",
    title: "Asked About Home Medication Use",
    description:
      "Asked about home use of ibuprofen, acetaminophen, Tylenol, Advil, Motrin, or antibiotics.",
    competency: "information-gathering",
    evaluationMode: "conversation-question",
    expectation: "required",
    source: "faculty-history-question",
    acceptedConcepts: [
      "ibuprofen",
      "acetaminophen",
      "Tylenol",
      "Advil",
      "Motrin",
      "antibiotics",
    ],
    reportLabel: "Reviewed medication use before the visit",
  },
  offeredDentalAnesthesia: {
    name: "offered-dental-anesthesia",
    title: "Offered Dental Anesthesia",
    description:
      "Offered a dental block, local anesthesia, or injection for temporary pain control.",
    competency: "patient-communication",
    evaluationMode: "recommendation",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["dental block", "local anesthesia", "injection", "nerve block"],
    reportLabel: "Offered local anesthesia for pain control",
  },
  explainedTemporaryPainRelief: {
    name: "explained-temporary-pain-relief",
    title: "Explained Temporary Pain Relief",
    description:
      "Explained that a dental block or local anesthesia provides temporary pain relief.",
    competency: "patient-communication",
    evaluationMode: "patient-education",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["temporary relief", "short-term pain control", "wear off"],
    reportLabel: "Explained that anesthesia is temporary pain relief",
  },
  recommendedPromptDentalFollowUp: {
    name: "recommended-prompt-dental-follow-up",
    title: "Recommended Prompt Dental Follow-Up",
    description: "Recommended seeing a dentist soon for definitive dental care.",
    competency: "management-planning",
    evaluationMode: "recommendation",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["see a dentist soon", "dental follow-up", "definitive dental care"],
    reportLabel: "Recommended prompt dental follow-up",
  },
  askedAboutDentalFollowUpAccess: {
    name: "asked-about-dental-follow-up-access",
    title: "Asked About Dental Follow-Up Access",
    description: "Asked whether the patient is able to obtain dental follow-up soon.",
    competency: "patient-communication",
    evaluationMode: "shared-decision-making",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["able to see a dentist", "access to dental follow-up"],
    reportLabel: "Assessed ability to obtain dental follow-up",
  },
  askedWhetherPatientWantsToSaveTooth: {
    name: "asked-whether-patient-wants-to-save-tooth",
    title: "Asked Whether the Patient Wants to Save the Tooth",
    description:
      "Asked about the patient's preference or goal regarding saving the affected tooth.",
    competency: "patient-communication",
    evaluationMode: "shared-decision-making",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["save the tooth", "patient goals", "tooth preservation"],
    reportLabel: "Explored the patient's goal for saving the tooth",
  },
  explainedAntibioticsNotIndicated: {
    name: "explained-antibiotics-not-indicated",
    title: "Explained Antibiotics Are Not Indicated",
    description:
      "Explained why antibiotics are not indicated when infection signs are absent.",
    competency: "patient-communication",
    evaluationMode: "patient-education",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["antibiotics not indicated", "no signs of infection"],
    reportLabel: "Explained why antibiotics were not indicated",
  },
} satisfies Record<string, SharedCriterionTemplate>;
