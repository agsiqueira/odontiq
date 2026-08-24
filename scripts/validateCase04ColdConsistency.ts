import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import type { ConversationMessage } from "../src/lib/conversationEngine";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import {
  case4GovernedThermalResponse,
  patientImmediateResponse,
} from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";

const case4 = loadCase("case-04")!;
const case5 = loadCase("case-05")!;
const currentResponse = "No, cold does not cause pain now.";
const historicalResponse = "Cold hurt the tooth earlier in the illness.";
const combinedResponse = "Cold hurt earlier, but it does not cause pain now.";

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

const currentQuestions = [
  "Does cold make it worse?",
  "Do cold drinks hurt?",
  "Is it sensitive to cold?",
  "Does cold bother it?",
  "What happens when you drink something cold?",
  "Does chilly water cause pain?",
];
for (const question of currentQuestions) {
  assert.equal(immediate(question), currentResponse, question);
  assert.deepEqual(disclosure(question).allowedThisTurn.map((fact) => fact.id), ["c4.cold-now"], question);
  const prior: ConversationMessage[] = [
    { id: "s1", role: "student", text: question, timestamp: "2026-08-23T12:00:00.000Z" },
    { id: "p1", role: "patient", text: currentResponse, timestamp: "2026-08-23T12:00:01.000Z" },
  ];
  assert.equal(immediate(question, prior), currentResponse, `repeated: ${question}`);
}

for (const question of [
  "Was it sensitive before?",
  "Was it sensitive to cold before?",
  "Was it sensitive before when you drank cold water?",
  "Did cold used to hurt?",
  "Did cold hurt earlier?",
]) {
  assert.equal(immediate(question), historicalResponse, question);
  assert.deepEqual(disclosure(question).allowedThisTurn.map((fact) => fact.id), ["c4.cold-prior"], question);
}

for (const question of [
  "Did it used to hurt with cold but stop?",
  "Has the cold sensitivity changed?",
  "Does cold still hurt like it did before?",
]) {
  assert.equal(immediate(question), combinedResponse, question);
  assert.deepEqual(
    disclosure(question).allowedThisTurn.map((fact) => fact.id),
    ["c4.cold-prior", "c4.cold-now"],
    question,
  );
}

for (const question of ["Does heat make it worse?", "Do hot drinks hurt?"]) {
  assert.equal(immediate(question), "I haven't noticed that.", question);
  assert.deepEqual(disclosure(question).allowedThisTurn, [], question);
}

for (const [question, expectedId] of [
  ["Does biting hurt?", "c4.biting"],
  ["Does chewing hurt?", "c4.biting"],
  ["Does tapping hurt?", "c4.biting"],
  ["Does percussion hurt?", "c4.biting"],
] as const) {
  assert.equal(case4GovernedThermalResponse("case-04", question), undefined, question);
  assert(disclosure(question).allowedThisTurn.some((fact) => fact.id === expectedId), question);
}

const case4Facts = case4.supportingInfo.patientFacts ?? [];
for (const unsafe of [
  "Cold makes it worse.",
  "Cold drinks hurt.",
  "It hurts when I drink something cold.",
  "The tooth is sensitive to cold.",
  "Cold causes pain.",
  "Drinking cold makes it worse.",
  "Cold still hurts now.",
]) {
  assert.equal(assessPatientOutputIntegrity(unsafe, case4Facts).valid, false, unsafe);
}
for (const safe of [
  "Cold does not hurt now.",
  "Cold hurt earlier.",
  "Cold used to hurt, but it does not anymore.",
  combinedResponse,
  "Biting, chewing, and tapping cause sharp pain.",
]) {
  assert.equal(assessPatientOutputIntegrity(safe, case4Facts).valid, true, safe);
}

const fallback = await generatePatientRoleSafeResponse({
  initialOutput: "Drinking cold makes it worse.",
  retry: async () => "Cold drinks hurt.",
  visibleFacts: case4Facts,
  fallbackText: currentResponse,
});
assert.equal(fallback.text, currentResponse);
assert.equal(fallback.repeatedDrift, true);

const case5Facts = case5.supportingInfo.patientFacts ?? [];
for (const response of [
  "Cold drinks make the pain worse.",
  "The pain keeps hurting for a little while after the cold is gone.",
]) {
  assert.equal(assessPatientOutputIntegrity(response, case5Facts).valid, true, response);
}
assert.equal(case4GovernedThermalResponse("case-05", "Does cold make it worse?"), undefined);
for (const caseId of ["case-01", "case-02", "case-03"]) {
  assert.equal(case4GovernedThermalResponse(caseId, "Does cold make it worse?"), undefined, caseId);
}

console.log("Case 4 cold-consistency validation passed.");
