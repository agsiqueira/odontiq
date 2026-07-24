import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import {
  CASE_3_CONSENT_RESPONSE,
  case3ConsentResponse,
  isTreatmentConsentRequest,
} from "../src/lib/case3ConsentResponse";
import {
  buildPatientDisclosureState,
  classifyProviderMessageIntent,
} from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import { classifyPatientQuestionTrigger } from "../src/lib/patientQuestions/classifier";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import {
  createEmptyPatientQuestionState,
  type PatientQuestionClassification,
  type PatientQuestionEvents,
} from "../src/lib/patientQuestions/types";

const case3 = loadCase("case-03");
assert(case3);

const positiveMessages = [
  "You have an abscess. I'd like to numb the area, make a small opening, and let the infection drain. Is that okay?",
  "You have an abscess. I’d like to numb the area, make a small opening, and let the infection drain. Is that okay?",
  "You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?",
  "I’d like to numb the area and drain the abscess so the pressure can be released. Do you agree?",
  "We need to make a small opening and allow the pus to drain. Are you comfortable proceeding?",
] as const;

for (const message of positiveMessages) {
  assert.equal(isTreatmentConsentRequest(message), true, message);
  assert.equal(classifyProviderMessageIntent(message), "treatment_consent", message);
  assert.equal(case3ConsentResponse("case-03", message), CASE_3_CONSENT_RESPONSE, message);
  const state = buildPatientDisclosureState({
    caseData: case3,
    conversation: [],
    latestStudentMessage: message,
  });
  assert.equal(state.providerMessageIntent, "treatment_consent", message);
  assert.deepEqual(state.allowedThisTurn, [], message);
  const response = patientImmediateResponse({
    caseId: "case-03",
    message,
    disclosureState: state,
  });
  assert.equal(response, CASE_3_CONSENT_RESPONSE, message);
  assert.equal(assessPatientOutputIntegrity(response!, []).valid, true, message);
}

const negativeMessages = [
  "We should do an I&D.",
  "We may need to consider drainage later.",
  "I'm going to numb the area. Is that okay?",
  "We should start antibiotics. Do you agree?",
  "We need to obtain an x-ray. Is that okay?",
  "We need to admit you to the hospital. Do you agree?",
  "We should perform an unrelated procedure. Is that okay?",
  "Have you ever had an abscess drained?",
  "You have an abscess. I recommend making a small opening to drain the infection.",
] as const;

for (const message of negativeMessages) {
  assert.equal(case3ConsentResponse("case-03", message), undefined, message);
  const state = buildPatientDisclosureState({
    caseData: case3,
    conversation: [],
    latestStudentMessage: message,
  });
  assert.equal(
    patientImmediateResponse({ caseId: "case-03", message, disclosureState: state }),
    undefined,
    message,
  );
}

for (const caseId of ["case-01", "case-02", "case-04", "case-05"]) {
  assert.equal(case3ConsentResponse(caseId, positiveMessages[0]), undefined, caseId);
}

assert.equal(
  case3ConsentResponse("case-03", positiveMessages[0]),
  case3ConsentResponse("case-03", positiveMessages[1]),
  "Straight and curly apostrophes must produce equivalent consent behavior.",
);

function classification(events: Partial<PatientQuestionEvents>): PatientQuestionClassification {
  return {
    schemaVersion: 1,
    caseId: "case-03",
    analyzedStudentMessageId: "student-current-id",
    detectedEvents: events,
    confidence: 0.99,
    evidenceAliases: ["student-current", "patient-draft"],
    evidenceMessageIds: ["student-current-id", "patient-draft-id"],
  };
}

const clearProposal = positiveMessages[1];
const draftAgreement = case3ConsentResponse("case-03", clearProposal);
assert.equal(draftAgreement, "Yes, that’s okay.");
const classified = await classifyPatientQuestionTrigger({
  provider: {
    name: "case-03-consent-validator",
    generateConversationResponse: async () => ({ text: "unused" }),
    generateText: async ({ messages }) => {
      assert(messages[0]?.content.includes(clearProposal));
      assert(messages[0]?.content.includes(draftAgreement));
      return {
        text: JSON.stringify({
          schemaVersion: 1,
          caseId: "case-03",
          events: {
            incisionAndDrainageProposed: true,
            patientAgreedToIncisionAndDrainage: true,
          },
          confidence: 0.99,
          evidence: ["student-current", "patient-draft"],
        }),
      };
    },
  },
  caseId: "case-03",
  studentMessageId: "student-current-id",
  studentMessage: clearProposal,
  draftPatientMessageId: "patient-draft-id",
  draftPatientResponse: draftAgreement,
  conversation: [],
  state: createEmptyPatientQuestionState(),
});
assert(classified.success);

const initial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: classified.classification,
});
assert.equal(initial.state.version, 1);
assert.equal(initial.selectedQuestionId, "c3-follow-up-needed-question");
const initialQuestion = getPatientQuestion(initial.selectedQuestionId!)?.text;
assert.equal(initialQuestion, "Since I am going to do this, do I still need to see my dentist soon?");
assert.equal(
  `${draftAgreement} ${initialQuestion}`,
  "Yes, that’s okay. Since I am going to do this, do I still need to see my dentist soon?",
);

const repeat = applyPatientQuestionClassification({
  caseId: "case-03",
  state: initial.state,
  classification: classified.classification,
});
assert.equal(repeat.selectedQuestionId, undefined);

const resumedState = JSON.parse(JSON.stringify(initial.state));
const afterResume = applyPatientQuestionClassification({
  caseId: "case-03",
  state: resumedState,
  classification: classified.classification,
});
assert.equal(afterResume.selectedQuestionId, undefined);

const why = applyPatientQuestionClassification({
  caseId: "case-03",
  state: initial.state,
  classification: classification({
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: false,
    definitiveDentalTreatmentExplained: false,
  }),
});
assert.equal(why.selectedQuestionId, "c3-follow-up-why");
assert.equal(getPatientQuestion(why.selectedQuestionId!)?.text, "Why?");

const whyRepeat = applyPatientQuestionClassification({
  caseId: "case-03",
  state: why.state,
  classification: classification({ promptDentalFollowUpConfirmed: true }),
});
assert.equal(whyRepeat.selectedQuestionId, undefined);

const completeExplanation = applyPatientQuestionClassification({
  caseId: "case-03",
  state: initial.state,
  classification: classification({
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true,
    definitiveDentalTreatmentExplained: true,
  }),
});
assert.equal(completeExplanation.selectedQuestionId, undefined);

console.log(
  `Case 3 consent-response validation passed (${positiveMessages.length} positive messages, ${negativeMessages.length} boundaries, full question sequence, once-only, and resume persistence).`,
);
