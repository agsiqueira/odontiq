import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  encounterOnboardingContent,
  shouldShowEncounterOnboarding,
} from "../src/lib/encounterOnboarding";

assert.equal(
  shouldShowEncounterOnboarding({
    hasLocalSnapshot: false,
    hasActiveServerEncounter: false,
  }),
  true,
  "A genuinely new encounter must show onboarding.",
);
for (const resumeState of [
  { hasLocalSnapshot: true, hasActiveServerEncounter: false },
  { hasLocalSnapshot: false, hasActiveServerEncounter: true },
  { hasLocalSnapshot: true, hasActiveServerEncounter: true },
]) {
  assert.equal(
    shouldShowEncounterOnboarding(resumeState),
    false,
    "A resumed encounter must bypass onboarding.",
  );
}

const onboardingText = [
  encounterOnboardingContent.introduction,
  ...encounterOnboardingContent.steps.flatMap((step) => [
    step.title,
    step.description,
  ]),
].join(" ");
for (const requiredText of [
  "message field",
  "Exam",
  "Examination",
  "follow-up questions",
  "Finish Consultation",
  "performance report",
]) {
  assert.match(onboardingText, new RegExp(requiredText, "i"), requiredText);
}
assert.doesNotMatch(
  onboardingText,
  /diagnos|antibiotic|npo|omfs|allerg|fever|score|weight|threshold|medal/i,
  "Onboarding must not reveal clinical answers or scoring details.",
);

const componentSource = readFileSync(
  resolve("src/components/EncounterOnboarding.tsx"),
  "utf8",
);
assert.match(componentSource, /aria-labelledby=/);
assert.match(componentSource, /aria-describedby=/);
assert.match(componentSource, /aria-busy=/);
assert.match(componentSource, /autoFocus/);
assert.match(componentSource, /disabled=\{isStarting\}/);
assert.match(componentSource, /role="alert"/);
assert.match(componentSource, /href="\/cases"/);

const experienceSource = readFileSync(
  resolve("src/components/EncounterExperience.tsx"),
  "utf8",
);
assert.match(experienceSource, /readEncounterSnapshot\(patientCase\.id\)/);
assert.match(experienceSource, /fetch\("\/api\/home\/progression"\)/);
assert.match(experienceSource, /entryStatus !== "active"/);
assert.match(experienceSource, /startRequestedRef\.current/);
assert.match(experienceSource, /if \(entryStatus === "onboarding"\)/);
assert.match(experienceSource, /await syncServerEncounter\(\)/);

console.log("Phase 7 encounter-onboarding validation passed.");
