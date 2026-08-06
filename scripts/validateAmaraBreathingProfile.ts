import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AMARA_BREATH_EFFECT_PATHS,
  buildPatientAudioPlan,
  type PatientAudioPlan,
} from "../src/lib/patientAudioPlan";

const cases: Array<[string, PatientAudioPlan]> = [
  ["", []],
  [
    "Yes, it hurts.",
    [
      { type: "effect", effectId: "amara-breath-moderate-02" },
      { type: "speech", text: "Yes, it hurts." },
    ],
  ],
  [
    "Yes, the swelling has become much worse since yesterday morning.",
    [
      { type: "effect", effectId: "amara-breath-heavy-01" },
      {
        type: "speech",
        text: "Yes, the swelling has become much worse since yesterday morning.",
      },
    ],
  ],
];

for (const [response, expected] of cases) {
  assert.deepEqual(buildPatientAudioPlan("case-01", response), expected);
}

const longResponse =
  "The swelling started beneath my jaw yesterday. It has spread quickly and swallowing has become much harder for me today.";
const longPlan = buildPatientAudioPlan("case-01", longResponse);
assert.deepEqual(longPlan, [
  { type: "effect", effectId: "amara-breath-heavy-01" },
  { type: "speech", text: "The swelling started beneath my jaw yesterday." },
  { type: "effect", effectId: "amara-breath-moderate-01" },
  {
    type: "speech",
    text: " It has spread quickly and swallowing has become much harder for me today.",
  },
]);

const oneSentence =
  "The swelling beneath my jaw has spread quickly since yesterday and swallowing even small sips of water has become much harder for me today.";
assert.deepEqual(buildPatientAudioPlan("case-01", oneSentence), [
  { type: "effect", effectId: "amara-breath-heavy-01" },
  { type: "speech", text: oneSentence },
]);

for (const response of ["   ", "Short answer.", longResponse, oneSentence]) {
  const plan = buildPatientAudioPlan("case-01", response);
  const effects = plan.filter((segment) => segment.type === "effect");
  const speech = plan
    .filter((segment) => segment.type === "speech")
    .map((segment) => segment.text)
    .join("");

  assert.ok(effects.length <= 2, "at most two breathing effects");
  assert.notEqual(plan.at(-1)?.type, "effect", "no trailing breath");
  assert.ok(
    plan.every(
      (segment, index) =>
        segment.type !== "effect" || plan[index + 1]?.type !== "effect",
    ),
    "no consecutive breathing effects",
  );
  assert.equal(speech, response.trim() ? response : "", "speech is exact");
}

assert.deepEqual(buildPatientAudioPlan("case-02", "Yes, it hurts."), [
  { type: "speech", text: "Yes, it hurts." },
]);

for (const [effectId, publicPath] of Object.entries(AMARA_BREATH_EFFECT_PATHS)) {
  assert.equal(
    publicPath,
    `/audio/amara/${effectId}.mp3`,
    `${effectId} has the canonical static path`,
  );
  const bytes = await readFile(`public${publicPath}`);
  assert.ok(bytes.length > 1_000, `${effectId} is non-empty audio`);
  assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3", `${effectId} is an MP3`);
}

console.log("Amara breathing profile validation passed.");
