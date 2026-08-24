import assert from "node:assert/strict";

import { case3ConsentResponse } from "../src/lib/case3ConsentResponse";
import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import type { PatientQuestionEvidenceAlias } from "../src/lib/patientQuestions/prompt";
import { parsePatientQuestionClassification } from "../src/lib/patientQuestions/schema";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import {
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  createEmptyPatientQuestionState,
} from "../src/lib/patientQuestions/types";

function classify(provider: string, confidence = 0.99, alias = "student-current") {
  const evidenceAliases: PatientQuestionEvidenceAlias[] = [
    { alias, messageId: `${alias}-id`, role: "student", content: provider },
    { alias: "patient-draft", messageId: "patient-draft-id", role: "patient", content: "Okay." },
  ];
  return parsePatientQuestionClassification({
    text: JSON.stringify({
      schemaVersion: 1,
      caseId: "case-03",
      events: { temporaryTreatmentActive: true },
      confidence,
      evidence: [alias],
    }),
    caseId: "case-03",
    studentMessageId: "student-current-id",
    allowedEvents: ["temporaryTreatmentActive"],
    evidenceAliases,
  });
}

const positiveEvidence = [
  "I recommend antibiotic treatment.",
  "I will prescribe antibiotics.",
  "I ordered antibiotic therapy.",
  "I administered the antibiotic.",
  "We will start antimicrobial therapy.",
  "I offer a local anesthetic for the procedure.",
  "I will administer local anesthesia.",
  "We plan to perform a nerve block.",
  "I will perform a mandibular block.",
  "I am going to perform an inferior alveolar nerve block.",
  "I recommend I&D of the abscess.",
  "The plan is to perform incision and drainage.",
  "I performed incision and drainage of the abscess.",
  "I offer to drain the abscess and relieve the pressure.",
  "I recommend acetaminophen for temporary pain relief.",
];
for (const provider of positiveEvidence) {
  const parsed = classify(provider);
  assert.equal(parsed.success, true, provider);
  assert(parsed.success);
  const transition = applyPatientQuestionClassification({
    caseId: "case-03",
    classification: parsed.classification,
  });
  assert.equal(transition.selectedQuestionId, "c3-follow-up-needed-question", provider);
}

const negativeEvidence = [
  "We will not do a CT.",
  "We reviewed the CT imaging, X-ray, and scan.",
  "The diagnosis is a periapical abscess.",
  "I will order labs and perform an examination.",
  "Do not worry; you will be okay.",
  "I will refer you to your dentist.",
  "We will discuss disposition and discharge.",
  "What medications do you take?",
  "Are you allergic to antibiotics?",
  "Have you taken antibiotics before?",
  "You received antibiotics yesterday.",
  "We might consider antibiotics later.",
  "If the infection worsens, I could prescribe antibiotics.",
  "I am considering a nerve block.",
  "I will not prescribe antibiotics.",
  "You declined the nerve block.",
  "Incision and drainage is not indicated.",
  "Antibiotics are not recommended and unnecessary.",
  "You will need a future extraction.",
  "A root canal is the definitive treatment.",
  "We will start treatment now.",
];
for (const provider of negativeEvidence) {
  const parsed = classify(provider);
  assert.equal(parsed.success, false, provider);
  assert.equal(parsed.success ? undefined : parsed.reason, "incompatible-evidence-semantics", provider);
  const empty = createEmptyPatientQuestionState();
  assert.equal(empty.detectedEvents.temporaryTreatmentActive, false, provider);
}

const prior = classify("I will prescribe antibiotics.", 0.99, "student-prior-1");
assert(prior.success);
const first = applyPatientQuestionClassification({ caseId: "case-03", classification: prior.classification });
assert.equal(first.selectedQuestionId, "c3-follow-up-needed-question");
const repeated = applyPatientQuestionClassification({
  caseId: "case-03",
  state: first.state,
  classification: prior.classification,
});
assert.equal(repeated.selectedQuestionId, undefined);

const why = applyPatientQuestionClassification({
  caseId: "case-03",
  state: first.state,
  classification: {
    schemaVersion: 1,
    caseId: "case-03",
    analyzedStudentMessageId: "student-why",
    detectedEvents: {
      promptDentalFollowUpConfirmed: true,
      drainageTemporaryOrNondefinitiveExplained: false,
      definitiveDentalTreatmentExplained: false,
    },
    confidence: 0.99,
    evidenceAliases: ["student-current"],
    evidenceMessageIds: ["student-why"],
  },
});
assert.equal(why.selectedQuestionId, "c3-follow-up-why");

assert.equal(PATIENT_QUESTION_CONFIDENCE_THRESHOLD, 0.85);
assert.equal(classify(positiveEvidence[0], 0.849).success, false);
assert.equal(getPatientQuestion("c3-follow-up-needed-question")?.id, "c3-follow-up-needed-question");
assert.equal(
  getPatientQuestion("c3-follow-up-needed-question")?.text,
  "Even with this treatment, do I still need to see my dentist soon?",
);
assert.equal(
  case3ConsentResponse("case-03", "I recommend an I&D to drain the infection and relieve the pressure. Is that okay?"),
  "Yes, that’s okay.",
);

const noAgreement = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: prior.classification,
});
assert.equal(noAgreement.selectedQuestionId, "c3-follow-up-needed-question");
assert.equal(createEmptyPatientQuestionState().detectedEvents.patientAgreedToIncisionAndDrainage, false);

console.log("Case 3 temporary-treatment question validation passed.");
