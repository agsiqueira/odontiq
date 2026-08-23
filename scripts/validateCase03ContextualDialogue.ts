import assert from "node:assert/strict";

import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  renderPatientBehavior,
  selectBehavioralStage,
  type GovernedFact,
} from "../src/lib/patientBehavior";
import { SAFE_PATIENT_BASE_RESPONSE_FALLBACK } from "../src/lib/patientRoleGuard";

const contract = behavioralContractForCase("case-03")!;
const authoredHesitation = /It's a little embarrassing\.|It's hard to explain\.|I'm trying to explain it\.|I'm uncomfortable talking about it\./;
const sensitiveFamily = /embarrassing|uncomfortable talking/i;
const explanatoryFamily = /hard to explain|trying to explain/i;

function normalizeContractions(text: string) {
  return text.toLowerCase()
    .replace(/i'm/g, "i am")
    .replace(/don't/g, "do not");
}

function fact(id: string, canonicalValue: string): GovernedFact {
  return {
    id,
    canonicalValue,
    source: "disclosure-state",
    rubricRelevant: false,
  };
}

function renderAtTurn(
  turn: number,
  originalText: string,
  governedFacts: readonly GovernedFact[],
  recentPatientResponses: readonly string[] = [],
  exactTextRequired = false,
) {
  return renderPatientBehavior({
    patientId: "elena-garcia",
    caseId: "case-03",
    originalText,
    governedFacts,
    contract,
    stage: selectBehavioralStage(turn),
    finalizedTurnNumber: turn,
    recentPatientResponses,
    exactTextRequired,
  });
}

const suppressedContexts: Array<[string, string]> = [
  ["c3.location", "The pain is in my lower-right back tooth."],
  ["c3.duration", "It has been getting worse for three days."],
  ["c3.biting", "Biting or chewing on that tooth causes sharp pain."],
  ["c3.pepcid", "I take Pepcid as needed."],
  ["c3.prior-antibiotics-unknown", "I don't remember whether I took antibiotics before coming in."],
  ["c3.prior-acetaminophen-unknown", "I don't remember whether I took Tylenol before coming in."],
  ["c3.nkda", "I have no known drug allergies, including no penicillin allergy."],
  ["c3.ibuprofen", "Ibuprofen upsets my stomach, so I avoid it."],
  ["c3.breathing", "No, I have no trouble breathing."],
  ["c3.dentist-contact", "I called my dentist a couple of days ago."],
  ["c3.appointment", "I have an appointment with my dentist next week."],
];
for (const [id, text] of suppressedContexts) {
  for (let turn = 1; turn <= 12; turn += 1) {
    assert(!authoredHesitation.test(renderAtTurn(turn, text, [fact(id, text)]).text), `${id} turn ${turn}`);
  }
}

for (const text of [
  "Okay, I understand the treatment plan.",
  "Okay, I understand that antibiotics are planned.",
  "Okay, I understand the pain medicine plan.",
  "Okay, I understand that you want a CT scan.",
  "Okay, I understand the referral and disposition plan.",
  "Okay, I understand what happens next.",
]) {
  for (let turn = 1; turn <= 12; turn += 1) {
    assert(!authoredHesitation.test(renderAtTurn(turn, text, []).text), `${text} turn ${turn}`);
  }
}

const permittedContexts: Array<[string, string, RegExp, RegExp]> = [
  ["c3.opioid-negative", "No, I have no history of opioid use or misuse.", sensitiveFamily, explanatoryFamily],
  ["c3.illicit-drugs-negative", "No, I do not use illicit drugs.", sensitiveFamily, explanatoryFamily],
  ["c3.pain-quality", "The pain is constant and throbbing, and it is difficult to describe.", explanatoryFamily, sensitiveFamily],
  ["c3.radiation", "The pain travels from the tooth toward my right ear.", explanatoryFamily, sensitiveFamily],
  ["c3.rct", "I am not sure whether that tooth had a root canal before.", explanatoryFamily, sensitiveFamily],
  ["c3.treated-teeth-unknown", "I do not remember exactly which teeth were treated before.", explanatoryFamily, sensitiveFamily],
];
for (const [id, text, allowed, forbidden] of permittedContexts) {
  const decorated = Array.from({ length: 12 }, (_, index) =>
    renderAtTurn(index + 1, text, [fact(id, text)]).text,
  ).filter((response) => authoredHesitation.test(response));
  assert(decorated.length > 0, `${id} retains occasional personality expression`);
  assert(decorated.every((response) => allowed.test(response)), `${id} uses its permitted phrase family`);
  assert(decorated.every((response) => !forbidden.test(response)), `${id} excludes the other phrase family`);
  assert(
    decorated.every((response) => normalizeContractions(response).startsWith(normalizeContractions(text))),
    `${id} preserves its fact text`,
  );
}

const responses: string[] = [];
const sensitiveText = "No, I have no history of opioid use or misuse.";
for (let turn = 1; turn <= 20; turn += 1) {
  responses.push(renderAtTurn(
    turn,
    sensitiveText,
    [fact("c3.opioid-negative", sensitiveText)],
    responses.slice(-5),
  ).text);
}
for (let index = 0; index < responses.length; index += 1) {
  assert(
    responses.slice(Math.max(0, index - 4), index + 1).filter((response) => authoredHesitation.test(response)).length <= 1,
    `turn ${index + 1} respects the family-level five-response limit`,
  );
}

const exactText = "No, I have no known drug allergies, including no penicillin allergy.";
assert.equal(renderAtTurn(10, exactText, [fact("c3.nkda", exactText)], [], true).text, exactText);
assert.deepEqual(
  [1, 4, 5, 8, 9, 30].map((turn) => selectBehavioralStage(turn)),
  [1, 1, 2, 2, 3, 3],
);

for (const profile of PATIENT_BEHAVIOR_PROFILES.filter((item) => item.caseId !== "case-03")) {
  const otherContract = behavioralContractForCase(profile.caseId)!;
  const hasAccent = Array.from({ length: 12 }, (_, index) => renderPatientBehavior({
    patientId: profile.patientId,
    caseId: profile.caseId,
    originalText: "I am trying to answer, but this has been difficult to manage.",
    governedFacts: [],
    contract: otherContract,
    stage: selectBehavioralStage(index + 1),
    finalizedTurnNumber: index + 1,
    recentPatientResponses: [],
  })).some((result) => Boolean(result.optionalPhrase));
  assert(hasAccent, `${profile.displayName} cadence remains active`);
}

const wrongCase = renderPatientBehavior({
  patientId: "elena-garcia",
  caseId: "case-02",
  originalText: "I am trying to explain what has been happening.",
  governedFacts: [fact("c3.pain-quality", "I am trying to explain what has been happening.")],
  contract,
  stage: 3,
  finalizedTurnNumber: 10,
});
assert.equal(wrongCase.text, "I am trying to explain what has been happening.");
assert.equal(SAFE_PATIENT_BASE_RESPONSE_FALLBACK, "I'm not sure about that.");

console.log("Case 3 contextual-dialogue validation passed.");
