import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AMARA_BREATH_EFFECT_PATHS,
  buildPatientAudioPlan,
  type AmaraBreathingPlacement,
  type PatientAudioPlan,
} from "../src/lib/patientAudioPlan";

const representative =
  "The swelling started beneath my jaw yesterday. It has spread quickly and swallowing has become much harder for me today.";

assert.deepEqual(buildPatientAudioPlan("case-01", "", 1), []);
assert.deepEqual(buildPatientAudioPlan("case-02", representative, 1), [
  { type: "speech", text: representative },
]);
assert.deepEqual(
  buildPatientAudioPlan("case-01", representative, 12),
  buildPatientAudioPlan("case-01", representative, 12),
  "the same stable inputs always return the same plan",
);

const auditionPlacements = new Map<number, AmaraBreathingPlacement>([
  [4, "speech-only"],
  [0, "moderate-before"],
  [2, "moderate-after"],
  [1, "moderate-between"],
  [11, "heavy-before"],
  [17, "heavy-after"],
  [6, "two-breath"],
]);
for (const [patientTurnIndex, expected] of auditionPlacements) {
  assert.equal(classifyPlacement(buildPatientAudioPlan("case-01", representative, patientTurnIndex)), expected);
}

const observed = new Map<AmaraBreathingPlacement, number>();
let moderateEffects = 0;
let heavyEffects = 0;
const moderateIds = new Set<string>();

for (let patientTurnIndex = 0; patientTurnIndex < 100; patientTurnIndex += 1) {
  const plan = buildPatientAudioPlan("case-01", representative, patientTurnIndex);
  const placement = classifyPlacement(plan);
  observed.set(placement, (observed.get(placement) ?? 0) + 1);

  const effects = plan.filter((segment) => segment.type === "effect");
  const speech = plan
    .filter((segment) => segment.type === "speech")
    .map((segment) => segment.text)
    .join("");
  assert.ok(effects.length <= 2, "at most two breathing effects");
  assert.ok(
    plan.every((segment, index) =>
      segment.type !== "effect" || plan[index + 1]?.type !== "effect"),
    "no consecutive breathing effects",
  );
  assert.equal(speech, representative, "segmented speech reconstructs exactly");

  for (const effect of effects) {
    if (effect.effectId === "amara-breath-heavy-01") heavyEffects += 1;
    else {
      moderateEffects += 1;
      moderateIds.add(effect.effectId);
    }
  }
}

for (const placement of [
  "speech-only",
  "moderate-before",
  "moderate-after",
  "moderate-between",
  "heavy-before",
  "heavy-after",
  "two-breath",
] as const) {
  assert.ok((observed.get(placement) ?? 0) > 0, `${placement} occurs`);
}
assert.ok((observed.get("speech-only") ?? 0) >= 15, "speech-only plans occur regularly");
assert.ok((observed.get("two-breath") ?? 0) <= 10, "two-effect plans remain rare");
assert.ok(heavyEffects > 0 && heavyEffects < moderateEffects, "heavy breathing is occasional and less frequent than moderate breathing");
assert.deepEqual([...moderateIds].sort(), [
  "amara-breath-moderate-01",
  "amara-breath-moderate-02",
]);

for (let patientTurnIndex = 0; patientTurnIndex < 100; patientTurnIndex += 1) {
  const shortText = `Short answer ${patientTurnIndex}.`;
  const plan = buildPatientAudioPlan("case-01", shortText, patientTurnIndex);
  assert.ok(
    plan.filter((segment) => segment.type === "effect").length <= 1,
    "short responses have at most one effect",
  );
  assert.equal(
    plan.filter((segment) => segment.type === "speech").map((segment) => segment.text).join(""),
    shortText,
  );
}

for (const [effectId, publicPath] of Object.entries(AMARA_BREATH_EFFECT_PATHS)) {
  assert.equal(publicPath, `/audio/amara/${effectId}.mp3`);
  const bytes = await readFile(`public${publicPath}`);
  assert.ok(bytes.length > 1_000);
  assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3");
}

console.log("Amara breathing profile validation passed.");
console.log("Observed 100-turn distribution:", Object.fromEntries(observed));

function classifyPlacement(plan: PatientAudioPlan): AmaraBreathingPlacement {
  const effects = plan.filter((segment) => segment.type === "effect");
  if (effects.length === 0) return "speech-only";
  if (effects.length === 2) return "two-breath";
  const effectIndex = plan.findIndex((segment) => segment.type === "effect");
  const isHeavy = effects[0].effectId === "amara-breath-heavy-01";
  if (effectIndex === 0) return isHeavy ? "heavy-before" : "moderate-before";
  if (effectIndex === plan.length - 1) return isHeavy ? "heavy-after" : "moderate-after";
  return "moderate-between";
}
