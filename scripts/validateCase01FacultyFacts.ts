import assert from "node:assert/strict";

import caseDataJson from "../src/data/cases/case-01/case.json";
import type { CaseData } from "../src/data/cases";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";

const caseData = caseDataJson as CaseData;
assert.equal(caseData.patient.age, 52);
assert.equal(caseData.patient.sex, "Not specified");

const directQuestions: Array<[string, string]> = [
  ["Which tooth or area hurts?", "c1.location"],
  ["How long has the dental pain been worsening?", "c1.duration"],
  ["Do you know exactly when it started?", "c1.onset-uncertain"],
  ["How severe was the pain when it first began?", "c1.initial-severity"],
  ["How long have you had trouble swallowing or breathing when lying down?", "c1.airway-duration"],
  ["Is the swelling on one side or both sides?", "c1.swelling-location"],
  ["Are you short of breath while sitting upright?", "c1.upright-breathing"],
  ["Are you short of breath when lying flat?", "c1.dyspnea-supine"],
  ["Have you measured your temperature?", "c1.home-temperature"],
  ["Do you have chest pain?", "c1.chest-pain"],
  ["Do you have diabetes?", "c1.diabetes"],
  ["Do you have hypertension?", "c1.hypertension"],
  ["What medications do you take?", "c1.metformin"],
  ["Do you have medication allergies?", "c1.nkda"],
  ["Are you allergic to penicillin?", "c1.nkda"],
  ["Can you take ibuprofen?", "c1.ibuprofen"],
  ["Have you ever used opioids?", "c1.opioid"],
  ["Do you have a history of opioid misuse or abuse?", "c1.opioid"],
  ["Do you smoke?", "c1.smoking"],
  ["Do you drink alcohol?", "c1.alcohol"],
  ["Do you use illicit drugs?", "c1.illicit-drugs"],
  ["Have you taken antibiotics for this?", "c1.prior-antibiotics-unknown"],
  ["Which over-the-counter pain medicine did you take?", "c1.otc-unknown"],
  ["Have you had a root canal on this tooth?", "c1.prior-root-canal-unknown"],
  ["Have you ever had an extraction?", "c1.prior-extraction-unknown"],
];

for (const [question, expectedId] of directQuestions) {
  const state = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question });
  assert(state.allowedThisTurn.some((fact) => fact.id === expectedId), `${question} must expose ${expectedId}; got ${state.allowedThisTurn.map((fact) => fact.id).join(", ")}`);
}

for (const question of [
  "What is your race or ethnicity?", "What is your occupation?", "What is your family history?",
  "What is your surgical history?", "Have you been hospitalized before?", "What exact tooth number is it?",
  "What is your body weight?", "Are you pregnant?", "Who do you live with?", "Are you married?",
]) {
  const state = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question });
  assert.equal(state.allowedThisTurn.length, 0, `${question} must not unlock an invented fact`);
}

const visibleFacts = caseData.supportingInfo.patientFacts ?? [];
for (const contradiction of [
  "Yes, the pain is on the right side.",
  "Yes, the dental pain has been there for two weeks.",
  "I am short of breath even while sitting upright.",
  "I measured a fever of 103 degrees at home.",
  "I am allergic to penicillin.",
  "I take insulin.",
  "Yes, I have used opioids before.",
  "I drink alcohol regularly.",
  "I already took antibiotics for this.",
  "No, I have never taken antibiotics for this.",
  "I previously had a root canal on this tooth.",
  "No, this tooth never had a root canal.",
  "I had an extraction before.",
  "No, I have never had an extraction.",
]) assert.equal(assessPatientOutputIntegrity(contradiction, visibleFacts).valid, false, contradiction);

for (const consistent of [
  "It is my lower-left molar.", "The bad tooth is on the lower-left side.",
  "The pain has been worsening for four days.", "It has gotten worse over the last four days.",
  "It is eight out of ten now.", "I would rate the current pain 8 out of 10.",
  "I am not short of breath while sitting upright.", "Breathing is okay while I sit up.",
  "I have no known drug allergies, including penicillin.", "No, I am not allergic to penicillin.",
  "I have never used opioids.", "No, I have no opioid misuse history.",
  "I smoke about one pack per day.", "I smoke roughly a pack of cigarettes a day.",
  "I do not drink alcohol.", "No, I never use alcohol.",
  "I do not know or recall whether I took antibiotics for this before.",
  "I do not know or recall whether this tooth had a root canal before.",
  "I do not know or recall whether I have had an extraction before.",
]) assert.equal(assessPatientOutputIntegrity(consistent, visibleFacts).valid, true, consistent);

console.log(`Case 1 faculty-fact validation passed (${directQuestions.length} direct questions).`);
