import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import type { PatientDisclosureFact } from "../src/lib/patientDisclosure";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { SAFE_PATIENT_BASE_RESPONSE_FALLBACK } from "../src/lib/patientRoleGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";

const case1 = loadCase("case-01")!;
const case1Facts = case1.supportingInfo.patientFacts ?? [];

const rejected = [
  "I've had reactions to penicillin before.",
  "Penicillin caused a reaction before.",
  "I reacted badly to penicillin.",
  "I broke out in hives after taking penicillin.",
  "Penicillin gave me a rash.",
  "I had anaphylaxis from penicillin.",
  "I have had angioedema from penicillin.",
  "My lips swelled after I took penicillin.",
  "Penicillin made my throat swell.",
  "I am allergic to penicillin.",
  "I have a penicillin allergy.",
  "I was allergic to penicillin.",
  "My penicillin allergy caused a rash.",
  "Penicillin gives me hives.",
  "I developed a rash from penicillin.",
];
for (const response of rejected) {
  const assessment = assessPatientOutputIntegrity(response, case1Facts);
  assert.equal(assessment.valid, false, response);
  assert.equal(assessment.reason, "contradiction of Case 1 no penicillin allergy", response);
}

for (const response of [
  "I have no known drug allergies.",
  "I am not allergic to penicillin.",
  "I have never reacted to penicillin.",
  "Penicillin has never caused a reaction.",
  "No, penicillin has never given me hives or a rash.",
  "My jaw is swollen on both sides under my chin.",
  "The swelling under my jaw has been getting worse.",
  "Alright, I trust you to help me.",
  "Okay, I understand that you want to begin IV antibiotics.",
  "Okay, I understand that you will give me Unasyn.",
  "I do not know or recall whether I took antibiotics for this problem before.",
]) {
  assert.equal(assessPatientOutputIntegrity(response, case1Facts).valid, true, response);
}

for (const question of [
  "Do you have any allergies?",
  "Are you allergic to penicillin?",
  "Have you reacted to penicillin?",
  "What happened when you took penicillin?",
]) {
  const state = buildPatientDisclosureState({
    caseData: case1,
    conversation: [],
    latestStudentMessage: question,
  });
  assert.deepEqual(state.allowedThisTurn.map((fact) => fact.id), ["c1.nkda"], question);
}

for (const recommendation of [
  "I would like to begin IV antibiotics.",
  "I will give you Unasyn.",
]) {
  const state = buildPatientDisclosureState({
    caseData: case1,
    conversation: [],
    latestStudentMessage: recommendation,
  });
  assert.deepEqual(state.allowedThisTurn, [], recommendation);
}

const fallback = await generatePatientRoleSafeResponse({
  initialOutput: rejected[0],
  visibleFacts: case1Facts,
  retry: async () => rejected[3],
  allowPatientInitiatedQuestion: false,
});
assert.equal(fallback.repeatedDrift, true);
assert.equal(fallback.text, SAFE_PATIENT_BASE_RESPONSE_FALLBACK);

const case4Penicillin: PatientDisclosureFact = {
  id: "c4.penicillin",
  topic: "allergies",
  text: "The patient is allergic to penicillin.",
};
const case4Hives: PatientDisclosureFact = {
  id: "c4.hives",
  topic: "allergies",
  text: "Penicillin causes hives.",
};
assert.equal(
  assessPatientOutputIntegrity(
    "Penicillin gives me hives.",
    [case4Penicillin, case4Hives],
    [],
    [case4Penicillin, case4Hives],
  ).valid,
  true,
);

for (const [fact, response] of [
  [{ id: "c2.nkda", topic: "allergies", text: "No penicillin allergy." }, "I am not allergic to penicillin."],
  [{ id: "c3.nkda", topic: "allergies", text: "No known drug allergies." }, "I have no known drug allergies."],
  [{ id: "c5.nkda", topic: "allergies", text: "No known drug allergies." }, "I have no known drug allergies."],
] satisfies Array<[PatientDisclosureFact, string]>) {
  assert.equal(assessPatientOutputIntegrity(response, [fact], [], [fact]).valid, true, fact.id);
}

console.log("Case 1 penicillin-consistency validation passed.");
