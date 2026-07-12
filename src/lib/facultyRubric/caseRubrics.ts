import {
  composeSharedCriterion,
  sharedCriterionTemplates,
} from "./sharedCriteria";
import type {
  FacultyRubric,
  FacultyRubricCriterion,
  FacultyRubricEvaluationMode,
} from "./types";

type CriterionInput = Omit<FacultyRubricCriterion, "weight" | "critical"> &
  Partial<Pick<FacultyRubricCriterion, "weight" | "critical" | "provisionalWeight">>;

function criterion(input: CriterionInput): FacultyRubricCriterion {
  return {
    weight: input.expectation === "neutral" ? 0 : 1,
    critical: false,
    provisionalWeight: input.expectation !== "neutral" && input.weight === undefined,
    ...input,
  };
}

function shared(
  template: keyof typeof sharedCriterionTemplates,
  overrides: Parameters<typeof composeSharedCriterion>[1],
) {
  return composeSharedCriterion(sharedCriterionTemplates[template], overrides);
}

function finding({
  id,
  name,
  title,
  expectedValue = true,
  critical = false,
  legacyPatientChecklistIds,
  legacyClinicalChecklistIds,
  acceptedConcepts,
}: {
  id: string;
  name: string;
  title: string;
  expectedValue?: string | boolean | string[];
  critical?: boolean;
  legacyPatientChecklistIds?: string[];
  legacyClinicalChecklistIds?: string[];
  acceptedConcepts?: string[];
}) {
  return criterion({
    id,
    name,
    title,
    description: `Elicited the expected case finding: ${title}.`,
    competency: "clinical-findings",
    evaluationMode: "finding-elicitation",
    expectation: "required",
    source: "faculty-clinical-checklist",
    expectedValue,
    critical,
    acceptedConcepts,
    legacyPatientChecklistIds,
    legacyClinicalChecklistIds,
    reportLabel: title,
  });
}

function neutralFinding(id: string, name: string, title: string) {
  return criterion({
    id,
    name,
    title,
    description:
      "Unmarked faculty-source finding. Asking about it is allowed, but it is neutral for grading.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "neutral",
    source: "faculty-clinical-checklist",
    expectedValue: false,
    critical: false,
    reportLabel: title,
  });
}

function interpretation({
  id,
  name,
  title,
  description,
  expectedValue,
  critical = false,
  legacyClinicalChecklistIds,
  evaluationMode = "clinical-statement",
}: {
  id: string;
  name: string;
  title: string;
  description: string;
  expectedValue?: string | boolean | string[];
  critical?: boolean;
  legacyClinicalChecklistIds?: string[];
  evaluationMode?: FacultyRubricEvaluationMode;
}) {
  return criterion({
    id,
    name,
    title,
    description,
    competency: "clinical-interpretation",
    evaluationMode,
    expectation: "required",
    source: "faculty-clinical-checklist",
    expectedValue,
    critical,
    legacyClinicalChecklistIds,
    reportLabel: title,
  });
}

function recommendation({
  id,
  name,
  title,
  description,
  critical = false,
  acceptedConcepts,
  legacyClinicalChecklistIds,
  expectedValue = false,
}: {
  id: string;
  name: string;
  title: string;
  description: string;
  critical?: boolean;
  acceptedConcepts?: string[];
  legacyClinicalChecklistIds?: string[];
  expectedValue?: boolean;
}) {
  return criterion({
    id,
    name,
    title,
    description,
    competency: "management-planning",
    evaluationMode: "recommendation",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts,
    critical,
    legacyClinicalChecklistIds,
    reportLabel: title,
    expectedValue,
  });
}

function reviewedAvailableExamination({
  id,
  legacyPatientChecklistIds = ["examination-findings"],
}: {
  id: string;
  legacyPatientChecklistIds?: string[];
}) {
  return criterion({
    id,
    name: "reviewed-available-examination-findings",
    title: "Reviewed Available Examination Findings",
    description:
      "Reviewed the structured examination media made available for this case.",
    competency: "examination",
    evaluationMode: "examination-action",
    expectation: "required",
    source: "legacy-checklist",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds,
    reportLabel: "Reviewed available examination findings",
  });
}

