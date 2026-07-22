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
assert.equal(assessPatientOutputIntegrity("It hurts in my lower-left jaw, but I can't tell which tooth it is.", [case5Location], [], [case5Location]).valid, true);
assert.equal(assessPatientOutputIntegrity("I know it is my first molar.", [case5Location]).reason, "invented Case 5 patient knowledge of exact tooth");
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
const case3FocusedAnswers: Array<[PatientDisclosureFact, string, string]> = [
  [{ id: "c3.cold", topic: "pain", text: "Drinking something cold is not painful." }, "No, drinking something cold is not painful.", "Cold makes the tooth hurt."],
  [{ id: "c3.rct", topic: "dental_history", text: "Root-canal status is uncertain." }, "I'm not sure whether that tooth had a root canal.", "I definitely never had a root canal."],
  [{ id: "c3.ibuprofen", topic: "medications", text: "Ibuprofen upsets the stomach but is not an allergy." }, "Ibuprofen upsets my stomach, but it is not an allergy.", "I am allergic to ibuprofen."],
  [{ id: "c3.painful-tooth-not-extracted", topic: "dental_history", text: "The painful crowned tooth remains present." }, "No, that tooth is still there and has a crown on it.", "I already had this painful tooth extracted."],
  [{ id: "c3.prior-antibiotics-unknown", topic: "medications", text: "Pre-arrival antibiotic use is unknown." }, "I don't remember whether I took antibiotics before coming in.", "I never took antibiotics before coming in."],
  [{ id: "c3.diagnosis-unknown", topic: "medical_history", text: "The patient does not independently know the diagnosis." }, "I don't know the diagnosis; I just know the tooth hurts.", "I know I have a periapical abscess."],
];
for (const [fact, valid, invalid] of case3FocusedAnswers) {
  assert.equal(assessPatientOutputIntegrity(valid, [fact], [], [fact]).valid, true, valid);
  assert.equal(assessPatientOutputIntegrity(invalid, [fact], [], [fact]).valid, false, invalid);
}
const case4FocusedAnswers: Array<[PatientDisclosureFact, string, string]> = [
  [{ id: "c4.filling-break-belief", topic: "dental_history", text: "The filling may have broken." }, "I think the filling may have broken, but I'm not certain.", "The filling is definitely broken."],
  [{ id: "c4.hives", topic: "allergies", text: "Penicillin causes hives." }, "Penicillin gives me hives.", "Penicillin caused anaphylaxis."],
  [{ id: "c4.hard-object-unknown", topic: "trauma_injury", text: "Hard-object history is unknown." }, "I'm not sure whether I bit down on anything hard.", "I bit down on something hard."],
  [{ id: "c4.surgery-unknown", topic: "medical_history", text: "Surgical history is unknown." }, "I'm not sure.", "I have never had surgery."],
  [{ id: "c4.temperature-unknown", topic: "medical_history", text: "The patient has no fever but does not know an exact temperature." }, "I haven't had a fever, but I don't know an exact temperature.", "I measured my temperature and it was 98.6 degrees."],
  [{ id: "c4.prior-antibiotics-unknown", topic: "medications", text: "Pre-arrival antibiotic use is unknown." }, "I don't remember whether I took antibiotics before coming in.", "I never took antibiotics before coming in."],
  [{ id: "c4.diagnosis-unknown", topic: "medical_history", text: "The patient does not independently know the diagnosis." }, "I don't know the diagnosis; I just know the tooth hurts.", "I know I have necrotic pulp."],
];
for (const [fact, valid, invalid] of case4FocusedAnswers) {
  assert.equal(assessPatientOutputIntegrity(valid, [fact], [], [fact]).valid, true, valid);
  assert.equal(assessPatientOutputIntegrity(invalid, [fact], [], [fact]).valid, false, invalid);
}
const case2DirectAnswers: Array<[PatientDisclosureFact, string, string]> = [
  [{ id: "c2.systemic-timeline", topic: "onset_duration", text: "Systemic symptoms progressed over 24 hours." }, "The fever, chills, fatigue, and swelling started about twenty-four hours ago.", "Those symptoms have been present for seven days."],
  [{ id: "c2.severity", topic: "pain", text: "Current pain is 8/10." }, "The pain is eight out of ten now.", "The pain is 3/10 now."],
  [{ id: "c2.med", topic: "medications", text: "Ibuprofen 400 mg approximately every six hours." }, "I take Motrin 400 milligrams about every six hours as needed.", "I take Tylenol."],
  [{ id: "c2.opioid", topic: "medical_history", text: "No opioid-use or misuse history." }, "No, I have no history of opioid use or misuse.", "Yes, I have used opioids before."],
  [{ id: "c2.alcohol", topic: "social_history", text: "Rare alcohol use." }, "I drink alcohol rarely.", "I do not drink alcohol at all."],
  [{ id: "c2.prior-antibiotics-unknown", topic: "medications", text: "Prior antibiotics are not specified." }, "I do not know or recall whether I took antibiotics for this before.", "I never took antibiotics for this."],
  [{ id: "c2.prior-root-canal-unknown", topic: "dental_history", text: "Prior root canal is not specified." }, "I'm not sure whether that tooth ever had a root canal.", "This tooth never had a root canal."],
  [{ id: "c2.prior-treatment-unknown", topic: "dental_history", text: "Other prior treatment is not specified." }, "I don't remember having treatment done on that tooth.", "This tooth never had other treatment."],
  [{ id: "c2.painful-tooth-not-extracted", topic: "dental_history", text: "The painful tooth is present." }, "No, the tooth is still there.", "I already had this painful tooth extracted."],
  [{ id: "c2.other-extraction-unknown", topic: "dental_history", text: "Extraction of another tooth is not specified." }, "I'm not sure whether I've had another tooth extracted.", "I have never had another tooth extracted."],
  [{ id: "c2.temperature-unknown", topic: "medical_history", text: "Exact temperature is unknown." }, "I feel feverish, but I do not know my exact temperature.", "My temperature was 103 degrees."],
  [{ id: "c2.sirs-unknown", topic: "medical_history", text: "SIRS status is unknown to the patient." }, "I do not know whether I meet SIRS criteria.", "I know that I meet SIRS criteria."],
];
for (const [fact, valid, invalid] of case2DirectAnswers) {
  assert.equal(assessPatientOutputIntegrity(valid, [fact], [], [fact]).valid, true, valid);
  assert.equal(assessPatientOutputIntegrity(invalid, [fact], [], [fact]).valid, false, invalid);
}
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
assert.equal(assessPatientOutputIntegrity("I don't smoke.", [case5Smoking]).reason, "contradiction of Case 5 half-pack smoking history");
assert.equal(assessPatientOutputIntegrity("I smoke about half a pack per day.", [case5Smoking], [], [case5Smoking]).valid, true);
const case5RootCanal: PatientDisclosureFact = { id: "c5.root-canal-unknown", topic: "dental_history", text: "Root-canal history is unknown." };
assert.equal(assessPatientOutputIntegrity("I'm not sure whether I have had a root canal.", [case5RootCanal], [], [case5RootCanal]).valid, true);
assert.equal(assessPatientOutputIntegrity("I already had a root canal.", [case5RootCanal]).valid, false);
const case5Opioid: PatientDisclosureFact = { id: "c5.opioid-negative", topic: "medications", text: "No opioid history." };
assert.equal(assessPatientOutputIntegrity("No, I have no history of opioid use, misuse, or abuse.", [case5Opioid], [], [case5Opioid]).valid, true);
assert.equal(assessPatientOutputIntegrity("I have used opioids before.", [case5Opioid]).valid, false);

