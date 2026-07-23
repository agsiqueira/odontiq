import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import { buildPatientDisclosureState, classifyProviderMessageIntent } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";

const case1 = loadCase("case-01");
const case3 = loadCase("case-03");
assert(case1 && case3);

const npoInstructions = [
  "You will be NPO.",
  "You need to remain NPO.",
  "Nothing by mouth.",
  "Do not eat or drink.",
  "You cannot have anything to eat or drink.",
  "We need to keep you NPO before the procedure.",
  "No food or liquids until the surgeon evaluates you.",
  "You will be NPO, and we will start IV fluids.",
  "You need to remain NPO. Do you understand?",
];

for (const message of npoInstructions) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert.equal(classifyProviderMessageIntent(message), "instruction", message);
  assert.deepEqual(state.allowedThisTurn, [], message);
  const response = patientImmediateResponse({ caseId: "case-03", message, disclosureState: state });
  assert.equal(response, "Okay, I understand.", message);
  assert(!/alcohol|beer|wine|liquor/i.test(response), message);
  assert.equal(assessPatientOutputIntegrity(response, []).valid, true, message);
}

for (const message of ["Do you drink alcohol?", "How much alcohol do you drink?", "When was your last alcoholic drink?"]) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert.equal(state.providerMessageIntent, "question", message);
  assert(state.allowedThisTurn.some((fact) => fact.id === "c3.alcohol"), message);
  assert.equal(patientImmediateResponse({ caseId: "case-03", message, disclosureState: state }), undefined, message);
}

for (const message of ["Have you eaten anything today?", "When did you last eat or drink?", "Have you had anything by mouth?", "You need to remain NPO. When did you last eat?"]) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert.equal(state.providerMessageIntent, "question", message);
  assert(!state.allowedThisTurn.some((fact) => fact.id === "c3.alcohol"), message);
  assert.equal(patientImmediateResponse({ caseId: "case-03", message, disclosureState: state }), undefined, message);
}

const gumQuestions = [
  "Does it hurt when I press on your gums?",
  "Is this tender when I press here?",
  "Does touching the swollen gum hurt?",
  "Is the gum tender to pressure?",
  "Does palpating this area cause pain?",
];

for (const message of gumQuestions) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  const fact = state.allowedThisTurn.find((candidate) => candidate.id === "c3.gum-palpation");
  assert(fact, message);
  const response = patientImmediateResponse({ caseId: "case-03", message, disclosureState: state });
  assert.equal(response, "Yes, it hurts when you press there.", message);
  assert(!/\b(?:\d+\s*\/\s*10|fever|drain|pus|diagnos|medication|allerg)\b/i.test(response), message);
  assert.equal(assessPatientOutputIntegrity(response, [fact], [], [fact]).valid, true, message);

  const isolatedState = buildPatientDisclosureState({ caseData: case1, conversation: [], latestStudentMessage: message });
  assert(!isolatedState.allowedThisTurn.some((candidate) => candidate.id === "c3.gum-palpation"), message);
  assert.equal(patientImmediateResponse({ caseId: "case-01", message, disclosureState: isolatedState }), undefined, message);
}

const compoundMessage = "Does it hurt when I press your gums or when you bite down?";
const compoundState = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: compoundMessage });
assert.equal(patientImmediateResponse({ caseId: "case-03", message: compoundMessage, disclosureState: compoundState }), "Yes, it hurts when you press there.");

console.log(`Phase 4 patient-response validation passed (${npoInstructions.length} NPO instructions, 7 contrast questions, ${gumQuestions.length} gum-pressure questions, and cross-case/compound protections).`);