const case01Criteria: FacultyRubricCriterion[] = [
  shared("askedAboutFever", {
    id: "C1-IG-001",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-3"],
  }),
  shared("askedAboutPenicillinAllergy", {
    id: "C1-IG-002",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["allergies"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("askedAboutColdPain", {
    id: "C1-IG-003",
    weight: 1,
    critical: false,
    provisionalWeight: true,
    facultyNotes: "No clear legacy Case 1 thermal-sensitivity checklist item exists.",
  }),
  shared("askedAboutLingeringColdPain", {
    id: "C1-IG-004",
    weight: 1,
    critical: false,
    provisionalWeight: true,
    facultyNotes: "No clear legacy Case 1 lingering-cold checklist item exists.",
  }),
  shared("askedAboutBitingPain", {
    id: "C1-IG-005",
    weight: 1,
    critical: false,
    provisionalWeight: true,
    facultyNotes: "No clear legacy Case 1 biting-pain checklist item exists.",
  }),
  shared("askedAboutHomeMedicationUse", {
    id: "C1-IG-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["medications"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  finding({
    id: "C1-CF-001",
    name: "elicited-difficulty-breathing",
    title: "Elicited Difficulty Breathing",
    critical: true,
    legacyPatientChecklistIds: ["airway"],
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["trouble breathing", "dyspnea", "airway symptoms"],
  }),
  finding({
    id: "C1-CF-002",
    name: "elicited-bilateral-submandibular-swelling",
    title: "Elicited Bilateral Submandibular Swelling",
    critical: true,
    legacyPatientChecklistIds: ["airway"],
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["bilateral swelling", "submandibular swelling"],
  }),
  finding({
    id: "C1-CF-003",
    name: "elicited-difficulty-swallowing",
    title: "Elicited Difficulty Swallowing",
    critical: true,
    legacyPatientChecklistIds: ["airway"],
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["dysphagia", "trouble swallowing", "painful swallowing"],
  }),
  finding({
    id: "C1-CF-004",
    name: "elicited-difficulty-speaking",
    title: "Elicited Difficulty Speaking",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["difficulty speaking", "speech difficulty"],
  }),
  finding({
    id: "C1-CF-005",
    name: "elicited-voice-change",
    title: "Elicited Voice Change",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["voice change", "muffled voice"],
  }),
  neutralFinding("C1-CF-N01", "trismus-neutral", "Trismus"),
  neutralFinding("C1-CF-N02", "periorbital-swelling-neutral", "Periorbital Swelling"),
  neutralFinding(
    "C1-CF-N03",
    "inferior-border-mandible-neutral",
    "Inability to Palpate the Inferior Border of the Mandible",
  ),
  neutralFinding("C1-CF-N04", "raised-floor-mouth-neutral", "Raised Floor of Mouth"),
  neutralFinding("C1-CF-N05", "palpable-neck-swelling-neutral", "Palpable Neck Swelling"),
  neutralFinding(
    "C1-CF-N06",
    "oropharyngeal-swelling-neutral",
    "Oropharyngeal Swelling",
  ),
  interpretation({
    id: "C1-CI-001",
    name: "recognized-airway-patent",
    title: "Recognized Airway Is Patent",
    description: "Recognized whether the airway is patent in the case state.",
    expectedValue: true,
    critical: true,
  }),
  interpretation({
    id: "C1-CI-002",
    name: "recognized-emergency-urgency",
    title: "Recognized Emergency-Level Urgency",
    description: "Recognized the case as an emergency-level deep space infection risk.",
    expectedValue: "emergency",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-5"],
  }),
  recommendation({
    id: "C1-MP-001",
    name: "recommended-monitor-maintain-airway",
    title: "Recommended Monitoring and Maintaining the Airway",
    description: "Recommended monitoring and maintaining the airway.",
    critical: true,
    acceptedConcepts: ["airway monitoring", "maintain airway", "secure airway"],
  }),
  recommendation({
    id: "C1-MP-002",
    name: "recommended-omfs-consult",
    title: "Recommended OMFS or Surgical Consultation",
    description: "Recommended consultation with OMFS or a surgeon.",
    critical: true,
    acceptedConcepts: ["OMFS consult", "oral surgery consult", "surgical consultation"],
  }),
  recommendation({
    id: "C1-MP-003",
    name: "recommended-iv-antibiotics",
    title: "Recommended IV Antibiotics",
    description: "Recommended IV antibiotics for suspected deep space infection.",
    critical: true,
    acceptedConcepts: ["IV antibiotics", "intravenous antibiotics"],
  }),
  recommendation({
    id: "C1-MP-004",
    name: "selected-appropriate-iv-antibiotic",
    title: "Selected an Appropriate IV Antibiotic",
    description:
      "Selected an appropriate IV antibiotic or accepted allergy-adjusted alternative.",
    critical: true,
    acceptedConcepts: ["ampicillin-sulbactam", "clindamycin", "allergy alternative"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  recommendation({
    id: "C1-MP-005",
    name: "recommended-ct-with-iv-contrast",
    title: "Recommended CT With IV Contrast",
    description: "Recommended CT imaging with IV contrast.",
    critical: true,
    acceptedConcepts: ["CT with IV contrast", "contrast CT"],
  }),
  recommendation({
    id: "C1-MP-006",
    name: "recommended-systemic-analgesia",
    title: "Recommended Systemic Analgesia",
    description: "Recommended systemic analgesia for pain control.",
    acceptedConcepts: ["systemic analgesia", "pain control", "analgesics"],
  }),
  recommendation({
    id: "C1-MP-007",
    name: "considered-npo-or-operating-room",
    title: "Considered NPO or Operating Room Management",
    description: "Considered NPO status and/or operating room management.",
    acceptedConcepts: ["NPO", "operating room", "OR management"],
  }),
  reviewedAvailableExamination({ id: "C1-EX-001" }),
];

const case02Criteria: FacultyRubricCriterion[] = [
  shared("askedAboutFever", {
    id: "C2-IG-001",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  shared("askedAboutPenicillinAllergy", {
    id: "C2-IG-002",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["allergies"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("askedAboutColdPain", {
    id: "C2-IG-003",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-1"],
  }),
  shared("askedAboutLingeringColdPain", {
    id: "C2-IG-004",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-1"],
  }),
  shared("askedAboutBitingPain", {
    id: "C2-IG-005",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["biting-pain"],
    legacyClinicalChecklistIds: ["clinical-1"],
  }),
  shared("askedAboutHomeMedicationUse", {
    id: "C2-IG-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["medications"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("offeredDentalAnesthesia", {
    id: "C2-PC-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedTemporaryPainRelief", {
    id: "C2-PC-002",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  criterion({
    id: "C2-PC-003",
    name: "explained-antibiotics-do-not-resolve-source",
    title: "Explained Antibiotics Do Not Resolve the Tooth Source",
    description:
      "Explained that antibiotics already received will not resolve the underlying dental source.",
    competency: "patient-communication",
    evaluationMode: "patient-education",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["antibiotics do not fix the tooth", "source control"],
    reportLabel: "Explained the limits of antibiotics without dental source control",
  }),
  criterion({
    id: "C2-CF-001",
    name: "airway-compromise-none-expected",
    title: "No Airway-Compromise Findings Expected",
    description:
      "Expected case state is none of the listed airway-compromise findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No airway compromise expected in the case state",
  }),
  finding({
    id: "C2-CF-002",
    name: "elicited-fever",
    title: "Elicited Fever",
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  finding({
    id: "C2-CF-003",
    name: "elicited-facial-swelling",
    title: "Elicited Facial Swelling",
    legacyPatientChecklistIds: ["swelling"],
    legacyClinicalChecklistIds: ["clinical-3"],
  }),
  finding({
    id: "C2-CF-004",
    name: "elicited-tachycardia-over-100",
    title: "Elicited Tachycardia Greater Than 100 BPM",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  finding({
    id: "C2-CF-005",
    name: "elicited-sirs-criteria",
    title: "Elicited SIRS Criteria",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  interpretation({
    id: "C2-CI-001",
    name: "recognized-emergency-urgency",
    title: "Recognized Emergency-Level Urgency",
    description: "Recognized the case as emergency-level urgency.",
    expectedValue: "emergency",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-5"],
  }),
  recommendation({
    id: "C2-MP-001",
    name: "recommended-omfs-admission-consult",
    title: "Recommended OMFS or Surgical Admission Consultation",
    description: "Recommended OMFS or surgeon consultation for admission.",
    critical: true,
  }),
  recommendation({
    id: "C2-MP-002",
    name: "recommended-cbc-bmp",
    title: "Recommended CBC and BMP",
    description: "Recommended CBC and BMP laboratory evaluation.",
    acceptedConcepts: ["CBC", "BMP", "basic metabolic panel"],
  }),
  recommendation({
    id: "C2-MP-003",
    name: "recommended-iv-antibiotics",
    title: "Recommended IV Antibiotics",
    description:
      "Recommended IV antibiotics because systemic infection and swelling make oral-only treatment insufficient.",
    critical: true,
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  recommendation({
    id: "C2-MP-004",
    name: "selected-appropriate-iv-antibiotic",
    title: "Selected an Appropriate IV Antibiotic",
    description:
      "Selected an appropriate IV antibiotic or accepted allergy-adjusted alternative.",
    critical: true,
    acceptedConcepts: ["ampicillin-sulbactam", "clindamycin", "allergy alternative"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  recommendation({
    id: "C2-MP-005",
    name: "recommended-ct-with-iv-contrast",
    title: "Recommended CT With IV Contrast",
    description: "Recommended CT with IV contrast.",
    critical: true,
  }),
  recommendation({
    id: "C2-MP-006",
    name: "recommended-systemic-analgesia",
    title: "Recommended Systemic Analgesia",
    description: "Recommended systemic analgesia.",
  }),
  reviewedAvailableExamination({ id: "C2-EX-001" }),
];

const case03Criteria: FacultyRubricCriterion[] = [
  shared("askedAboutFever", {
    id: "C3-IG-001",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-3"],
  }),
  shared("askedAboutPenicillinAllergy", {
    id: "C3-IG-002",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["allergies"],
  }),
  shared("askedAboutColdPain", {
    id: "C3-IG-003",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedAboutLingeringColdPain", {
    id: "C3-IG-004",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedAboutBitingPain", {
    id: "C3-IG-005",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["biting-pain"],
  }),
  shared("askedAboutHomeMedicationUse", {
    id: "C3-IG-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["medications"],
  }),
  shared("offeredDentalAnesthesia", {
    id: "C3-PC-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedTemporaryPainRelief", {
    id: "C3-PC-002",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  recommendation({
    id: "C3-MP-001",
    name: "offered-incision-and-drainage",
    title: "Offered Incision and Drainage",
    description: "Offered incision and drainage of the abscess to relieve pain.",
    acceptedConcepts: ["incision and drainage", "drain the abscess", "I and D"],
  }),
  recommendation({
    id: "C3-MP-002",
    name: "recommended-ibuprofen",
    title: "Recommended Ibuprofen",
    description: "Recommended ibuprofen for pain control when appropriate.",
    acceptedConcepts: ["ibuprofen", "NSAID"],
  }),
  shared("recommendedPromptDentalFollowUp", {
    id: "C3-MP-003",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  criterion({
    id: "C3-CF-001",
    name: "airway-compromise-none-expected",
    title: "No Airway-Compromise Findings Expected",
    description:
      "Expected case state is none of the listed airway-compromise findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No airway compromise expected in the case state",
  }),
  finding({
    id: "C3-CF-002",
    name: "elicited-intraoral-abscess",
    title: "Elicited Intraoral Abscess",
    legacyClinicalChecklistIds: ["clinical-5"],
    acceptedConcepts: ["intraoral abscess", "localized abscess"],
  }),
  criterion({
    id: "C3-CF-003",
    name: "clinical-instability-none-expected",
    title: "No Clinical Instability Expected",
    description:
      "Expected case state is none of the listed clinical instability findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No clinical instability expected in the case state",
  }),
  interpretation({
    id: "C3-CI-001",
    name: "recognized-urgent-case",
    title: "Recognized Urgent Case",
    description: "Recognized the case as urgent rather than routine.",
    expectedValue: "urgent",
  }),
  interpretation({
    id: "C3-CI-002",
    name: "recognized-local-intraoral-abscess",
    title: "Recognized Local Intraoral Abscess",
    description: "Recognized that a local intraoral abscess is present.",
    expectedValue: true,
    legacyClinicalChecklistIds: ["clinical-5"],
  }),
  interpretation({
    id: "C3-CI-003",
    name: "recognized-ct-not-recommended",
    title: "Recognized CT Is Not Recommended",
    description: "Recognized that CT is not recommended when a local intraoral abscess is present.",
    expectedValue: true,
  }),
  criterion({
    id: "C3-PD-001",
    name: "rejected-inferior-alveolar-block",
    title: "Rejected Inferior Alveolar Nerve Block for Mandibular Teeth",
    description: "Selected no inferior alveolar nerve block for the maxillary case context.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    expectedValue: false,
    source: "faculty-clinical-checklist",
    reportLabel: "Selected the appropriate anesthesia approach for tooth location",
  }),
  criterion({
    id: "C3-PD-002",
    name: "selected-maxillary-infiltration",
    title: "Selected Infiltration Anesthesia for Maxillary Teeth",
    description: "Selected infiltration anesthesia for maxillary teeth.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    expectedValue: true,
    source: "faculty-clinical-checklist",
    reportLabel: "Selected maxillary infiltration anesthesia",
  }),
  criterion({
    id: "C3-PD-003",
    name: "selected-recommended-local-anesthetic-concept",
    title: "Selected Recommended Local Anesthetic Concept",
    description:
      "Represented the faculty-source anesthetic formulation as an accepted supporting concept pending scoring calibration.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: [
      "2% lidocaine with 1:100,000 epinephrine",
      "0.5% bupivacaine with 1:200,000 epinephrine",
    ],
    reportLabel: "Chose an appropriate local anesthetic strategy",
    facultyNotes:
      "Faculty should confirm whether exact formulation is a scored criterion or supporting concept.",
  }),
  reviewedAvailableExamination({ id: "C3-EX-001" }),
];

const case04Criteria: FacultyRubricCriterion[] = [
  shared("askedAboutFever", {
    id: "C4-IG-001",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  shared("askedAboutPenicillinAllergy", {
    id: "C4-IG-002",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["allergies"],
  }),
  shared("askedAboutColdPain", {
    id: "C4-IG-003",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("askedAboutLingeringColdPain", {
    id: "C4-IG-004",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("askedAboutBitingPain", {
    id: "C4-IG-005",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["biting-pain"],
    legacyClinicalChecklistIds: ["clinical-1"],
  }),
  shared("askedAboutHomeMedicationUse", {
    id: "C4-IG-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["medications"],
  }),
  shared("offeredDentalAnesthesia", {
    id: "C4-PC-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedTemporaryPainRelief", {
    id: "C4-PC-002",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedAntibioticsNotIndicated", {
    id: "C4-PC-003",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  criterion({
    id: "C4-PC-004",
    name: "explained-when-antibiotics-indicated",
    title: "Explained When Antibiotics Would Become Indicated",
    description:
      "Explained that antibiotics become indicated with swelling, systemic illness, spreading infection, or related infection signs.",
    competency: "patient-communication",
    evaluationMode: "patient-education",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: ["fever", "swelling", "spreading infection", "systemic illness"],
    reportLabel: "Explained when antibiotics would become indicated",
  }),
  shared("recommendedPromptDentalFollowUp", {
    id: "C4-MP-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedAboutDentalFollowUpAccess", {
    id: "C4-PC-005",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedWhetherPatientWantsToSaveTooth", {
    id: "C4-PC-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["patient-goals"],
  }),
  criterion({
    id: "C4-CF-001",
    name: "airway-compromise-none-expected",
    title: "No Airway-Compromise Findings Expected",
    description:
      "Expected case state is none of the listed airway-compromise findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No airway compromise expected in the case state",
  }),
  criterion({
    id: "C4-CF-002",
    name: "systemic-infection-none-expected",
    title: "No Systemic Infection or Abscess Findings Expected",
    description:
      "Expected case state is none of the listed systemic infection or abscess findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No systemic infection or abscess expected in the case state",
  }),
  finding({
    id: "C4-CF-003",
    name: "elicited-spontaneous-unprovoked-pain",
    title: "Elicited Spontaneous Unprovoked Pain",
    legacyClinicalChecklistIds: ["clinical-4"],
    acceptedConcepts: ["spontaneous pain", "unprovoked pain"],
  }),
  interpretation({
    id: "C4-CI-001",
    name: "recognized-urgent-case",
    title: "Recognized Urgent Case",
    description: "Recognized the case as urgent.",
    expectedValue: "urgent",
  }),
  interpretation({
    id: "C4-CI-002",
    name: "recognized-necrotic-pulp",
    title: "Recognized Necrotic Pulp",
    description: "Recognized necrotic pulp as the expected interpretation.",
    expectedValue: "necrotic pulp",
    legacyClinicalChecklistIds: ["clinical-5"],
  }),
  interpretation({
    id: "C4-CI-003",
    name: "recognized-cold-pain-not-lingering",
    title: "Recognized Cold Pain Is Not Exaggerated or Lingering",
    description: "Recognized that exaggerated or lingering cold pain is not expected.",
    expectedValue: false,
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  interpretation({
    id: "C4-CI-004",
    name: "recognized-percussion-pain",
    title: "Recognized Pain With Tapping or Percussion",
    description: "Recognized pain with tapping or percussion.",
    expectedValue: true,
    legacyClinicalChecklistIds: ["clinical-1"],
  }),
  criterion({
    id: "C4-PD-001",
    name: "selected-maxillary-infiltration-if-supported",
    title: "Selected Maxillary Infiltration When Supported",
    description:
      "Encoded the faculty-source maxillary infiltration choice as provisional because the repository case data must confirm the tooth-location assumption before active scoring.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    source: "faculty-clinical-checklist",
    expectedValue: true,
    reportLabel: "Selected the tooth-location appropriate anesthetic approach",
    facultyNotes:
      "Faculty/source clarification needed before this becomes active scoring.",
  }),
  reviewedAvailableExamination({ id: "C4-EX-001" }),
];

const case05Criteria: FacultyRubricCriterion[] = [
  shared("askedAboutFever", {
    id: "C5-IG-001",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["systemic-symptoms"],
    legacyClinicalChecklistIds: ["clinical-3"],
  }),
  shared("askedAboutPenicillinAllergy", {
    id: "C5-IG-002",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["allergies"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("askedAboutColdPain", {
    id: "C5-IG-003",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  shared("askedAboutLingeringColdPain", {
    id: "C5-IG-004",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["thermal-sensitivity"],
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  shared("askedAboutBitingPain", {
    id: "C5-IG-005",
    weight: 1,
    critical: false,
    provisionalWeight: true,
    facultyNotes: "No clear legacy Case 5 biting-pain checklist item exists.",
  }),
  shared("askedAboutHomeMedicationUse", {
    id: "C5-IG-006",
    weight: 1,
    critical: false,
    legacyPatientChecklistIds: ["medications"],
    legacyClinicalChecklistIds: ["clinical-4"],
  }),
  shared("offeredDentalAnesthesia", {
    id: "C5-PC-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedTemporaryPainRelief", {
    id: "C5-PC-002",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("explainedAntibioticsNotIndicated", {
    id: "C5-PC-003",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("recommendedPromptDentalFollowUp", {
    id: "C5-MP-001",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedAboutDentalFollowUpAccess", {
    id: "C5-PC-004",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  shared("askedWhetherPatientWantsToSaveTooth", {
    id: "C5-PC-005",
    weight: 1,
    critical: false,
    provisionalWeight: true,
  }),
  criterion({
    id: "C5-CF-001",
    name: "airway-compromise-none-expected",
    title: "No Airway-Compromise Findings Expected",
    description:
      "Expected case state is none of the listed airway-compromise findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No airway compromise expected in the case state",
  }),
  criterion({
    id: "C5-CF-002",
    name: "systemic-infection-none-expected",
    title: "No Systemic Infection or Abscess Findings Expected",
    description:
      "Expected case state is none of the listed systemic infection or abscess findings; no active rule-out is required.",
    competency: "clinical-findings",
    evaluationMode: "case-state",
    expectation: "expected-case-state",
    weight: 0,
    source: "faculty-clinical-checklist",
    expectedValue: "none-of-the-above",
    reportLabel: "No systemic infection or abscess expected in the case state",
  }),
  finding({
    id: "C5-CF-003",
    name: "elicited-throbbing-pain",
    title: "Elicited Throbbing Pain",
    legacyPatientChecklistIds: ["pain-character"],
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["throbbing pain"],
  }),
  finding({
    id: "C5-CF-004",
    name: "elicited-spontaneous-unprovoked-pain",
    title: "Elicited Spontaneous Unprovoked Pain",
    legacyPatientChecklistIds: ["pain-character"],
    legacyClinicalChecklistIds: ["clinical-1"],
    acceptedConcepts: ["spontaneous pain", "unprovoked pain", "night pain"],
  }),
  interpretation({
    id: "C5-CI-001",
    name: "recognized-urgent-case",
    title: "Recognized Urgent Case",
    description: "Recognized the case as urgent.",
    expectedValue: "urgent",
  }),
  interpretation({
    id: "C5-CI-002",
    name: "recognized-irreversible-pulpitis",
    title: "Recognized Irreversible Pulpitis",
    description: "Recognized irreversible pulpitis as the expected interpretation.",
    expectedValue: "irreversible pulpitis",
    legacyClinicalChecklistIds: ["clinical-5"],
  }),
  interpretation({
    id: "C5-CI-003",
    name: "recognized-lingering-cold-pain",
    title: "Recognized Cold Pain Is Exaggerated or Lingering",
    description: "Recognized exaggerated or lingering cold pain.",
    expectedValue: true,
    legacyClinicalChecklistIds: ["clinical-2"],
  }),
  interpretation({
    id: "C5-CI-004",
    name: "recognized-ct-not-recommended",
    title: "Recognized CT Is Not Recommended",
    description: "Recognized that CT is not recommended.",
    expectedValue: true,
  }),
  interpretation({
    id: "C5-CI-005",
    name: "recognized-antibiotics-not-recommended",
    title: "Recognized Antibiotics Are Not Recommended",
    description: "Recognized that antibiotics are not recommended.",
    expectedValue: true,
  }),
  criterion({
    id: "C5-PD-001",
    name: "selected-inferior-alveolar-block",
    title: "Selected Inferior Alveolar Nerve Block",
    description: "Selected inferior alveolar nerve block for mandibular teeth.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    source: "faculty-clinical-checklist",
    expectedValue: true,
    reportLabel: "Selected the mandibular block approach",
  }),
  criterion({
    id: "C5-PD-002",
    name: "selected-recommended-local-anesthetic-concept",
    title: "Selected Recommended Local Anesthetic Concept",
    description:
      "Represented the faculty-source anesthetic formulation as an accepted supporting concept pending scoring calibration.",
    competency: "procedural-decision",
    evaluationMode: "procedural-choice",
    expectation: "required",
    source: "faculty-clinical-checklist",
    acceptedConcepts: [
      "2% lidocaine with 1:100,000 epinephrine",
      "0.5% bupivacaine with 1:200,000 epinephrine",
    ],
    reportLabel: "Chose an appropriate local anesthetic strategy",
    facultyNotes:
      "Faculty should confirm whether exact formulation is a scored criterion or supporting concept.",
  }),
  reviewedAvailableExamination({ id: "C5-EX-001" }),
];

export const facultyRubrics = [
  {
    caseId: "case-01",
    title: "Facial Swelling with Airway Risk",
    criteria: case01Criteria,
  },
  {
    caseId: "case-02",
    title: "Severe Tooth Pain with Facial Swelling",
    criteria: case02Criteria,
  },
  {
    caseId: "case-03",
    title: "Periodontal Swelling in a Patient with Diabetes",
    criteria: case03Criteria,
  },
  {
    caseId: "case-04",
    title: "Pain When Biting After a Large Restoration",
    criteria: case04Criteria,
  },
  {
    caseId: "case-05",
    title: "Persistent Toothache with Temperature Sensitivity",
    criteria: case05Criteria,
  },
] satisfies FacultyRubric[];
