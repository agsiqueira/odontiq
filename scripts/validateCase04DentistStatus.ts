import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import type { ConversationMessage } from "../src/lib/conversationEngine";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import {
  case4GovernedDentistResponse,
  patientImmediateResponse,
} from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";

const case4 = loadCase("case-04")!;
const currentResponse = "No, I don't have a dentist I can see now.";
const historyResponse = "Yes. My last dental visit was about five years ago.";
const followUpResponse = "I don't have a dentist I can see now, so I'll need help arranging follow-up.";
const insuranceResponse = "No, I don't have dental insurance.";

function disclosure(question: string, conversation: ConversationMessage[] = []) {
  return buildPatientDisclosureState({
    caseData: case4,
    conversation,
    latestStudentMessage: question,
  });
}

function immediate(question: string, conversation: ConversationMessage[] = []) {
  return patientImmediateResponse({
    caseId: "case-04",
    message: question,
    disclosureState: disclosure(question, conversation),
    priorPatientDialogue: conversation
      .filter((message) => message.role === "patient")
      .map((message) => message.text),
  });
}

for (const question of [
  "Do you have a dentist?",
  "Do you see a dentist regularly?",
  "Who is your dentist?",
  "Do you have a regular dentist?",
]) {
  assert.equal(immediate(question), currentResponse, question);
  assert.deepEqual(disclosure(question).allowedThisTurn.map((fact) => fact.id), ["c4.access"], question);
  const prior: ConversationMessage[] = [
    { id: "s1", role: "student", text: question, timestamp: "2026-08-23T12:00:00.000Z" },
    { id: "p1", role: "patient", text: currentResponse, timestamp: "2026-08-23T12:00:01.000Z" },
  ];
  assert.equal(immediate(question, prior), currentResponse, `repeated: ${question}`);
}

for (const question of [
  "When did you last see a dentist?",
  "Have you ever been to a dentist?",
  "How long has it been since you saw a dentist?",
]) {
  assert.equal(immediate(question), historyResponse, question);
  assert.deepEqual(disclosure(question).allowedThisTurn.map((fact) => fact.id), ["c4.last-dentist"], question);
}

for (const question of [
  "Can you follow up with your dentist?",
  "Can you make an appointment?",
  "Would you like a referral?",
  "Do you need help finding a dentist?",
  "Can you arrange dental follow-up?",
]) {
  assert.equal(immediate(question), followUpResponse, question);
  assert.deepEqual(disclosure(question).allowedThisTurn.map((fact) => fact.id), ["c4.access"], question);
}

assert.equal(immediate("Do you have dental insurance?"), insuranceResponse);
assert.deepEqual(disclosure("Do you have dental insurance?").allowedThisTurn.map((fact) => fact.id), ["c4.access"]);

const unrelatedClinicalQuestion = "Would this diagnosis require a procedure?";
assert.equal(case4GovernedDentistResponse("case-04", unrelatedClinicalQuestion), undefined);
assert.equal(disclosure(unrelatedClinicalQuestion).asksRestrictedClinicalInterpretation, true);
assert.deepEqual(disclosure(unrelatedClinicalQuestion).allowedThisTurn, []);

const case4Facts = case4.supportingInfo.patientFacts ?? [];
const accessFact = case4Facts.filter((fact) => fact.id === "c4.access");
assert.equal(assessPatientOutputIntegrity(currentResponse, case4Facts, [], accessFact).valid, true);
for (const unsafe of [
  "Yes, I have a dentist.",
  "I have a regular dentist.",
  "My dentist can see me tomorrow.",
  "I can follow up with my dentist.",
  "I already have an appointment.",
  "Yes, I have a dentist, but I do not have dental insurance.",
]) {
  assert.equal(assessPatientOutputIntegrity(unsafe, case4Facts).valid, false, unsafe);
}
for (const safe of [
  "The last time I saw a dentist was about five years ago.",
  "Yes, I saw a dentist about five years ago.",
  currentResponse,
  followUpResponse,
  insuranceResponse,
]) {
  assert.equal(assessPatientOutputIntegrity(safe, case4Facts).valid, true, safe);
}

const fallback = await generatePatientRoleSafeResponse({
  initialOutput: "Yes, I have a dentist, but I do not have dental insurance.",
  retry: async () => "My dentist can see me tomorrow.",
  visibleFacts: case4Facts,
  requiredFacts: accessFact,
  fallbackText: followUpResponse,
});
assert.equal(fallback.text, followUpResponse);
assert.equal(fallback.repeatedDrift, true);

const case3 = loadCase("case-03")!;
assert.equal(
  assessPatientOutputIntegrity(
    "I called my dentist a couple of days ago and have an appointment next week.",
    case3.supportingInfo.patientFacts ?? [],
  ).valid,
  true,
);
const case5 = loadCase("case-05")!;
assert.equal(
  assessPatientOutputIntegrity(
    "No, I don't have a dentist or an appointment right now.",
    case5.supportingInfo.patientFacts ?? [],
  ).valid,
  true,
);
for (const caseId of ["case-01", "case-02", "case-03", "case-05"]) {
  assert.equal(case4GovernedDentistResponse(caseId, "Do you have a dentist?"), undefined, caseId);
}

console.log("Case 4 dentist-status validation passed.");
