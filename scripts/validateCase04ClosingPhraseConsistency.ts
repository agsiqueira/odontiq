import assert from "node:assert/strict";

import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  renderPatientBehavior,
  selectBehavioralStage,
  type BehavioralRenderInput,
  type GovernedFact,
} from "../src/lib/patientBehavior";
import { SAFE_PATIENT_BASE_RESPONSE_FALLBACK } from "../src/lib/patientRoleGuard";

const CASE_4_ID = "noah-patel";
const CASE_4_CASE_ID = "case-04";
const BASE_RESPONSE =
  "I am trying to answer your question clearly, but I do not feel well today.";
const contract = behavioralContractForCase(CASE_4_CASE_ID)!;

function renderCase4(
  overrides: Partial<BehavioralRenderInput> = {},
) {
  return renderPatientBehavior({
    patientId: CASE_4_ID,
    caseId: CASE_4_CASE_ID,
    originalText: BASE_RESPONSE,
    governedFacts: [],
    contract,
    stage: 3,
    finalizedTurnNumber: 11,
    recentPatientResponses: [],
    ...overrides,
  });
}

const noahProfile = PATIENT_BEHAVIOR_PROFILES.find(({ patientId }) => patientId === CASE_4_ID)!;
assert.deepEqual(noahProfile.optionalPhrases.map(({ text }) => text), [
  "That's it.",
  "I'm keeping it brief.",
]);
assert.equal(noahProfile.optionalPhrases.some(({ text }) => text === "That's all."), false);
assert.equal(noahProfile.optionalPhrases.some(({ text }) => text === "Plain and simple."), false);

const closureVariants = [
  "That's all.",
  "That’s all.",
  "THAT’S ALL.",
  "Thats all",
  "That's   all!!!",
  "Plain and simple.",
  "Plain & simple.",
  "plain   and simple",
  "That's it.",
  "That’s it!",
  "Im keeping it brief",
  "I’m keeping it brief.",
];

for (const variant of closureVariants) {
  const rendered = renderCase4({
    recentPatientResponses: [
      `A prior model response ended: ${variant}`,
      "A later neutral response contained no closing accent.",
    ],
  });
  assert.equal(
    rendered.optionalPhrase,
    undefined,
    `Closure variant should suppress another Case 4 closure: ${variant}`,
  );
  assert.equal(rendered.optionalPhraseSuppressionReason, "rolling-five-limit");
}

const generatedResponses: string[] = [];
const appendedClosures: Array<string | undefined> = [];
for (let turnIndex = 1; turnIndex <= 36; turnIndex += 1) {
  const rendered = renderCase4({
    stage: selectBehavioralStage(turnIndex),
    finalizedTurnNumber: turnIndex,
    recentPatientResponses: generatedResponses.slice(-5),
  });
  generatedResponses.push(rendered.text);
  appendedClosures.push(rendered.optionalPhrase);
}

assert.equal(
  generatedResponses.some((response) => /that's all|plain and simple/i.test(response)),
  false,
  "Removed Case 4 phrases must never be appended",
);
for (let start = 0; start <= appendedClosures.length - 6; start += 1) {
  const closureCount = appendedClosures
    .slice(start, start + 6)
    .filter(Boolean).length;
  assert.ok(
    closureCount <= 1,
    `At most one closure may appear in rolling turns ${start + 1}-${start + 6}`,
  );
}

const stageOne = renderCase4({ stage: 1, finalizedTurnNumber: 1 });
assert.equal(stageOne.text, BASE_RESPONSE);
assert.equal(stageOne.optionalPhrase, undefined);

for (const turnIndex of [5, 11]) {
  const rendered = renderCase4({
    stage: selectBehavioralStage(turnIndex),
    finalizedTurnNumber: turnIndex,
    recentPatientResponses: ["A model response. That's it."],
  });
  assert.match(rendered.text, /I'm/);
  assert.equal(rendered.optionalPhrase, undefined);
}

const governedCase4Responses = [
  "No, cold does not cause pain now.",
  "Cold hurt the tooth earlier in the illness.",
  "Cold hurt earlier, but it does not cause pain now.",
  "No, I don't have a dentist I can see now.",
  "I don't have a dentist I can see now, so I'll need help arranging follow-up.",
];
for (const governedResponse of governedCase4Responses) {
  const rendered = renderCase4({
    originalText: governedResponse,
    exactTextRequired: true,
    recentPatientResponses: ["A prior response. Plain & simple."],
  });
  assert.equal(rendered.text, governedResponse);
  assert.equal(rendered.optionalPhrase, undefined);
}

const durationFact: GovernedFact = {
  id: "case04-duration",
  canonicalValue: "The returned pain has been getting worse for five days.",
  source: "disclosure-state",
  exactValues: ["five days"],
  certain: true,
  rubricRelevant: true,
};
const factPreservingResponse = renderCase4({
  originalText: "The pain has been getting worse for five days.",
  governedFacts: [durationFact],
  recentPatientResponses: ["A prior response. I’m keeping it brief."],
});
assert.equal(factPreservingResponse.valid, true);
assert.deepEqual(factPreservingResponse.preservedFactIds, [durationFact.id]);
assert.match(factPreservingResponse.text, /five days/i);

const unchangedOtherProfiles = {
  "amara-johnson": [
    "I'm trying to keep going.",
    "I'm exhausted.",
    "This is wearing me down.",
    "I just want this taken care of.",
  ],
  "marcus-lee": [
    "That makes me nervous.",
    "I'm kind of worried.",
    "That sounds serious.",
    "I'm worried about this.",
  ],
  "elena-garcia": [
    "It's a little embarrassing.",
    "It's hard to explain.",
    "I'm trying to explain it.",
    "I'm uncomfortable talking about it.",
  ],
  "sofia-williams": [
    "This is frustrating.",
    "I'm tired of dealing with this.",
    "This is wearing on me.",
    "I'm frustrated with this.",
  ],
};
for (const [patientId, optionalPhrases] of Object.entries(unchangedOtherProfiles)) {
  assert.deepEqual(
    PATIENT_BEHAVIOR_PROFILES.find((profile) => profile.patientId === patientId)?.optionalPhrases.map(({ text }) => text),
    optionalPhrases,
  );
}

assert.equal(SAFE_PATIENT_BASE_RESPONSE_FALLBACK, "I'm not sure about that.");

console.log("Case 4 closing-phrase consistency validation passed.");
