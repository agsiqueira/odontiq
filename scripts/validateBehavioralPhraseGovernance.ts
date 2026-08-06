import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PATIENT_BEHAVIOR_PROFILES,
  isBehavioralPhraseEligible,
  type BehavioralPhrase,
} from "../src/lib/patientBehavior";
import { PATIENT_QUESTION_CATALOG } from "../src/lib/patientQuestions/catalog";

let assertions = 0;
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };
const forbiddenRemoved = [
  "Can we deal with this soon?", "I'm tired. Can we get through this?", "I need this fixed.", "Can we keep this moving?",
  "Is that bad?", "Am I going to be okay?", "I wasn't sure if I should come in.", "Sorry... it's hard to talk about.",
  "It's manageable.", "I can deal with it.", "I'm tired of this coming back.", "I just want it dealt with.",
  "This keeps happening.", "I need something that actually works.",
];

const governedQuestionTexts = new Set<string>(PATIENT_QUESTION_CATALOG.map((question) => question.text));
for (const profile of PATIENT_BEHAVIOR_PROFILES) {
  for (const phrase of profile.optionalPhrases) {
    check(phrase.contractSupport.trim().length > 0, `${profile.displayName}: ${phrase.text} cites contract support`);
    check(phrase.presentationOnly, `${profile.displayName}: ${phrase.text} is presentation-only`);
    check(!phrase.isQuestion && !phrase.text.trim().endsWith("?"), `${profile.displayName}: ${phrase.text} is not a question`);
    check(!phrase.introducesFact, `${profile.displayName}: ${phrase.text} introduces no fact or history`);
    check(phrase.risks.length === 0, `${profile.displayName}: ${phrase.text} has no unresolved governance risk`);
    check(phrase.allowedPatients.length === 1 && phrase.allowedPatients[0] === profile.patientId, `${profile.displayName}: ${phrase.text} cannot cross patients`);
    check(phrase.allowedStages.length > 0, `${profile.displayName}: ${phrase.text} has explicit stage eligibility`);
    check(!governedQuestionTexts.has(phrase.text), `${profile.displayName}: ${phrase.text} does not duplicate the exact question catalog`);
    for (const stage of phrase.allowedStages) {
      check(isBehavioralPhraseEligible(phrase, { patientId: profile.patientId, stage }), `${profile.displayName}: ${phrase.text} is eligible only through reviewed metadata`);
    }
  }
}

const currentTexts = new Set(PATIENT_BEHAVIOR_PROFILES.flatMap((profile) => profile.optionalPhrases.map((phrase) => phrase.text)));
for (const removed of forbiddenRemoved) check(!currentTexts.has(removed), `risky phrase removed: ${removed}`);

const safeTemplate = PATIENT_BEHAVIOR_PROFILES[0].optionalPhrases[0];
for (const [label, mutation] of [
  ["question", { isQuestion: true }],
  ["question punctuation", { text: "Decorative question?" }],
  ["introduced fact", { introducesFact: true }],
  ["unresolved risk", { risks: ["governed-question-like"] }],
] as const) {
  const candidate = { ...safeTemplate, ...mutation } as unknown as BehavioralPhrase;
  check(!isBehavioralPhraseEligible(candidate, { patientId: "amara-johnson", stage: 1 }), `${label} metadata fails closed`);
}

const route = await readFile("src/app/api/conversation/route.ts", "utf8");
check(/patientQuestionMayBeAdded[\s\S]*behavioralResponse\?\.optionalPhrase[\s\S]*textWithoutOptionalPhrase/.test(route), "optional framing is removed when a governed patient question may be appended");
check(/draftPatientResponse: finalResponseText/.test(route), "patient-question classification retains the accepted-response invariant");
const service = await readFile("src/lib/persistence/services/patientQuestionService.ts", "utf8");
check(/selectedQuestionId[\s\S]*questionText[\s\S]*responseText/.test(service), "catalog-selected exact question remains persistence-owned");
check(/emittedQuestionIds/.test(service), "once-only question state remains persisted");

console.log(`Behavioral phrase-governance validation passed: ${assertions} focused assertions.`);