const case1Opioid: PatientDisclosureFact = { id: "c1.opioid", topic: "medical_history", text: "The patient has no history of opioid or narcotic use, opioid misuse, or opioid dependence." };
for (const valid of [
  "No, I have never used opioids.",
  "I have not taken narcotics before.",
  "No, I have no history of prescription opioid misuse.",
  "I have never been dependent on opioids.",
]) assert.equal(assessPatientOutputIntegrity(valid, [case1Opioid], [], [case1Opioid]).valid, true, valid);
for (const invalid of [
  "Yes, I have used opioids before.",
  "I took narcotics in the past.",
  "I have a history of prescription painkiller use.",
  "I was dependent on opioids.",
  "I take metformin and lisinopril.",
]) assert.equal(assessPatientOutputIntegrity(invalid, [case1Opioid], [], [case1Opioid]).valid, false, invalid);
assert.equal(assessPatientOutputIntegrity("Yes, I have used opioids before.", [case1Opioid]).reason, "contradiction of Case 1 no-opioid history");

const opioidFallback = await generatePatientRoleSafeResponse({
  initialOutput: "Yes, I have taken narcotics before.",
  visibleFacts: [case1Opioid],
  requiredFacts: [case1Opioid],
  retry: async () => "I take metformin and lisinopril.",
  fallbackText: "No, I have never used opioids or narcotics.",
});
assert.equal(opioidFallback.repeatedDrift, true);
assert.equal(opioidFallback.text, "No, I have never used opioids or narcotics.");

