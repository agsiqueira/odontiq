import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assessPatientRole,
  SAFE_PATIENT_ROLE_FALLBACK,
} from "../src/lib/patientRoleGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";

const patientLines = [
  "My lower-left tooth has been hurting for four days.",
  "Will I need to take antibiotics?",
  "Should I see a dentist today?",
  SAFE_PATIENT_ROLE_FALLBACK,
];
for (const line of patientLines) {
  assert.equal(assessPatientRole(line).valid, true, line);
}

const providerLines = [
  "You have an abscess and need antibiotics.",
  "I'm prescribing amoxicillin for seven days.",
  "I recommend that you see an oral surgeon.",
  "As your dentist, I think this tooth needs extraction.",
];
for (const line of providerLines) {
  assert.equal(assessPatientRole(line).valid, false, line);
}

const encounterSource = readFileSync(
  new URL("../src/components/EncounterExperience.tsx", import.meta.url),
  "utf8",
);
assert.match(
  encounterSource,
  /if \(!serverEncounterId\) \{[\s\S]*completeLocallyAndShowFeedback\(\);/,
  "A database outage before encounter creation must not block local completion",
);
assert.match(
  encounterSource,
  /catch \{[\s\S]*completeLocallyAndShowFeedback\(\);/,
  "A non-conflict persistence failure must still route to local feedback",
);

let retryCount = 0;
const repaired = await generatePatientRoleSafeResponse({
  initialOutput: "You have an abscess and need antibiotics.",
  retry: async () => {
    retryCount += 1;
    return "Will I need to take antibiotics?";
  },
});
assert.equal(retryCount, 1, "provider-role drift gets exactly one corrective retry");
assert.equal(repaired.text, "Will I need to take antibiotics?");
assert.notEqual(repaired.text, "You have an abscess and need antibiotics.");

retryCount = 0;
const fallback = await generatePatientRoleSafeResponse({
  initialOutput: "I recommend that you see an oral surgeon.",
  retry: async () => {
    retryCount += 1;
    return "I'm prescribing amoxicillin for seven days.";
  },
});
assert.equal(retryCount, 1);
assert.equal(fallback.text, SAFE_PATIENT_ROLE_FALLBACK);
assert.doesNotMatch(fallback.text, /abscess|antibiotic|amoxicillin|surgery/i);
assert.equal(assessPatientRole(fallback.text).valid, true);

console.log("Production incident regression validation passed.");
