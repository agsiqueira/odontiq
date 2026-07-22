import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { canonicalCase03 } from "../src/data/canonicalCaseSpecs/case-03";

const caseData = loadCase("case-03")!;
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 25);
assert.equal(caseData.patient.sex, "Not specified");
assert.equal(canonicalCase03.identity.gender.status, "not-specified");
for (const expected of ["right mandibular", "three days", "constant", "throbbing", "8/10", "right ear", "biting", "stomach ulcers", "pepcid", "ibuprofen", "no fever", "crown", "not sure", "root-canal", "periapical abscess", "incision and drainage"]) assert(corpus.includes(expected), expected);
for (const forbidden of ["periodontal abscess", "hyperglyc", "has diabetes", "recommend ibuprofen", "1000 mg", "every 4 hours", "every four hours", "maxillary infiltration"]) assert(!corpus.includes(forbidden), forbidden);

const visible = (question: string) => buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question }).allowedThisTurn;
const questions: Array<[string, string[]]> = [
  ["Where does it hurt?", ["c3.location"]],
  ["How long has it been hurting?", ["c3.duration"]],
  ["Is the pain constant?", ["c3.pain-quality"]],
  ["What does the pain feel like?", ["c3.pain-quality"]],
  ["How bad is it?", ["c3.pain-severity"]],
  ["Does it travel anywhere?", ["c3.radiation"]],
  ["Does chewing hurt?", ["c3.biting"]],
  ["Does tapping the tooth hurt?", ["c3.percussion"]],
  ["Does cold hurt?", ["c3.cold"]],
  ["Is there swelling inside your mouth?", ["c3.oral-swelling"]],
  ["Have you had a fever?", ["c3.no-fever"]],
  ["Can you open your mouth?", ["c3.mouth-opening"]],
  ["Any trouble swallowing?", ["c3.swallowing"]],
  ["Any trouble breathing?", ["c3.breathing"]],
  ["Has your voice changed?", ["c3.voice"]],
  ["Do you have chest pain?", ["c3.chest-pain-negative"]],
  ["Is your neck stiff?", ["c3.neck-stiffness-negative"]],
  ["What medical conditions do you have?", ["c3.ulcers"]],
  ["What medications do you take?", ["c3.pepcid"]],
  ["Does ibuprofen bother your stomach?", ["c3.ibuprofen"]],
  ["What dose of Pepcid do you take?", ["c3.pepcid-details-unknown"]],
  ["How often do you take Pepcid?", ["c3.pepcid-details-unknown"]],
  ["Are you allergic to ibuprofen?", ["c3.ibuprofen", "c3.nkda"]],
  ["Has that tooth had a root canal?", ["c3.crown", "c3.rct"]],
  ["Does this tooth have a crown?", ["c3.crown"]],
  ["Have you had this painful tooth extracted?", ["c3.painful-tooth-not-extracted"]],
  ["Have you had dental work before?", ["c3.dental-work"]],
  ["Which teeth were treated?", ["c3.treated-teeth-unknown"]],
  ["Have you had surgery?", ["c3.surgery-negative"]],
  ["Have you used opioids?", ["c3.opioid-negative"]],
  ["Do you drink alcohol?", ["c3.alcohol"]],
  ["Do you use illicit drugs?", ["c3.illicit-drugs-negative"]],
  ["When did you call your dentist?", ["c3.dentist-contact"]],
  ["Have you taken antibiotics before coming in?", ["c3.prior-antibiotics-unknown"]],
  ["Have you taken Tylenol before coming in?", ["c3.prior-acetaminophen-unknown"]],
  ["Do you know your exact temperature?", ["c3.temperature-unknown"]],
  ["Do you know your exact heart rate?", ["c3.heart-rate-unknown"]],
  ["Do you know the diagnosis?", ["c3.diagnosis-unknown"]],
  ["Do you smoke?", ["c3.smoking"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert(visible("Have you had a fever?").every((fact) => !/ulcer|pepcid|ibuprofen|diabetes/i.test(fact.text)));
assert(visible("What medical conditions do you have?").every((fact) => !/pepcid/i.test(fact.text)));
assert(visible("Does chewing hurt?").every((fact) => !/purulence|fluctuance/i.test(fact.text)));
assert(visible("Tell me about the pain.").every((fact) => !/ulcer|breath|swallow|voice|trismus/i.test(fact.text)));
assert.equal(visible("The examination shows purulence.").length, 0);
assert(!caseData.supportingInfo.patientFacts!.some((fact) => /purulence|fluctuance|percussion|cold-negative/i.test(fact.text)));

const patientFacts = caseData.supportingInfo.patientFacts ?? [];
for (const response of [
  "The pain is in my upper-right tooth.", "This is a lower-left tooth.", "It has hurt for seven days.", "It started today.",
  "My pain is 3/10 now.", "The pain goes to my left ear.", "Cold makes it hurt.", "I have a fever.", "My voice is muffled.",
  "I cannot open my mouth.", "I am having trouble breathing.", "My neck is stiff.", "I have diabetes.", "I have no medical history at all.",
  "I take Pepcid every day.", "I am allergic to ibuprofen.", "Ibuprofen does not bother my stomach.", "I am allergic to penicillin.",
  "I smoke half a pack per day.", "I never drink alcohol.", "I drink every day.", "I use illicit drugs.",
  "I definitely had a root canal.", "I definitely never had a root canal.", "I have never had dental work.",
  "I already had this painful tooth extracted.", "I currently have systemic infection.", "I have facial cellulitis.",
  "I measured a temperature of 103 degrees.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, false, response);

for (const response of [
  "The painful tooth is my lower-right back tooth.", "It has been getting worse for three days.", "The pain is eight out of ten now.",
  "It travels toward my right ear.", "No, drinking something cold is not painful.", "Yes, biting and tapping that tooth hurt.",
  "My face feels a little puffy.", "My gum is swollen and painful inside my mouth.", "No, I have not had a fever.",
  "No, I have no trouble breathing.", "My voice is normal.", "I can open my mouth normally.", "I have stomach ulcers but am otherwise healthy.",
  "I take Pepcid as needed.", "I have no known drug allergies.", "Ibuprofen upsets my stomach, but it is not an allergy.",
  "No, I am not allergic to penicillin.", "No, I have no history of opioid use, misuse, or abuse.", "No, I do not smoke.",
  "I drink alcohol occasionally.", "No, I do not use illicit drugs.", "That lower-right tooth has a crown.",
  "I'm not sure whether that tooth had a root canal.", "I have had a lot of dental work in the past.",
  "I don't remember exactly which teeth were treated.", "No, that tooth is still there and has a crown on it.",
  "I called my dentist a couple of days ago.", "I have an appointment next week.",
  "I don't remember whether I took antibiotics before coming in.", "I don't know my exact heart rate.",
  "I don't know the diagnosis; I just know the tooth hurts and my gum is swollen.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, true, response);

for (const [question, scriptId] of [["Have you had a fever?", "c3-fever"], ["Does ibuprofen bother your stomach?", "c3-ibuprofen"], ["Has that tooth had a root canal?", "c3-root-canal"], ["Does it travel anywhere?", "c3-radiation"], ["Can you open your mouth?", "c3-mouth-opening"]] as const) assert.equal(sendMessage("case-03", question, []).matchedConversationId, scriptId, question);
const scripts = caseData.conversation.scripted;
assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);
assert.equal(new Set(scripts.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"))).size, scripts.length);

const exam = caseData.assets.examinations.find((item) => item.id === "oral-examination");
assert(exam?.type === "clinical-findings");
for (const finding of ["fluctuance", "purulence", "percussion", "biting", "palpation", "cold", "floor of mouth", "no airway-compromise", "voice is normal", "mouth opens normally"]) assert(JSON.stringify(exam).toLowerCase().includes(finding), finding);
assert.equal(caseData.assets.examinations.some((item) => item.id === "vital-signs"), false, "unsupported exact vital signs must not be displayed");
for (const unsupported of ["first molar", "poor dentition", "no stridor", "37.2", "96 bpm", "128/78"]) assert(!corpus.includes(unsupported), unsupported);

const rubric = facultyRubrics.find((item) => item.caseId === "case-03")!;
for (const id of ["C3-PD-001", "C3-PD-002", "C3-PD-003", "C3-MP-001", "C3-MP-002", "C3-MP-004", "C3-MP-005", "C3-MP-006", "C3-CI-004", "C3-EX-002", "C3-EX-003", "C3-EX-004", "C3-EX-005", "C3-EX-006"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(rubric.criteria.find((criterion) => criterion.id === "C3-PD-001")?.acceptedConcepts?.includes("inferior alveolar nerve block"));
assert(!rubric.criteria.some((criterion) => criterion.acceptedConcepts?.some((concept) => /maxillary infiltration/i.test(concept))));
assert(!rubric.criteria.some((criterion) => criterion.id === "C3-MP-002" && criterion.acceptedConcepts?.some((concept) => /^ibuprofen$|^nsaid$/i.test(concept))));
assert(rubric.criteria.find((criterion) => criterion.id === "C3-MP-002")?.facultyNotes?.includes("pending faculty review"));
assert(rubric.criteria.filter((criterion) => criterion.id !== "C3-EX-001" && criterion.id.startsWith("C3-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));

console.log("Case 3 periapical-abscess validation passed.");
