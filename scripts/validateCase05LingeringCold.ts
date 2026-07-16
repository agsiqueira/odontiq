import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import {
  sendMessage,
  type ConversationMessage,
} from "../src/lib/conversationEngine";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";

const caseData = loadCase("case-05")!;
assert(caseData, "Case 5 must exist");

const coldTriggerFact = "Cold drinks worsen the pain.";
const lingeringFact =
  "The pain does not stop immediately after the cold is removed; it lingers for a little while afterward.";

function visibleFacts(question: string, conversation: ConversationMessage[] = []) {
  return buildPatientDisclosureState({
    caseData,
    conversation,
    latestStudentMessage: question,
  }).allowedThisTurn.map((fact) => fact.text);
}

assert.deepEqual(
  visibleFacts("Does cold make it hurt?"),
  [coldTriggerFact],
  "A direct cold-trigger question should reveal only that cold worsens the pain",
);

assert.deepEqual(
  visibleFacts("Does the pain stop as soon as the cold is gone?"),
  [lingeringFact],
  "An immediate-resolution follow-up should reveal lingering pain",
);

assert.deepEqual(
  visibleFacts("How long does the pain last after drinking something cold?"),
  [lingeringFact],
  "A duration follow-up should reveal the qualitative duration without inventing a number",
);

assert.deepEqual(
  visibleFacts("Once the chilly drink is gone, does the ache keep going?"),
  [lingeringFact],
  "Semantically equivalent wording should reveal lingering pain",
);

assert.deepEqual(
  visibleFacts("Is it sensitive to hot or cold?"),
  [coldTriggerFact],
  "A combined thermal question should reveal only the canonically supported cold trigger",
);

assert.deepEqual(
  visibleFacts("What happens when you drink something cold?"),
  [coldTriggerFact, lingeringFact],
  "An open question about the response to cold should reveal both the trigger and its persistence",
);

assert.deepEqual(
  visibleFacts("What makes the pain worse?"),
  [coldTriggerFact, "Chewing on the affected side is uncomfortable.", "There is slight biting and percussion discomfort."],
  "A provoking-factor question should reveal supported cold and chewing or biting triggers without volunteering persistence",
);

assert.deepEqual(
  visibleFacts("Cold sensitivity is common with this condition."),
  [],
  "A provider statement mentioning cold must not unlock patient facts",
);

const firstQuestion = "Does cold make it hurt?";
const conversation: ConversationMessage[] = [
  {
    id: "student-1",
    role: "student",
    text: firstQuestion,
    timestamp: "2026-07-16T10:00:00.000Z",
  },
  {
    id: "patient-1",
    role: "patient",
    text: "Cold drinks make it hurt more.",
    timestamp: "2026-07-16T10:00:01.000Z",
  },
];
const followUpState = buildPatientDisclosureState({
  caseData,
  conversation,
  latestStudentMessage: "Does it stop right away after the cold is removed?",
});
assert.deepEqual(followUpState.allowedThisTurn.map((fact) => fact.text), [lingeringFact]);
assert(
  followUpState.alreadyDisclosed.some((fact) => fact.text === coldTriggerFact),
  "The prior cold-trigger fact should remain available for continuity",
);
assert(
  !followUpState.allowedThisTurn.some(
    (fact) =>
      /reliev|calm/i.test(fact.text) ||
      /(?<!not )stop(?:s|ped)? immediately/i.test(fact.text),
  ),
  "The follow-up must not expose a contradictory cold-relief fact",
);

const canonicalColdText = [
  ...caseData.conversation.scripted.map((script) => script.response),
  ...caseData.supportingInfo.hpiFacts,
].filter((text) => /cold/i.test(text));
assert(canonicalColdText.length > 0, "Case 5 should contain canonical cold facts");
assert(
  canonicalColdText.every((text) => !/\b\d+\s*(?:seconds?|minutes?)\b/i.test(text)),
  "Case 5 must not invent an unsupported precise lingering duration",
);
assert(
  canonicalColdText.every((text) => !/cold.*(?:reliev|calm)|(?:reliev|calm).*cold/i.test(text)),
  "Case 5 must not retain the contradictory cold-relief behavior",
);

assert.equal(
  sendMessage("case-05", "Does cold make it hurt?", []).patientMessage,
  "Cold drinks make it hurt more.",
);
assert.equal(
  sendMessage("case-05", "Does it stop right away after the cold is gone?", []).patientMessage,
  "It doesn't stop right away. It keeps hurting for a little while after the cold is gone.",
);
assert.equal(
  sendMessage("case-05", "How long does the pain last after drinking cold?", []).patientMessage,
  "It doesn't stop right away. It keeps hurting for a little while after the cold is gone.",
);

console.log("Case 5 lingering-cold validation passed.");
