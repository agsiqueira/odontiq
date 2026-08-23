import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";

const caseData = loadCase("case-03")!;
const emptyState = (message: string) => buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: message,
});
const immediate = (message: string) => patientImmediateResponse({
  caseId: "case-03",
  message,
  disclosureState: emptyState(message),
});

const allergyQuestions = [
  "Are you allergic to any antibiotics?",
  "Do you have any medication allergies?",
  "Do you have any drug allergies?",
  "Are you allergic to penicillin?",
  "Any known allergies?",
  "Any antibiotic allergies",
  "Have you got any allergies to medicine?",
];
for (const question of allergyQuestions) {
  const response = immediate(question);
  assert.equal(
    response,
    "No, I have no known drug allergies, including no penicillin allergy.",
    question,
  );
  assert(!/pepcid|ibuprofen|tylenol|acetaminophen|before coming|don't remember/i.test(response), question);
  assert.equal(response.match(/allerg/gi)?.length, 2, question);
}

const ibuprofenQuestions = [
  "Are you allergic to ibuprofen?",
  "Are you allergic to Advil or Motrin?",
  "Can you take NSAIDs?",
  "What happens when you take ibuprofen?",
  "Does ibuprofen upset your stomach?",
  "Do your ulcers make ibuprofen hard to tolerate?",
];
for (const question of ibuprofenQuestions) {
  const response = immediate(question);
  assert.equal(
    response,
    "I'm not allergic to ibuprofen, but it upsets my stomach, so I avoid it.",
    question,
  );
  assert.match(response, /not allergic/i, question);
  assert.match(response, /upsets my stomach/i, question);
  assert(!/pepcid|tylenol|acetaminophen|antibiotics? before|don't remember/i.test(response), question);
}

const separateMedicationQuestions: Array<[string, string[]]> = [
  ["What medications do you take?", ["c3.pepcid"]],
  ["What dose of Pepcid do you take?", ["c3.pepcid-details-unknown"]],
  ["How often do you take Pepcid?", ["c3.pepcid-details-unknown"]],
  ["Did you take antibiotics before coming in?", ["c3.prior-antibiotics-unknown"]],
  ["Did you take Tylenol before coming in?", ["c3.prior-acetaminophen-unknown"]],
];
for (const [question, expectedIds] of separateMedicationQuestions) {
  assert.equal(immediate(question), undefined, question);
  assert.deepEqual(
    emptyState(question).allowedThisTurn.map((fact) => fact.id),
    expectedIds,
    question,
  );
}

for (const statement of [
  "I recommend an antibiotic.",
  "I am prescribing medication.",
  "We will start ibuprofen for pain.",
]) {
  assert.equal(immediate(statement), undefined, statement);
}

const reportedCompoundResponse = "I take Pepcid as needed. Ibuprofen upsets my stomach, so I avoid it. I take Pepcid as needed, but I don't know the exact dose or frequency. I don't remember whether I took antibiotics before coming in. I don't remember whether I took Tylenol before coming in.";
for (const question of allergyQuestions) {
  assert.notEqual(immediate(question), reportedCompoundResponse, question);
}

for (const caseId of ["case-01", "case-02", "case-04", "case-05"]) {
  const otherCase = loadCase(caseId)!;
  const message = "Are you allergic to penicillin?";
  assert.equal(patientImmediateResponse({
    caseId,
    message,
    disclosureState: buildPatientDisclosureState({
      caseData: otherCase,
      conversation: [],
      latestStudentMessage: message,
    }),
  }), undefined, caseId);
}

const facts = caseData.supportingInfo.patientFacts ?? [];
assert.match(facts.find((fact) => fact.id === "c3.nkda")?.text ?? "", /no known drug allergies.*no penicillin allergy/i);
assert.match(facts.find((fact) => fact.id === "c3.ibuprofen")?.text ?? "", /upsets.*stomach.*poorly tolerated/i);
const rubric = facultyRubrics.find((candidate) => candidate.caseId === "case-03")!;
for (const criterionId of ["C3-IG-003", "C3-IG-004", "C3-IG-007"]) {
  assert(rubric.criteria.some((criterion) => criterion.id === criterionId), criterionId);
}

console.log("Case 3 allergy-response relevance validation passed.");
