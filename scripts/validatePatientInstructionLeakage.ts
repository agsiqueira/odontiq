import assert from "node:assert/strict";
import { patientInstructionLeakage, guardPatientPresentation } from "../src/lib/patientInstructionLeakage";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { PATIENT_BEHAVIOR_PROFILES, behavioralContractForCase, renderPatientBehavior, selectBehavioralStage } from "../src/lib/patientBehavior";

const answer = "Yes, I'm open to paying on a sliding-scale fee.";
const leaks = [
  "I'm keeping it brief.", "I’ll keep my replies concise.", "I am making my response short.",
  "I'm being concise.", "I'll answer briefly.", "I respond in a single sentence.",
  "I'm supposed to be brief.", "Following the style instructions, I agree.",
  "My prompt requires me to stay in character.", "Per the system prompt, yes.",
  "As an AI, I can answer that.", "I'm a language model.", "I am a virtual patient.",
  "I'm role-playing a patient.", "This is a simulation.",
];
const natural = [answer, "That's it.", "I'm tired and it hurts to talk.", "I'm worried about paying for care.",
  "My dentist gave me instructions for taking the medicine.", "I followed the discharge instructions.",
  "The doctor told me to keep the appointment.", "The pain was brief at first.", "I feel short of breath.",
  "I don't know the clinic's payment rules."];
for (const text of leaks) {
  assert(patientInstructionLeakage(text), text);
  assert.equal(assessPatientOutputIntegrity(`${answer} ${text}`, []).valid, false, text);
  assert.equal(guardPatientPresentation(`${answer} ${text}`, answer), answer, text);
}
for (const text of natural) {
  assert.equal(patientInstructionLeakage(text), undefined, text);
  assert.equal(guardPatientPresentation(text, answer), text, text);
}
for (const profile of PATIENT_BEHAVIOR_PROFILES) {
  for (const phrase of profile.optionalPhrases) assert.equal(patientInstructionLeakage(phrase.text), undefined, phrase.text);
  for (let turn = 1; turn <= 24; turn++) {
    const rendered = renderPatientBehavior({ patientId: profile.patientId, caseId: profile.caseId,
      originalText: answer, governedFacts: [], contract: behavioralContractForCase(profile.caseId)!,
      stage: selectBehavioralStage(turn), finalizedTurnNumber: turn, recentPatientResponses: [] });
    assert.equal(patientInstructionLeakage(rendered.text), undefined, `${profile.caseId} turn ${turn}`);
    assert.match(rendered.text, /sliding-scale fee/);
  }
}
for (const leak of leaks) {
  const rendered = renderPatientBehavior({ patientId: "noah-patel", caseId: "case-04", originalText: answer,
    governedFacts: [], contract: behavioralContractForCase("case-04")!, stage: 2, finalizedTurnNumber: 5 },
  () => `${answer} ${leak}`);
  assert.equal(rendered.text, answer, leak);
  assert.equal(rendered.usedFallback, true, leak);
}
async function validateRetry() {
  let retries = 0;
  const repaired = await generatePatientRoleSafeResponse({ initialOutput: `${answer} ${leaks[0]}`,
    retry: async () => { retries++; return answer; }, allowPatientInitiatedQuestion: false });
  assert.equal(repaired.text, answer);
  assert.equal(retries, 1);
  const fallback = await generatePatientRoleSafeResponse({ initialOutput: `${answer} ${leaks[1]}`,
    retry: async () => `${answer} ${leaks[10]}`, fallbackText: answer, allowPatientInitiatedQuestion: false });
  assert.equal(fallback.text, answer);
  assert.equal(fallback.repeatedDrift, true);
  console.log(`Instruction-leakage validation passed (${leaks.length} leak variants, ${natural.length} natural controls, 120 stage renders, behavior rollback and model retry/fallback).`);
}
void validateRetry();
