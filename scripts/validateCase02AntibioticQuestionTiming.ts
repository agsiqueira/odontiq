import assert from "node:assert/strict";

import {
  PATIENT_QUESTION_CATALOG,
  getPatientQuestion,
} from "../src/lib/patientQuestions/catalog";
import { parsePatientQuestionClassification } from "../src/lib/patientQuestions/schema";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import {
  PATIENT_QUESTION_CONFIDENCE_THRESHOLD,
  createEmptyPatientQuestionState,
} from "../src/lib/patientQuestions/types";
import type { PatientQuestionEvidenceAlias } from "../src/lib/patientQuestions/prompt";

const event = "antibioticsRecommendedAsCurrentPlan" as const;
const currentAlias = "student-current";

function parseEvidence(
  content: string,
  options: { confidence?: number; alias?: string } = {},
) {
  const alias = options.alias ?? currentAlias;
  const evidenceAliases: PatientQuestionEvidenceAlias[] = [{
    alias,
    messageId: `${alias}-id`,
    role: "student",
    content,
  }];
  return parsePatientQuestionClassification({
    text: JSON.stringify({
      schemaVersion: 1,
      caseId: "case-02",
      events: { [event]: true },
      confidence: options.confidence ?? 0.97,
      evidence: [alias],
    }),
    caseId: "case-02",
    studentMessageId: "student-current-id",
    allowedEvents: [event],
    evidenceAliases,
  });
}

const positiveEvidence = [
  "I recommend antibiotics.",
  "We will start an IV antibiotic.",
  "I'll begin IV antibiotics.",
  "I'll give you Unasyn.",
  "We will administer ampicillin-sulbactam.",
  "We will administer ampicillin sulbactam.",
  "I am prescribing an antibiotic.",
  "You need antimicrobial treatment.",
  "You need antimicrobial therapy.",
  "We will use clindamycin.",
  "Before discharge, we will start antibiotics.",
  "This antibiotic will help temporarily.",
];
for (const content of positiveEvidence) {
  assert.equal(parseEvidence(content).success, true, content);
}

const negativeEvidence = [
  "It means you have signs of a systemic infection, which has caused you to become clinically unstable",
  "You have an infection and systemic infection.",
  "These findings meet SIRS criteria.",
  "You have a fever and tachycardia.",
  "You are clinically unstable and this is an emergency.",
  "I will order labs and CT imaging.",
  "I recommend an OMFS consultation and admission.",
  "You may need an extraction.",
  "I will give you analgesics.",
  "I recommend medication.",
  "Are you allergic to antibiotics?",
  "Have you reacted to Unasyn before?",
  "Did you take antibiotics in the past?",
  "If your symptoms worsen, we might consider antibiotics.",
  "Antibiotics are not indicated.",
  "I do not recommend antibiotics.",
  "Antibiotics are unnecessary.",
  "No antibiotic will be given.",
];
for (const content of negativeEvidence) {
  const result = parseEvidence(content);
  assert.equal(result.success, false, content);
  assert.equal(result.success ? undefined : result.reason, "incompatible-evidence-semantics", content);
}

const priorEvidence = parseEvidence("We will start an IV antibiotic.", {
  alias: "student-history-1",
});
assert.equal(priorEvidence.success, true);

assert.equal(PATIENT_QUESTION_CONFIDENCE_THRESHOLD, 0.85);
assert.equal(
  parseEvidence("I recommend antibiotics.", { confidence: 0.849 }).success,
  false,
);
assert.equal(
  getPatientQuestion("c2-antibiotic-effect-question")?.text,
  "Will the antibiotic make the tooth better?",
);
assert.equal(
  PATIENT_QUESTION_CATALOG.filter((question) => question.caseId === "case-02").length,
  1,
);

const rejected = parseEvidence(negativeEvidence[0]);
assert.equal(rejected.success, false);
const untouched = createEmptyPatientQuestionState();
assert.equal(untouched.detectedEvents[event], false);
assert.deepEqual(untouched.emittedQuestionIds, []);

assert(priorEvidence.success);
const first = applyPatientQuestionClassification({
  caseId: "case-02",
  classification: priorEvidence.classification,
});
assert.equal(first.selectedQuestionId, "c2-antibiotic-effect-question");
const repeated = applyPatientQuestionClassification({
  caseId: "case-02",
  state: first.state,
  classification: priorEvidence.classification,
});
assert.equal(repeated.selectedQuestionId, undefined);

const case1Event = parsePatientQuestionClassification({
  text: JSON.stringify({
    schemaVersion: 1,
    caseId: "case-01",
    events: { hospitalAdmissionOrSurgicalManagementDiscussed: true },
    confidence: 0.97,
    evidence: [currentAlias],
  }),
  caseId: "case-01",
  studentMessageId: "student-current-id",
  allowedEvents: ["hospitalAdmissionOrSurgicalManagementDiscussed"],
  evidenceAliases: [{
    alias: currentAlias,
    messageId: "student-current-id",
    role: "student",
    content: "I recommend hospital admission.",
  }],
});
assert.equal(case1Event.success, true);

console.log("Case 2 antibiotic-question timing validation passed.");
