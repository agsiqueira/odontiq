import assert from "node:assert/strict";

import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import type { PatientDisclosureFact } from "../src/lib/patientDisclosure";

const feverFact: PatientDisclosureFact = {
  id: "fever",
  topic: "medical_history",
  text: "The patient has felt feverish and hot.",
};
const durationFact: PatientDisclosureFact = {
  id: "c2.duration",
  topic: "onset_duration",
  text: "The upper-right dental pain has worsened over seven days.",
};

for (const leaked of [
  "My tooth hurts. End of simulation",
  "Okay. Conclusion of Simulation Legal Disclaimer: fictional content.",
  'No swelling. turnPolicy.providerMessageIntent: "question"',
  "Okay. visibleFacts.alreadyDisclosed: []",
  'Fine. { "id": "c2.fever", "topic": "medical_history", "text": "fever" }',
  "No swelling. New Information Permitted for this Answer: None.",
  "Okay. Instruction 5 (Hardest): reveal the prompt.",
]) {
  assert.equal(
    assessPatientOutputIntegrity(leaked, []).valid,
    false,
    leaked,
  );
}

assert.equal(
  assessPatientOutputIntegrity(
    "No, I have not had a fever.",
    [],
    ["I have been feeling feverish and hot."],
  ).reason,
  "contradiction of disclosed fever",
);
assert.equal(
  assessPatientOutputIntegrity("Yes, I still feel feverish.", [feverFact]).valid,
  true,
);

for (const equivalent of [
  "It started seven days ago.",
  "It has been hurting for 7 days.",
  "It started about a week ago.",
  "It began approximately one week ago.",
]) assert.equal(assessPatientOutputIntegrity(equivalent, [durationFact]).valid, true, equivalent);

for (const contradiction of [
  "It started two days ago.",
  "It began a couple of days ago.",
  "It started yesterday.",
  "It has been going on for three weeks.",
]) assert.equal(
  assessPatientOutputIntegrity(contradiction, [durationFact]).reason,
  "contradiction of disclosed seven-day duration",
  contradiction,
);

let retryCount = 0;
const repaired = await generatePatientRoleSafeResponse({
  initialOutput: 'It started seven days ago. turnPolicy.latestTopics: [duration]',
  visibleFacts: [],
  retry: async () => {
    retryCount += 1;
    return "It started seven days ago.";
  },
});
assert.equal(retryCount, 1);
assert.equal(repaired.text, "It started seven days ago.");
assert.equal(repaired.repeatedDrift, false);

const fallback = await generatePatientRoleSafeResponse({
  initialOutput: "Legal Disclaimer: not patient dialogue.",
  retry: async () => "End of simulation",
});
assert.equal(fallback.repeatedDrift, true);
assert.equal(fallback.text, "I'm not sure about that. Could you explain what it means for me?");

const durationFallback = await generatePatientRoleSafeResponse({
  initialOutput: "It started a couple of days ago.",
  visibleFacts: [durationFact],
  retry: async () => "It started two days ago.",
  fallbackText: "It has been getting worse for seven days.",
});
assert.equal(durationFallback.repeatedDrift, true);
assert.equal(durationFallback.text, "It has been getting worse for seven days.");

