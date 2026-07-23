import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";

const cases = ["case-01", "case-02", "case-03", "case-04", "case-05"].map((id) => {
  const caseData = loadCase(id);
  assert(caseData, id);
  return caseData;
});

for (const caseData of cases) {
  for (const message of ["Are you in pain?", "Does your tooth hurt?", "Are you hurting right now?"]) {
    const state = buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: message });
    assert.deepEqual(state.allowedThisTurn, [], `${caseData.metadata.id}: ${message}`);
    const response = patientImmediateResponse({ caseId: caseData.metadata.id, message, disclosureState: state });
    assert(response && /\byes\b/i.test(response) && /\bhurt/i.test(response), `${caseData.metadata.id}: ${message}`);
    assert(!/\b(?:\d+\s*\/\s*10|days?|throbb|radiat|chew|bite|fever|allerg|ibuprofen)\b/i.test(response), response);
    assert.equal(assessPatientOutputIntegrity(response, caseData.supportingInfo.patientFacts ?? []).valid, true, response);
  }
}

const case3 = cases[2];
for (const message of ["How severe is the pain?", "How bad is it?", "What is your pain level?", "Rate it from 0 to 10."]) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert.deepEqual(state.allowedThisTurn.map((fact) => fact.id), ["c3.pain-severity"], message);
}

const dimensionCases: Array<[string, string]> = [
  ["Where does it hurt?", "c3.location"],
  ["How long has it been hurting?", "c3.duration"],
  ["What does the pain feel like?", "c3.pain-quality"],
  ["Does the pain travel anywhere?", "c3.radiation"],
  ["Does it hurt when you bite?", "c3.biting"],
];
for (const [message, expectedId] of dimensionCases) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert.deepEqual(state.allowedThisTurn.map((fact) => fact.id), [expectedId], message);
  assert(!state.allowedThisTurn.some((fact) => fact.id === "c3.pain-severity"), message);
}

for (const message of ["Tell me about the tooth pain.", "Describe what has been happening with the pain."]) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert(state.allowedThisTurn.length > 0 && state.allowedThisTurn.length <= 2, message);
  assert(!state.allowedThisTurn.some((fact) => /severity/.test(fact.id)), message);
  assert(state.allowedThisTurn.every((fact) => fact.topic === "pain"), message);
}

for (const message of ["Tell me what brought you in.", "What has been happening?", "What symptoms have you been having?"]) {
  const state = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: message });
  assert(state.isBroadQuestion, message);
  assert(state.allowedThisTurn.length <= 1, message);
  assert(!state.allowedThisTurn.some((fact) => /severity|medication|allerg|diagnos/i.test(fact.id)), message);
}

const sequence = [
  { id: "s1", role: "student" as const, text: "Are you in pain?", timestamp: "2026-07-22T12:00:00.000Z" },
  { id: "p1", role: "patient" as const, text: "Yes, it hurts.", timestamp: "2026-07-22T12:00:01.000Z" },
];
const severityFollowUp = buildPatientDisclosureState({ caseData: case3, conversation: sequence, latestStudentMessage: "How severe is it from 0 to 10?" });
assert.deepEqual(severityFollowUp.allowedThisTurn.map((fact) => fact.id), ["c3.pain-severity"]);
const onsetFollowUp = buildPatientDisclosureState({
  caseData: case3,
  conversation: [...sequence, { id: "s2", role: "student", text: "How severe is it from 0 to 10?", timestamp: "2026-07-22T12:00:02.000Z" }, { id: "p2", role: "patient", text: "The pain is severe, rated 8/10.", timestamp: "2026-07-22T12:00:03.000Z" }],
  latestStudentMessage: "How long has it been hurting?",
});
assert.deepEqual(onsetFollowUp.allowedThisTurn.map((fact) => fact.id), ["c3.duration"]);
assert(onsetFollowUp.alreadyDisclosed.some((fact) => fact.id === "c3.pain-severity"));

const onsetSeverity = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: "How long has the pain been present, and how severe is it?" });
assert.deepEqual(new Set(onsetSeverity.allowedThisTurn.map((fact) => fact.id)), new Set(["c3.duration", "c3.pain-severity"]));
const coldBiting = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: "Does it hurt with cold or when you bite?" });
assert.deepEqual(new Set(coldBiting.allowedThisTurn.map((fact) => fact.id)), new Set(["c3.cold", "c3.biting"]));
const supportedUnsupported = buildPatientDisclosureState({ caseData: case3, conversation: [], latestStudentMessage: "How severe is the pain, and does heat make it worse?" });
assert.deepEqual(supportedUnsupported.allowedThisTurn.map((fact) => fact.id), ["c3.pain-severity"]);

const unsupportedQuestion = "Does bright sunlight change the tooth pain?";
const unsupportedState = buildPatientDisclosureState({
  caseData: case3,
  conversation: onsetFollowUp.alreadyDisclosed.map((fact, index) => ({
    id: `patient-${index}`,
    role: "patient" as const,
    text: fact.text,
    timestamp: `2026-07-22T12:00:${10 + index}.000Z`,
  })),
  latestStudentMessage: unsupportedQuestion,
});
assert.deepEqual(unsupportedState.allowedThisTurn, []);
assert.equal(
  patientImmediateResponse({
    caseId: case3.metadata.id,
    message: unsupportedQuestion,
    disclosureState: unsupportedState,
  }),
  "I haven't noticed that.",
  "Unsupported questions must not fall through to an unrelated symptom dump.",
);

const case2 = cases[1];
const airwayCompound = buildPatientDisclosureState({
  caseData: case2,
  conversation: [],
  latestStudentMessage: "Have you had any swelling or trouble swallowing or breathing?",
});
assert.deepEqual(
  new Set(airwayCompound.allowedThisTurn.map((fact) => fact.id)),
  new Set(["c2.swelling", "c2.breathing-negative", "c2.liquids-positive"]),
  "Case 2 compound airway questions must retain both requested airway components.",
);

console.log("Phase 5 progressive-disclosure validation passed.");
