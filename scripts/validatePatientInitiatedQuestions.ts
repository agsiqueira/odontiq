import assert from "node:assert/strict";

import { PATIENT_QUESTION_CATALOG, getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import { parsePatientQuestionClassification } from "../src/lib/patientQuestions/schema";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { SAFE_PATIENT_BASE_RESPONSE_FALLBACK } from "../src/lib/patientRoleGuard";
import {
  EMPTY_PATIENT_QUESTION_EVENTS,
  createEmptyPatientQuestionState,
  type PatientQuestionClassification,
  type PatientQuestionEvents,
  type PatientQuestionId,
  type PatientQuestionState,
} from "../src/lib/patientQuestions/types";

const expectedText: Record<PatientQuestionId, string> = {
  "c1-extraction-question": "Will they pull out the bad tooth?",
  "c2-antibiotic-effect-question": "Will the antibiotic make the tooth better?",
  "c3-follow-up-needed-question": "Since I am going to do this, do I still need to see my dentist soon?",
  "c3-follow-up-why": "Why?",
  "c4-antibiotic-needed-question": "Do I need an antibiotic?",
  "c5-antibiotic-request": "Can I get an antibiotic? It has helped in the past when I had a toothache.",
};
assert.equal(PATIENT_QUESTION_CATALOG.length, 6);
for (const [id, text] of Object.entries(expectedText)) {
  assert.equal(getPatientQuestion(id as PatientQuestionId)?.text, text);
}

function classification(
  caseId: string,
  id: PatientQuestionId | null,
  events: Partial<PatientQuestionEvents>,
  confidence = 0.95,
): PatientQuestionClassification {
  return {
    schemaVersion: 1,
    caseId,
    analyzedStudentMessageId: "student-1",
    detectedEvents: { ...EMPTY_PATIENT_QUESTION_EVENTS, ...events },
    eligibleQuestionId: id,
    confidence,
    evidenceMessageIds: ["student-1"],
  };
}

const simpleCases: Array<{
  caseId: string;
  id: PatientQuestionId;
  events: Partial<PatientQuestionEvents>;
}> = [
  {
    caseId: "case-01",
    id: "c1-extraction-question",
    events: { hospitalAdmissionOrSurgicalManagementDiscussed: true },
  },
  {
    caseId: "case-02",
    id: "c2-antibiotic-effect-question",
    events: { antibioticsRecommendedAsCurrentPlan: true },
  },
  {
    caseId: "case-04",
    id: "c4-antibiotic-needed-question",
    events: { painManagementOrDispositionDiscussed: true },
  },
  {
    caseId: "case-05",
    id: "c5-antibiotic-request",
    events: { patientPainDescribed: true },
  },
];

for (const test of simpleCases) {
  const first = applyPatientQuestionClassification({
    caseId: test.caseId,
    classification: classification(test.caseId, test.id, test.events),
  });
  assert.equal(first.selectedQuestionId, test.id);
  const repeated = applyPatientQuestionClassification({
    caseId: test.caseId,
    state: first.state,
    classification: classification(test.caseId, test.id, test.events),
  });
  assert.equal(repeated.selectedQuestionId, undefined, `${test.id} must be once-only`);
}

const c4Suppressed = applyPatientQuestionClassification({
  caseId: "case-04",
  classification: classification("case-04", "c4-antibiotic-needed-question", {
    painManagementOrDispositionDiscussed: true,
    antibioticsNotIndicatedExplained: true,
  }),
});
assert.equal(c4Suppressed.selectedQuestionId, undefined);

const c5Insufficient = applyPatientQuestionClassification({
  caseId: "case-05",
  classification: classification("case-05", null, { patientPainDescribed: false }),
});
assert.equal(c5Insufficient.selectedQuestionId, undefined);

const c3Initial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: classification("case-03", "c3-follow-up-needed-question", {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  }),
});
assert.equal(c3Initial.selectedQuestionId, "c3-follow-up-needed-question");

const whyWithoutInitial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: classification("case-03", "c3-follow-up-why", {
    promptDentalFollowUpConfirmed: true,
  }),
});
assert.equal(whyWithoutInitial.selectedQuestionId, undefined);

const whyIncomplete = applyPatientQuestionClassification({
  caseId: "case-03",
  state: c3Initial.state,
  classification: classification("case-03", "c3-follow-up-why", {
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true,
    definitiveDentalTreatmentExplained: false,
  }),
});
assert.equal(whyIncomplete.selectedQuestionId, "c3-follow-up-why");

const c3StateForComplete: PatientQuestionState = {
  ...c3Initial.state,
  detectedEvents: { ...EMPTY_PATIENT_QUESTION_EVENTS },
};
const whyComplete = applyPatientQuestionClassification({
  caseId: "case-03",
  state: c3StateForComplete,
  classification: classification("case-03", "c3-follow-up-why", {
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true,
    definitiveDentalTreatmentExplained: true,
  }),
});
assert.equal(whyComplete.selectedQuestionId, undefined);

const validJson = JSON.stringify(classification("case-02", "c2-antibiotic-effect-question", {
  antibioticsRecommendedAsCurrentPlan: true,
}));
assert(parsePatientQuestionClassification({
  text: validJson,
  caseId: "case-02",
  studentMessageId: "student-1",
  validMessageIds: ["student-1"],
}));
assert.equal(parsePatientQuestionClassification({
  text: "{bad",
  caseId: "case-02",
  studentMessageId: "student-1",
  validMessageIds: ["student-1"],
}), undefined);
assert.equal(parsePatientQuestionClassification({
  text: JSON.stringify(classification("case-02", "c2-antibiotic-effect-question", {
    antibioticsRecommendedAsCurrentPlan: true,
  }, 0.4)),
  caseId: "case-02",
  studentMessageId: "student-1",
  validMessageIds: ["student-1"],
}), undefined);
assert.equal(parsePatientQuestionClassification({
  text: JSON.stringify({
    ...classification("case-02", "c2-antibiotic-effect-question", {
      antibioticsRecommendedAsCurrentPlan: true,
    }),
    evidenceMessageIds: ["invented"],
  }),
  caseId: "case-02",
  studentMessageId: "student-1",
  validMessageIds: ["student-1"],
}), undefined);

assert.deepEqual(createEmptyPatientQuestionState().emittedQuestionIds, []);
const inventedQuestion = await generatePatientRoleSafeResponse({
  initialOutput: "Okay. Is the medicine safe?",
  retry: async () => "All right. What happens next?",
  allowPatientInitiatedQuestion: false,
});
assert.equal(inventedQuestion.text, SAFE_PATIENT_BASE_RESPONSE_FALLBACK);
console.log("Patient-initiated question validation passed.");
