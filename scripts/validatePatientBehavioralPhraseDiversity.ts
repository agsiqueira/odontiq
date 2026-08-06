import assert from "node:assert/strict";
import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  renderPatientBehavior,
  selectBehavioralStage,
} from "../src/lib/patientBehavior";

const ORIGINALS = [
  "I am trying to answer, but I do not feel well today.",
  "Four days.",
  "The discomfort has been getting worse since I first noticed it.",
  "I have been dealing with this problem and I want some help.",
  "It is difficult to describe, but the discomfort has continued.",
  "No, I am not having trouble breathing.",
  "I take metformin and lisinopril.",
  "I have answered as clearly as I can about what happened.",
  "The problem has continued and it has been difficult to manage.",
  "I am doing my best to explain what I have noticed.",
  "This has been bothering me and I would like it addressed.",
  "That is everything I can tell you about the problem right now.",
] as const;

let assertions = 0;
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual: unknown, expected: unknown, message: string) => { assertions += 1; assert.deepEqual(actual, expected, message); };

const transcriptPhrases = new Map<string, string[]>();
for (const profile of PATIENT_BEHAVIOR_PROFILES) {
  const contract = behavioralContractForCase(profile.caseId);
  assert.ok(contract);
  const responses: string[] = [];
  const phrases: string[] = [];
  const stages: number[] = [];
  for (let index = 0; index < ORIGINALS.length; index += 1) {
    const turn = index + 1;
    const input = {
      patientId: profile.patientId,
      caseId: profile.caseId,
      originalText: ORIGINALS[index],
      governedFacts: [],
      contract,
      stage: selectBehavioralStage(turn),
      finalizedTurnNumber: turn,
      recentPatientResponses: responses.slice(-5),
    } as const;
    const first = renderPatientBehavior(input);
    const second = renderPatientBehavior(input);
    equal(first.text, second.text, `${profile.displayName} turn ${turn} selection is deterministic`);
    equal(first.optionalPhrase, second.optionalPhrase, `${profile.displayName} turn ${turn} phrase is deterministic`);
    responses.push(first.text);
    phrases.push(first.optionalPhrase ?? "");
    stages.push(first.stage ?? 0);
  }

  transcriptPhrases.set(profile.patientId, phrases.filter(Boolean));
  console.log(`${profile.displayName} optional accents: ${phrases.map((phrase, index) => phrase ? `turn ${index + 1}: ${phrase}` : "").filter(Boolean).join(" | ") || "none"}`);
  equal(stages, [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], `${profile.displayName} retains stage boundaries`);
  check(phrases.filter(Boolean).length > 0, `${profile.displayName} has an occasional personality accent`);
  check(phrases.filter(Boolean).length < 6, `${profile.displayName} uses accents on fewer than half of responses`);
  check(phrases.slice(0, 4).filter(Boolean).length <= 1, `${profile.displayName} uses minimal Stage 1 framing`);
  check(phrases.slice(4, 8).filter(Boolean).length >= 1, `${profile.displayName} uses occasional Stage 2 framing`);
  check(phrases.slice(8).filter(Boolean).length >= 1 && phrases.slice(8).filter(Boolean).length <= 2, `${profile.displayName} uses occasional, non-majority Stage 3 framing`);
  equal(phrases[1], "", `${profile.displayName} keeps the short duration answer short`);
  equal(phrases[5], "", `${profile.displayName} keeps the safety answer unframed`);
  equal(phrases[6], "", `${profile.displayName} keeps the medication list unframed`);
  for (let index = 1; index < phrases.length; index += 1) {
    check(!(phrases[index] && phrases[index - 1]), `${profile.displayName} has no consecutive accents at turn ${index + 1}`);
  }
  for (let index = 0; index < phrases.length; index += 1) {
    const previousThree = phrases.slice(Math.max(0, index - 3), index).filter(Boolean);
    check(!phrases[index] || !previousThree.includes(phrases[index]), `${profile.displayName} does not reuse a phrase within three prior turns`);
    check(phrases.slice(Math.max(0, index - 4), index + 1).filter(Boolean).length <= 2, `${profile.displayName} respects the rolling five-turn cap`);
  }
}

check(transcriptPhrases.get("amara-johnson")?.some((phrase) => /taken care|exhausted|wearing|keep going/.test(phrase)), "Amara remains treatment-focused or exhausted");
check(transcriptPhrases.get("marcus-lee")?.every((phrase) => /nervous|serious|worried/.test(phrase)), "Marcus remains anxious, not impatient");
check(transcriptPhrases.get("elena-garcia")?.every((phrase) => /embarrassing|explain|uncomfortable/.test(phrase)), "Elena remains hesitant, not rude");
check(transcriptPhrases.get("noah-patel")?.every((phrase) => /it|all|brief|simple/.test(phrase)), "Noah remains stoic, not impatient");
check(transcriptPhrases.get("sofia-williams")?.every((phrase) => /this|it/i.test(phrase)), "Sofia's frustration remains condition-focused");

const amaraContract = behavioralContractForCase("case-01")!;
const repeated = renderPatientBehavior({ patientId: "amara-johnson", caseId: "case-01", originalText: ORIGINALS[8], governedFacts: [], contract: amaraContract, stage: 3, finalizedTurnNumber: 9, recentPatientResponses: [], repetition: { level: "later_repeat", clarificationSafe: false, countsTowardHistory: true, reason: "semantic-repeat" } });
equal(repeated.optionalPhrase, undefined, "repetition-aware answer receives no duplicate personality accent");
equal(repeated.optionalPhraseSuppressionReason, "repetition-already-styled", "repetition suppression is explicit");

for (const governed of ["I speak English. Ask me in English.", "I only speak English. Ask me in English.", "No. English. Ask me what you need."]) {
  const result = renderPatientBehavior({ patientId: "amara-johnson", caseId: "case-01", originalText: governed, governedFacts: [], contract: amaraContract, stage: 3, finalizedTurnNumber: 9, recentPatientResponses: [], exactTextRequired: true });
  equal(result.text, governed, "language or exact governed response remains unchanged");
}

console.log(`Cross-patient behavioral phrase-diversity validation passed: ${assertions} assertions across five 12-turn transcripts.`);