const case1DirectAnswers: Array<[PatientDisclosureFact, string, string]> = [
  [{ id: "c1.location", topic: "location", text: "The bad tooth is the left mandibular molar." }, "It is my lower-left molar.", "It is on the right side."],
  [{ id: "c1.duration", topic: "onset_duration", text: "The pain has worsened for four days." }, "It has been worsening for four days.", "It has been hurting for two weeks."],
  [{ id: "c1.onset-uncertain", topic: "onset_duration", text: "The exact onset is unknown." }, "I do not know exactly when it originally started.", "It began at exactly noon last Monday."],
  [{ id: "c1.initial-severity", topic: "pain", text: "Initial pain was approximately 3/10." }, "At first it was about three out of ten.", "It started at eight out of ten."],
  [{ id: "c1.severity", topic: "pain", text: "Current pain is 8/10." }, "It is eight out of ten now.", "It is five out of ten now."],
  [{ id: "c1.airway-duration", topic: "onset_duration", text: "Airway symptoms began about 12 hours ago." }, "That started about twelve hours ago.", "That started four days ago."],
  [{ id: "c1.swelling-location", topic: "swelling", text: "Swelling is bilateral under the jaw." }, "It is swollen on both sides under my jaw.", "Only the left side is swollen."],
  [{ id: "c1.upright-breathing", topic: "medical_history", text: "No dyspnea while upright." }, "No, I am not short of breath while sitting upright.", "I am short of breath while sitting upright."],
  [{ id: "c1.dyspnea-supine", topic: "medical_history", text: "Dyspnea occurs when supine." }, "I feel short of breath and choke when I lie flat.", "I breathe normally when lying flat."],
  [{ id: "c1.home-temperature", topic: "medical_history", text: "No home temperature was measured." }, "No, I did not measure my temperature at home.", "I measured a fever of 103 degrees."],
  [{ id: "c1.chest-pain", topic: "medical_history", text: "No chest pain." }, "No, I do not have chest pain.", "Yes, I have chest pain."],
  [{ id: "c1.diabetes", topic: "medical_history", text: "Type 2 diabetes." }, "I have type 2 diabetes.", "I use insulin."],
  [{ id: "c1.hypertension", topic: "medical_history", text: "Hypertension." }, "I have high blood pressure.", "I do not have hypertension."],
  [{ id: "c1.metformin", topic: "medications", text: "Takes metformin." }, "I take metformin.", "I take insulin."],
  [{ id: "c1.lisinopril", topic: "medications", text: "Takes lisinopril." }, "I take lisinopril.", "I take amlodipine."],
  [{ id: "c1.nkda", topic: "allergies", text: "No known drug or penicillin allergies." }, "I have no known drug allergies, including penicillin.", "I am allergic to penicillin."],
  [{ id: "c1.ibuprofen", topic: "medications", text: "No contraindication to ibuprofen." }, "I can take ibuprofen without a problem.", "Ibuprofen is contraindicated for me."],
  [{ id: "c1.smoking", topic: "social_history", text: "Smokes one pack per day." }, "I smoke about one pack per day.", "I do not smoke."],
  [{ id: "c1.alcohol", topic: "social_history", text: "No alcohol use." }, "No, I do not drink alcohol.", "I drink alcohol regularly."],
  [{ id: "c1.illicit-drugs", topic: "social_history", text: "No illicit-drug use." }, "No, I do not use illicit drugs.", "I use illicit drugs."],
  [{ id: "c1.prior-antibiotics-unknown", topic: "medications", text: "Prior antibiotic use is not established." }, "I do not know or recall whether I took antibiotics for this before.", "I already took antibiotics."],
  [{ id: "c1.prior-antibiotics-unknown", topic: "medications", text: "Prior antibiotic use is not established." }, "I cannot remember whether I had antibiotics for this.", "No, I have never taken antibiotics for this."],
  [{ id: "c1.otc-unknown", topic: "medications", text: "Exact OTC product and dose are unknown." }, "I took an over-the-counter pain medicine, but I do not know the exact product.", "I took ibuprofen 400 mg."],
  [{ id: "c1.prior-root-canal-unknown", topic: "dental_history", text: "Prior root-canal history is not established." }, "I do not know or recall whether this tooth had a root canal before.", "I already had a root canal on this tooth."],
  [{ id: "c1.prior-root-canal-unknown", topic: "dental_history", text: "Prior root-canal history is not established." }, "I am not sure whether this tooth had a root canal.", "No, this tooth never had a root canal."],
  [{ id: "c1.prior-extraction-unknown", topic: "dental_history", text: "Prior extraction history is not established." }, "I do not know or recall whether I have had an extraction before.", "I had an extraction before."],
  [{ id: "c1.prior-extraction-unknown", topic: "dental_history", text: "Prior extraction history is not established." }, "I cannot remember whether I have had an extraction.", "No, I have never had an extraction."],
];
for (const [fact, valid, invalid] of case1DirectAnswers) {
  assert.equal(assessPatientOutputIntegrity(valid, [fact], [], [fact]).valid, true, valid);
  assert.equal(assessPatientOutputIntegrity(invalid, [fact], [], [fact]).valid, false, invalid);
}

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
