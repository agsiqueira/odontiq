import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AMARA_BEHAVIORAL_CONTRACT,
  AMARA_PATIENT_ID,
  buildAmaraBehaviorFixtures,
  renderAmaraCandidate,
  renderPatientBehavior,
  selectAmaraToneMode,
  validateFactPreservation,
} from "../src/lib/patientBehavior";
import { buildPatientAudioPlan, getAmaraBreathingAnimationPath } from "../src/lib/patientAudioPlan";
import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";

const fixtures = buildAmaraBehaviorFixtures();
const byId = (id: string) => {
  const fixture = fixtures.find((item) => item.id === id);
  assert.ok(fixture, `missing fixture ${id}`);
  return fixture;
};
let assertions = 0;
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual: unknown, expected: unknown, message: string) => { assertions += 1; assert.deepEqual(actual, expected, message); };

const selectorInput = { patientId: AMARA_PATIENT_ID, caseId: "case-01", originalText: byId("duration").originalText };
equal(selectAmaraToneMode(selectorInput), selectAmaraToneMode(selectorInput), "tone selection is deterministic");
equal(byId("duration").result.text, buildAmaraBehaviorFixtures().find((item) => item.id === "duration")?.result.text, "rendering is deterministic");
const rendererSource = await readFile("src/lib/patientBehavior/amaraRenderer.ts", "utf8");
check(!/Math\.random|crypto\.random/i.test(rendererSource), "renderer must not use runtime randomness");

const nonAmara = renderPatientBehavior({ ...selectorInput, patientId: "other-patient", originalText: "I am fine.", governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT });
equal(nonAmara.text, "I am fine.", "non-Amara text is unchanged");
equal(nonAmara.bypassReason, "non-amara", "non-Amara path is explicit");
check(byId("duration").result.text.length < byId("duration").originalText.length, "duration becomes shorter");
equal(renderAmaraCandidate({ ...selectorInput, originalText: "Thank you very much. I am ready.", governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT }, "mildly_impatient"), "I'm ready.", "mildly impatient mode removes excessive politeness");
equal(render("I am tired, but I do not need anything else.").text, "I'm tired, but I don't need anything else.", "safe contractions are applied");
check(byId("fever").result.text.includes("..."), "exhausted cadence is restrained");
check(!fixtures.some((item) => /sleep|sarcas|idiot|stupid/i.test(item.result.text)), "no sleep history, hostility, or sarcasm is invented");
check(byId("swallowing").result.text.includes("swallow"), "clinically relevant answer remains cooperative");
check(new Set(fixtures.map((item) => item.result.text)).size === fixtures.length, "responses are not transformed identically");
equal(render("Nothing stylistically safe applies here.").text, "Nothing stylistically safe applies here.", "low-confidence response stays unchanged");

for (const id of ["duration", "score", "location", "onset", "swelling", "fever", "swallowing", "medications", "allergies", "negative", "multi"]) {
  const fixture = byId(id);
  check(fixture.result.valid, `${id} candidate validates`);
  check(!fixture.result.usedFallback, `${id} candidate does not fall back`);
  equal(fixture.result.preservedFactIds, fixture.governedFacts.map((fact) => fact.id), `${id} preserves all governed facts`);
}
check(/four days/i.test(byId("duration").result.text), "four-day duration is exact");
check(/eight out of ten/i.test(byId("score").result.text), "pain score is exact");
check(/lower-left/i.test(byId("location").result.text), "lower-left location is exact");
check(/dull toothache[\s\S]*worse quickly/i.test(byId("onset").result.text), "onset course is retained");
check(/metformin[\s\S]*lisinopril/i.test(byId("medications").result.text), "medications are retained");
check(/no known drug allergies[\s\S]*no penicillin/i.test(byId("allergies").result.text), "allergy status is retained");
check(!fixtures.some((item) => /\b(?:maybe|probably|i think|i guess)\b/i.test(item.result.text) && !/\b(?:maybe|probably|i think|i guess)\b/i.test(item.originalText)), "no uncertainty is introduced");

const addedSymptom = validateFactPreservation({ originalText: "My tooth hurts.", candidateText: "My tooth hurts and I have fever.", governedFacts: [] });
check(addedSymptom.violations.some((item) => item.code === "unsupported-addition"), "unsupported clinical additions are rejected");
const rejected = renderPatientBehavior({ ...selectorInput, originalText: byId("duration").originalText, governedFacts: byId("duration").governedFacts, contract: AMARA_BEHAVIORAL_CONTRACT }, () => "It has been three days.");
equal(rejected.text, byId("duration").originalText, "validator rejection falls back to original");
check(rejected.usedFallback, "fallback metadata is exposed");

equal(getPatientQuestion("c1-extraction-question")?.text, "Will they pull out the bad tooth?", "patient question remains exact");
equal(byId("exact").result.text, "I haven't noticed that.", "unsupported reply remains exact");
equal(byId("exact").result.bypassReason, "exact-output", "exact reply uses explicit bypass");
equal(renderPatientBehavior({ ...selectorInput, originalText: "", governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT }).text, "", "empty response remains empty");
check(!fixtures.some((item) => /toneMode|governedFacts|violations|usedFallback/.test(item.result.text)), "behavior metadata does not leak into text");

const accepted = byId("multi").result.text;
const plan = buildPatientAudioPlan("case-01", accepted, 4);
equal(plan.filter((segment) => segment.type === "speech").map((segment) => segment.text).join(""), accepted, "audio plan reconstructs accepted text exactly");
const route = await readFile("src/app/api/conversation/route.ts", "utf8");
check(/baseResponse: finalResponseText/.test(route), "persistence receives final accepted text");
check(/draftPatientResponse: finalResponseText/.test(route), "patient-question classifier receives final accepted text");
check(/exactTextRequired: Boolean\(immediateResponse\)/.test(route), "immediate replies bypass rendering");
const encounter = await readFile("src/components/EncounterExperience.tsx", "utf8");
check(/text: data\.response/.test(encounter), "display receives API accepted text");
check(/speechPlayback\.speak\(patientConversationMessage\.text/.test(encounter), "TTS receives displayed accepted text");
check(!/facultyRubric|scoreFaculty|buildPatientDisclosureState/.test(rendererSource), "renderer cannot alter scoring or disclosure state");
equal(getAmaraBreathingAnimationPath("amara-breath-moderate-01"), "/video/amara/amara-breathing-moderate.mp4", "moderate animation mapping is unchanged");
equal(getAmaraBreathingAnimationPath("amara-breath-heavy-01"), "/video/amara/amara-breathing-heavy.mp4", "heavy animation mapping is unchanged");

console.log(`Amara Phase 2 behavioral rendering validation passed: ${assertions} focused assertions across ${fixtures.length} fixtures.`);

function render(originalText: string) {
  return renderPatientBehavior({ patientId: AMARA_PATIENT_ID, caseId: "case-01", originalText, governedFacts: [], contract: AMARA_BEHAVIORAL_CONTRACT }, () => {
    if (originalText.startsWith("Thank you")) return "I'm ready.";
    return originalText.replace("I am", "I'm").replace("I do not", "I don't");
  });
}