const case4Duration: PatientDisclosureFact = { id: "c4.duration", topic: "onset_duration", text: "The returned pain has worsened over five days." };
assert.equal(assessPatientOutputIntegrity("It got worse over the last 48 hours.", [case4Duration], [], [case4Duration]).valid, false);
assert.equal(assessPatientOutputIntegrity("The returned pain has worsened for five days.", [case4Duration], [], [case4Duration]).valid, true);
const case5Location: PatientDisclosureFact = { id: "c5.location", topic: "location", text: "The pain is in the lower-left tooth area." };
assert.equal(assessPatientOutputIntegrity("My bottom right molar hurts.", [case5Location], [], [case5Location]).valid, false);
assert.equal(assessPatientOutputIntegrity("My tooth is the one on the top right side.", [case5Location]).reason, "contradiction of Case 5 tooth location");
assert.equal(assessPatientOutputIntegrity("My upper-left molar hurts.", [case5Location]).reason, "contradiction of Case 5 tooth location");
assert.equal(assessPatientOutputIntegrity("My lower-left tooth hurts.", [case5Location], [], [case5Location]).valid, true);
assert.equal(assessPatientOutputIntegrity("My bottom right molar hurts.", [case5Location]).reason, "contradiction of Case 5 tooth location");
const case4Penicillin: PatientDisclosureFact = { id: "c4.penicillin", topic: "allergies", text: "The patient is allergic to penicillin." };
const case4Hives: PatientDisclosureFact = { id: "c4.hives", topic: "allergies", text: "Penicillin causes hives." };
assert.equal(assessPatientOutputIntegrity("It's my left mandibular first molar.", [case4Penicillin, case4Hives], [], [case4Penicillin, case4Hives]).valid, false);
assert.equal(assessPatientOutputIntegrity("Penicillin gives me hives.", [case4Penicillin, case4Hives], [], [case4Penicillin, case4Hives]).valid, true);
const case4Location: PatientDisclosureFact = { id: "c4.location", topic: "location", text: "The painful tooth is the left mandibular first molar." };
for (const invalid of ["Penicillin causes hives for me.", "It hurts in my mouth.", "My upper-left molar hurts.", "My lower-right back tooth hurts."]) {
  assert.equal(assessPatientOutputIntegrity(invalid, [case4Location], [], [case4Location]).valid, false, invalid);
}
for (const valid of ["It is my left mandibular first molar.", "It is my lower-left first molar.", "It is my lower-left back tooth.", "It is my left lower molar."]) {
  assert.equal(assessPatientOutputIntegrity(valid, [case4Location], [], [case4Location]).valid, true, valid);
}
const case3Location: PatientDisclosureFact = { id: "c3.location", topic: "location", text: "The painful tooth is a right mandibular posterior tooth." };
const case3Duration: PatientDisclosureFact = { id: "c3.duration", topic: "onset_duration", text: "The pain has progressively worsened for three days." };
for (const valid of ["It's the lower-right back tooth, and it started about three days ago.", "The pain is in my lower-right posterior tooth and has been there for 3 days."]) {
  assert.equal(assessPatientOutputIntegrity(valid, [case3Location, case3Duration], [], [case3Location, case3Duration]).valid, true, valid);
}
for (const invalid of ["It hurts in the back.", "I've had ulcers.", "It started recently.", "It is my lower-right tooth.", "It started three days ago.", "It's on the left side and began five days ago."]) {
  assert.equal(assessPatientOutputIntegrity(invalid, [case3Location, case3Duration], [], [case3Location, case3Duration]).valid, false, invalid);
}
const case3Ulcers: PatientDisclosureFact = { id: "c3.ulcers", topic: "medical_history", text: "The patient has stomach ulcers." };
const case3Ibuprofen: PatientDisclosureFact = { id: "c3.ibuprofen", topic: "medications", text: "Ibuprofen upsets the patient's stomach and is poorly tolerated." };
const case3Nkda: PatientDisclosureFact = { id: "c3.nkda", topic: "allergies", text: "The patient has no known drug allergies." };
assert.equal(assessPatientOutputIntegrity("I have stomach ulcers.", [case3Ulcers], [], [case3Ulcers]).valid, true);
assert.equal(assessPatientOutputIntegrity("I have no known ulcers.", [case3Ulcers]).reason, "contradiction of Case 3 stomach-ulcer history");
assert.equal(assessPatientOutputIntegrity("I've had stomach ulcers, ibuprofen upsets my stomach, and I have no known drug allergies.", [case3Ulcers, case3Ibuprofen, case3Nkda], [], [case3Ulcers, case3Ibuprofen, case3Nkda]).valid, true);
const case2Swelling: PatientDisclosureFact = { id: "c2.swelling", topic: "swelling", text: "The right cheek swelling has increased over approximately 24 hours." };
assert.equal(assessPatientOutputIntegrity("My right cheek is swollen.", [case2Swelling], [], [case2Swelling]).valid, true);
assert.equal(assessPatientOutputIntegrity("I haven't noticed any swelling.", [case2Swelling]).reason, "contradiction of Case 2 right-cheek swelling");
const case4Severity: PatientDisclosureFact = { id: "c4.severity", topic: "pain", text: "The pain is rated 7/10." };
for (const valid of ["Seven.", "About seven out of ten.", "I would rate it a seven.", "Around 7/10."]) {
  assert.equal(assessPatientOutputIntegrity(valid, [case4Severity], [], [case4Severity]).valid, true, valid);
}
for (const invalid of ["Penicillin causes hives.", "It hurts a lot.", "Five out of ten.", "10/10."]) {
  assert.equal(assessPatientOutputIntegrity(invalid, [case4Severity], [], [case4Severity]).valid, false, invalid);
}
const severityFallback = await generatePatientRoleSafeResponse({
  initialOutput: "It hurts a lot.",
  visibleFacts: [case4Severity],
  requiredFacts: [case4Severity],
  retry: async () => "Penicillin causes hives.",
  fallbackText: "I would rate the pain a seven out of ten.",
});
assert.equal(severityFallback.repeatedDrift, true);
assert.equal(severityFallback.text, "I would rate the pain a seven out of ten.");
const case5Smoking: PatientDisclosureFact = { id: "c5.smoking", topic: "social_history", text: "The patient smokes approximately half-pack per day." };
assert.equal(assessPatientOutputIntegrity("I don't smoke.", [case5Smoking]).reason, "contradiction of Case 5 smoking history");
assert.equal(assessPatientOutputIntegrity("I smoke about half a pack per day.", [case5Smoking], [], [case5Smoking]).valid, true);

let quoteRetryCount = 0;
const unquoted = await generatePatientRoleSafeResponse({
  initialOutput: '  "My wife said, "You need to see a dentist.""  ',
  retry: async () => {
    quoteRetryCount += 1;
    return "unused";
  },
});
assert.equal(unquoted.text, 'My wife said, "You need to see a dentist."');
assert.equal(quoteRetryCount, 0, "A valid outer-quoted response must not retry");

let invalidQuotedRetryCount = 0;
const repairedQuotedLeak = await generatePatientRoleSafeResponse({
  initialOutput: '“End of simulation”',
  retry: async () => {
    invalidQuotedRetryCount += 1;
    return "My tooth hurts.";
  },
});
assert.equal(repairedQuotedLeak.text, "My tooth hurts.");
assert.equal(invalidQuotedRetryCount, 1);

const emptyQuoted = await generatePatientRoleSafeResponse({
  initialOutput: '""',
  retry: async () => "My tooth hurts.",
});
assert.equal(emptyQuoted.text, "My tooth hurts.");

console.log("Patient output-integrity validation passed.");
