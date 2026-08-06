import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import case01 from "../src/data/cases/case-01/case.json";
import {
  AMARA_BEHAVIORAL_CONTRACT,
  AMARA_PATIENT_ID,
  IMMUTABLE_RESPONSE_ELEMENTS,
  MUTABLE_RESPONSE_ELEMENTS,
  renderPatientBehavior,
  validateFactPreservation,
  type GovernedFact,
} from "../src/lib/patientBehavior";
import { buildPatientAudioPlan } from "../src/lib/patientAudioPlan";
import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";

assert.equal(AMARA_BEHAVIORAL_CONTRACT.patientId, AMARA_PATIENT_ID);
assert.ok(AMARA_BEHAVIORAL_CONTRACT.traits.includes("exhausted"));
assert.ok(AMARA_BEHAVIORAL_CONTRACT.traits.includes("terse"));
assert.ok(AMARA_BEHAVIORAL_CONTRACT.allowedTransformations.includes("reduce-politeness"));
assert.ok(AMARA_BEHAVIORAL_CONTRACT.forbiddenTransformations.includes("change-or-weaken-case-defined-facts"));
assert.ok(AMARA_BEHAVIORAL_CONTRACT.forbiddenTransformations.includes("invent-sleep-history-or-sleep-disruption"));
assert.ok(AMARA_BEHAVIORAL_CONTRACT.escalationRules.includes("remain-cooperative-for-safety-critical-and-clinically-relevant-questions"));
assert.ok(IMMUTABLE_RESPONSE_ELEMENTS.includes("rubric-relevant-disclosures"));
assert.ok(IMMUTABLE_RESPONSE_ELEMENTS.includes("unsupported-question-boundaries"));
assert.ok(MUTABLE_RESPONSE_ELEMENTS.includes("contractions"));
assert.ok(MUTABLE_RESPONSE_ELEMENTS.includes("mild-irritation"));

const duration = governed("c1.duration", "The dental pain has been worsening for four days.", {
  exactValues: ["four days"], rubricRelevant: true,
});
const severity = governed("c1.severity", "The pain is 8/10 now.", {
  exactValues: ["8/10"], rubricRelevant: true,
});
const location = governed("c1.location", "The painful tooth is my lower-left molar.", {
  requiredTerms: ["lower-left"], rubricRelevant: true,
});
const dyspnea = governed("c1.dyspnea", "Yes, I feel short of breath.", {
  requiredTerms: ["short of breath"], polarity: "positive", rubricRelevant: true,
});
const upright = governed("c1.upright-breathing", "No, I am not short of breath while sitting upright.", {
  requiredTerms: ["short of breath"], polarity: "negative", rubricRelevant: true,
});
const medication = governed("c1.metformin", "I take metformin.", {
  requiredTerms: ["metformin"], rubricRelevant: true,
});
const allergy = governed("c1.nkda", "I have no known drug allergies, including no penicillin allergy.", {
  requiredTerms: ["drug allergies", "penicillin"], polarity: "negative", rubricRelevant: true,
});

rejects(duration, "The dental pain has been worsening for three days.", "date-or-duration-changed");
rejects(duration, "The dental pain has been worsening for three or four days.", "certainty-weakened");
rejects(severity, "The pain is 7/10 now.", "numeric-value-changed");
rejects(location, "The painful tooth is my lower-right molar.", "location-changed");
rejects(dyspnea, "No, I am not short of breath.", "symptom-polarity-changed");
rejects(upright, "Yes, I am short of breath while sitting upright.", "symptom-polarity-changed");
rejects(medication, "I take insulin.", "medication-or-allergy-changed");
rejects(allergy, "I am allergic to penicillin.", "symptom-polarity-changed");
rejects(dyspnea, "Maybe I feel short of breath.", "certainty-weakened");
rejects(dyspnea, "I feel unwell.", "rubric-disclosure-removed");

const governedQuestion = governed(
  "c1-extraction-question",
  "Will they pull out the bad tooth?",
  { exactTextRequired: true },
);
rejects(governedQuestion, "Are they going to remove the tooth?", "exact-text-changed");

const styleOriginal = "No, I do not have chest pain.";
const styleFact = governed("c1.chest-pain", styleOriginal, {
  requiredTerms: ["chest pain"], polarity: "negative",
});
assert.equal(validateFactPreservation({
  originalText: styleOriginal,
  candidateText: "No—I don't have chest pain!",
  governedFacts: [styleFact],
}).valid, true, "punctuation and contractions are mutable when facts are preserved");

const passThroughInput = {
  patientId: AMARA_PATIENT_ID,
  caseId: "case-01",
  originalText: duration.canonicalValue,
  governedFacts: [duration],
  contract: AMARA_BEHAVIORAL_CONTRACT,
};
const passThrough = renderPatientBehavior(passThroughInput);
assert.equal(passThrough.text, passThroughInput.originalText);
assert.equal(passThrough.valid, true);
assert.equal(passThrough.usedFallback, false);

const fallback = renderPatientBehavior(passThroughInput, () => "It has been three days.");
assert.equal(fallback.text, passThroughInput.originalText);
assert.equal(fallback.valid, false);
assert.equal(fallback.usedFallback, true);

const nonAmaraText = "Yes, it hurts.";
assert.equal(nonAmaraText, renderPatientBehavior({
  ...passThroughInput,
  patientId: "another-patient",
  caseId: "case-02",
  originalText: nonAmaraText,
  governedFacts: [],
}).text);

const originalAudioPlan = buildPatientAudioPlan("case-01", duration.canonicalValue, 3);
const governedAudioPlan = buildPatientAudioPlan("case-01", passThrough.text, 3);
assert.deepEqual(governedAudioPlan, originalAudioPlan, "audioPlan receives unchanged speech text");

assert.equal(getPatientQuestion("c1-extraction-question")?.text, "Will they pull out the bad tooth?");
const unsupported = patientImmediateResponse({
  caseId: "case-01",
  message: "Does bright sunlight make the pain worse?",
  disclosureState: {
    alreadyDisclosed: [], allowedThisTurn: [], latestTopics: [], isBroadQuestion: false,
    asksRestrictedClinicalInterpretation: false, providerMessageIntent: "other",
  },
});
assert.equal(unsupported, "I haven't noticed that.");

const route = await readFile("src/app/api/conversation/route.ts", "utf8");
assert.match(route, /originalText: safeResponse\.text/);
assert.match(route, /baseResponse: finalResponseText/);
assert.match(route, /draftPatientResponse: finalResponseText/);
assert.match(route, /payload\.caseId === "case-01"/);
const encounter = await readFile("src/components/EncounterExperience.tsx", "utf8");
assert.match(encounter, /text: data\.response/);
assert.match(encounter, /speechPlayback\.speak\(patientConversationMessage\.text/);
assert.equal(case01.conversation.scripted.find((entry) => entry.id === "c1-duration")?.response,
  "The tooth pain has been getting worse for four days.");

console.log("Amara behavioral framework validation passed: 37 focused assertions.");

function governed(
  id: string,
  canonicalValue: string,
  options: Partial<GovernedFact> = {},
): GovernedFact {
  return {
    id,
    canonicalValue,
    source: "case-definition",
    certain: true,
    rubricRelevant: false,
    ...options,
  };
}

function rejects(
  fact: GovernedFact,
  candidateText: string,
  expectedCode: string,
) {
  const result = validateFactPreservation({
    originalText: fact.canonicalValue,
    candidateText,
    governedFacts: [fact],
  });
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.code === expectedCode),
    `expected ${expectedCode}, got ${result.violations.map((violation) => violation.code).join(", ")}`);
}
