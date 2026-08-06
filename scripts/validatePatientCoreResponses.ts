import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASE_DATA } from "../src/data/cases";
import {
  classifyPatientCoreIntent,
  governedPatientCoreResponse,
} from "../src/lib/patientCoreResponse";
import { behavioralContractForCase, renderPatientBehavior } from "../src/lib/patientBehavior";

const identityPhrases = [
  "What is your name?",
  "What's your name?",
  "Tell me your name.",
  "Can you tell me your name?",
  "May I have your name?",
  "Who am I speaking with?",
  "Who are you?",
  "Can you introduce yourself?",
  "What should I call you?",
  "Please confirm your name.",
  "Excuse me, could you please introduce yourself?",
  "WHAT’S YOUR NAME?!",
];
const chiefComplaintPhrases = [
  "What brings you in today?",
  "Why are you here?",
  "What brought you here?",
  "Why did you come in?",
  "Tell me what brought you in.",
  "What seems to be the problem?",
  "What's bothering you today?",
  "Tell me what's going on.",
  "What can I help you with?",
  "What can I help you with today?",
  "What brought you to the emergency department?",
  "Why did you come to the emergency department?",
  "Why did you come to the ER?",
  "What is your main concern today?",
  "What is bothering you most?",
  "So, please tell me what’s going on today.",
];
const uncertainty = /\b(?:i(?:'m| am) not sure about that|i don'?t know,? that'?s why i'?m here)\b/i;

for (const caseData of CASE_DATA) {
  const scriptedChiefComplaint = caseData.conversation.scripted.find(
    (entry) => entry.intent === "chief_complaint",
  )?.response;
  assert.ok(scriptedChiefComplaint, `${caseData.metadata.id} must govern a scripted chief complaint`);

  for (const phrase of identityPhrases) {
    const response = governedPatientCoreResponse(caseData, phrase);
    assert.equal(response?.intent, "patient_identity");
    assert.equal(response?.text, `My name is ${caseData.patient.name}.`);
    assert.doesNotMatch(response!.text, uncertainty);
  }
  for (const phrase of chiefComplaintPhrases) {
    const response = governedPatientCoreResponse(caseData, phrase);
    assert.equal(response?.intent, "chief_complaint");
    assert.equal(response?.text, scriptedChiefComplaint);
    assert.doesNotMatch(response!.text, uncertainty);
  }

  const contract = behavioralContractForCase(caseData.metadata.id);
  if (contract) {
    for (const stage of [1, 2, 3] as const) {
      for (const phrase of [identityPhrases[0], chiefComplaintPhrases[0]]) {
        const originalText = governedPatientCoreResponse(caseData, phrase)!.text;
        const rendered = renderPatientBehavior({
          patientId: contract.patientId,
          caseId: caseData.metadata.id,
          originalText,
          governedFacts: [],
          contract,
          stage,
          finalizedTurnNumber: stage === 1 ? 1 : stage === 2 ? 5 : 9,
          recentPatientResponses: [],
          exactTextRequired: true,
        });
        assert.equal(rendered.text, originalText, `${caseData.metadata.id} ${stage} must preserve core text`);
        assert.equal(rendered.optionalPhrase, undefined);
      }
    }
  }
}

for (const unrelatedIdentityQuestion of [
  "What is your dentist's name?",
  "What is your medication called?",
  "Who brought you here?",
  "What should I call this condition?",
]) {
  assert.equal(classifyPatientCoreIntent(unrelatedIdentityQuestion), undefined);
}
for (const unrelatedOpeningQuestion of [
  "Why are you taking metformin?",
  "What problem did your dentist diagnose?",
  "What brought the swelling on?",
  "What happened after you arrived?",
  "Do you have any allergies?",
  "Can you breathe when lying down?",
]) {
  assert.equal(classifyPatientCoreIntent(unrelatedOpeningQuestion), undefined);
}

const route = readFileSync("src/app/api/conversation/route.ts", "utf8");
const coreIndex = route.indexOf("const coreResponse = governedPatientCoreResponse");
assert.ok(coreIndex > route.indexOf("const languageDetection = detectPatientLanguageIntent"));
assert.ok(coreIndex < route.indexOf("const [priorFinalizedTurnCount"));
assert.ok(coreIndex < route.indexOf("provider = getAIProvider()"));
assert.ok(coreIndex < route.indexOf("patientImmediateResponse({"));
assert.match(route, /providerName: "governed-patient-core"/);
assert.match(route, /baseResponse: coreResponse\.text/);

const encounterClient = readFileSync("src/components/EncounterExperience.tsx", "utf8");
assert.match(encounterClient, /text: data\.response/);
assert.match(encounterClient, /speechPlayback\.speak\(patientConversationMessage\.text/);

console.log(`Validated governed identity and chief-complaint responses for ${CASE_DATA.length} cases.`);
