import assert from "node:assert/strict";

import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import type { PatientQuestionEvidenceAlias } from "../src/lib/patientQuestions/prompt";
import { parsePatientQuestionClassification } from "../src/lib/patientQuestions/schema";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import {
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  createEmptyPatientQuestionState,
} from "../src/lib/patientQuestions/types";

const events = ["incisionAndDrainageProposed", "patientAgreedToIncisionAndDrainage"] as const;

function parse(
  evidenceAliases: PatientQuestionEvidenceAlias[],
  detectedEvents: Record<(typeof events)[number], boolean>,
  evidence = evidenceAliases.map((entry) => entry.alias),
  confidence = 0.99,
) {
  return parsePatientQuestionClassification({
    text: JSON.stringify({
      schemaVersion: 1,
      caseId: "case-03",
      events: detectedEvents,
      confidence,
      evidence,
    }),
    caseId: "case-03",
    studentMessageId: "student-current-id",
    allowedEvents: events,
    evidenceAliases,
  });
}

function aliases(provider: string, patient = "Yes, that's okay."): PatientQuestionEvidenceAlias[] {
  return [
    { alias: "student-current", messageId: "student-current-id", role: "student", content: provider },
    { alias: "patient-draft", messageId: "patient-draft-id", role: "patient", content: patient },
  ];
}

const validProposals = [
  "I'd like to perform incision and drainage of the abscess.",
  "I recommend incision and drainage.",
  "We need to drain the infection and release the pressure.",
  "The plan is to make a small incision and drain the pus.",
  "We plan to perform incision and drainage of the abscess.",
  "I will perform incision and drainage of the abscess.",
  "Can we proceed with I&D of the abscess?",
];
for (const proposal of validProposals) {
  assert.equal(parse(aliases(proposal), {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  }).success, true, proposal);
}
for (const agreement of ["Yes, that's okay.", "Yes, I agree.", "Okay, I understand.", "Alright.", "That's fine."]) {
  assert.equal(parse(aliases(validProposals[0], agreement), {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  }).success, true, agreement);
}

const invalidProviderEvidence = [
  "We will not do a CT.",
  "We reviewed the CT imaging, X-ray, and scan.",
  "The diagnosis is a dental abscess.",
  "I will order labs and perform an examination.",
  "Do not worry; you will be okay.",
  "I will refer you to your dentist for follow-up.",
  "We will discuss disposition and discharge.",
  "What medications do you take, and do you have allergies?",
  "I will prescribe an antibiotic.",
  "I will give you local anesthesia and a nerve block.",
  "We will not perform incision and drainage.",
  "You declined drainage of the abscess.",
  "Incision and drainage is not indicated.",
  "I do not recommend incision and drainage.",
  "Drainage of the abscess is unnecessary.",
  "We might consider incision and drainage later.",
  "If things worsen, we could drain the abscess.",
  "Have you ever had incision and drainage before?",
  "I performed incision and drainage of the abscess yesterday.",
];
for (const provider of invalidProviderEvidence) {
  const result = parse(aliases(provider), {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  });
  assert.equal(result.success, false, provider);
  assert.equal(result.success ? undefined : result.reason, "incompatible-evidence-semantics", provider);
}

const unrelatedAgreements: Array<[string, string]> = [
  ["We will not do a CT.", "Okay, I understand."],
  ["We will review the imaging.", "Okay, that sounds fine."],
  ["I will prescribe antibiotics.", "Yes, that's okay."],
  ["I will give you anesthesia.", "Alright."],
  ["I will refer you to a dentist.", "That's fine."],
];
for (const [provider, patient] of unrelatedAgreements) {
  assert.equal(parse(aliases(provider, patient), {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  }).success, false, `${provider} / ${patient}`);
}

const priorProposal: PatientQuestionEvidenceAlias[] = [
  { alias: "student-prior-1", messageId: "s-prior", role: "student", content: "I recommend incision and drainage of the abscess." },
  { alias: "patient-prior-1", messageId: "p-prior", role: "patient", content: "Can you explain that?" },
  { alias: "student-current", messageId: "student-current-id", role: "student", content: "Do you agree to proceed?" },
  { alias: "patient-draft", messageId: "patient-draft-id", role: "patient", content: "Yes, that's okay." },
];
const priorAccepted = parse(priorProposal, {
  incisionAndDrainageProposed: true,
  patientAgreedToIncisionAndDrainage: true,
});
assert.equal(priorAccepted.success, true);

const explicitLaterAgreement = parse([
  priorProposal[0],
  { alias: "student-current", messageId: "student-current-id", role: "student", content: "What questions do you have?" },
  { alias: "patient-draft", messageId: "patient-draft-id", role: "patient", content: "I agree to the incision and drainage." },
], {
  incisionAndDrainageProposed: true,
  patientAgreedToIncisionAndDrainage: true,
});
assert.equal(explicitLaterAgreement.success, true);

const unrelatedAfterPrior = parse([
  priorProposal[0],
  { alias: "student-current", messageId: "student-current-id", role: "student", content: "We will not do a CT." },
  { alias: "patient-draft", messageId: "patient-draft-id", role: "patient", content: "Okay, I understand." },
], {
  incisionAndDrainageProposed: true,
  patientAgreedToIncisionAndDrainage: true,
});
assert.equal(unrelatedAfterPrior.success, false);

assert(priorAccepted.success);
const legacyEventsDoNotTrigger = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: priorAccepted.classification,
});
assert.equal(legacyEventsDoNotTrigger.selectedQuestionId, undefined);
const first = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: {
    ...priorAccepted.classification,
    detectedEvents: { temporaryTreatmentActive: true },
  },
});
assert.equal(first.selectedQuestionId, "c3-follow-up-needed-question");
const repeated = applyPatientQuestionClassification({
  caseId: "case-03",
  state: first.state,
  classification: priorAccepted.classification,
});
assert.equal(repeated.selectedQuestionId, undefined);

const validProposalOnly = parse(aliases(validProposals[0], "What does that involve?"), {
  incisionAndDrainageProposed: true,
  patientAgreedToIncisionAndDrainage: false,
}, ["student-current"]);
assert.equal(validProposalOnly.success, true);
assert(validProposalOnly.success);
const partial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: validProposalOnly.classification,
});
assert.equal(partial.selectedQuestionId, undefined);
assert.equal(partial.state.detectedEvents.incisionAndDrainageProposed, true);
assert.equal(partial.state.detectedEvents.patientAgreedToIncisionAndDrainage, false);
assert.equal(createEmptyPatientQuestionState().detectedEvents.patientAgreedToIncisionAndDrainage, false);

assert.equal(PATIENT_QUESTION_CONFIDENCE_THRESHOLD, 0.85);
assert.equal(parse(aliases(validProposals[0]), {
  incisionAndDrainageProposed: true,
  patientAgreedToIncisionAndDrainage: true,
}, undefined, 0.849).success, false);
assert.equal(
  getPatientQuestion("c3-follow-up-needed-question")?.text,
  "Even with this treatment, do I still need to see my dentist soon?",
);

const whyClassification = {
  schemaVersion: 1 as const,
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
};
const why = applyPatientQuestionClassification({
  caseId: "case-03",
  state: first.state,
  classification: whyClassification,
});
assert.equal(why.selectedQuestionId, "c3-follow-up-why");

console.log("Case 3 follow-up-question evidence validation passed.");
