import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { CASE_DATA } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";

function state(caseId: string, question: string) {
  return buildPatientDisclosureState({
    caseData: CASE_DATA.find((entry) => entry.metadata.id === caseId)!,
    latestStudentMessage: question,
    conversation: [],
  });
}

const questions: Array<[string, string, RegExp]> = [
  ["case-01", "Do you have insurance?", /uninsured adult/i],
  ["case-01", "Where do you live?", /Alachua County/],
  ["case-01", "Do you have reliable transportation for care outside the county?", /reliable transportation.*outside Alachua County/],
  ["case-01", "Can you travel outside Alachua County for care?", /reliable transportation/],
  ["case-02", "Do you have Medicaid or insurance?", /uninsured.*within the past year/],
  ["case-02", "Have you established residency in your county?", /Collier County.*not yet established residency/],
  ["case-02", "Can you get a ride out of town?", /unreliable transportation out of town/],
  ["case-03", "Do you have insurance?", /uninsured/],
  ["case-03", "Which county are you a resident of?", /Hillsborough County/],
  ["case-03", "Do you currently have your own dentist?", /own dentist.*appointment next week/],
  ["case-03", "Does your daughter have Medicaid and would you prefer the same clinic?", /young daughter on Medicaid.*same clinic/],
  ["case-03", "Where would you prefer to receive care?", /young daughter on Medicaid.*same clinic/],
  ["case-04", "Do you have dental insurance?", /uninsured/],
  ["case-04", "Where do you live?", /Duval County/],
  ["case-04", "Would you pay a sliding-scale fee at a clinic?", /open to paying.*sliding-scale fee/],
  ["case-05", "Do you have insurance?", /uninsured/],
  ["case-05", "Where do you live?", /Marion County/],
  ["case-05", "Can you pay anything or would you prefer a free clinic?", /cannot pay anything.*prefer a free clinic/],
];
for (const [caseId, question, expected] of questions) {
  const disclosure = state(caseId, question);
  assert.match(disclosure.allowedThisTurn.map((fact) => fact.text).join(" "), expected, `${caseId}: ${question}`);
  // Background questions must reach the provider rather than a canned answer
  // that can omit the newly permitted details.
  assert.equal(patientImmediateResponse({ caseId, message: question, disclosureState: disclosure }), undefined, question);
}
for (const entry of CASE_DATA) {
  for (const question of ["What brings you in?", "Tell me about the pain.", "Do you smoke?", "You need definitive dental care."]) {
    assert(!state(entry.metadata.id, question).allowedThisTurn.some((fact) => fact.id.includes(".background-")), question);
  }
  const residence = state(entry.metadata.id, "Where do you live?").allowedThisTurn;
  assert(residence.every((fact) => fact.id.includes(".background-")), "Residence must not disclose tooth location");

  const baseline = JSON.parse(execFileSync("git", ["show", `HEAD:src/data/cases/${entry.metadata.id}/case.json`], { encoding: "utf8" }));
  // This change must not alter clinical facts, grading, questions, assets or identity.
  for (const key of ["metadata", "patient", "assets", "patientChecklist", "clinicalChecklist"] as const) {
    assert.deepEqual(entry[key], baseline[key], `${entry.metadata.id}: ${key}`);
  }
  for (const key of ["hpiFacts", "redFlags", "examinationFindings", "expectedQuestions", "managementExpectations", "referralExpectations", "learningObjectives", "reportData"] as const) {
    assert.deepEqual(entry.supportingInfo[key], baseline.supportingInfo[key], `${entry.metadata.id}: ${key}`);
  }
}
assert(state("case-05", "Can you afford a dentist?").allowedThisTurn.some((fact) => fact.id === "c5.access"));
console.log(`Patient background validation passed (${questions.length} targeted questions, all five cases, clinical/grading scope checks).`);
