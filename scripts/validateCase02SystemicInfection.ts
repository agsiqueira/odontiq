import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { canonicalCase02 } from "../src/data/canonicalCaseSpecs/case-02";

const caseData = loadCase("case-02")!;
assert(caseData);
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 21);
assert.equal(caseData.patient.sex, "Not specified");
assert.equal(canonicalCase02.identity.gender.status, "not-specified");
assert.equal(caseData.metadata.urgency, "Emergency");
for (const expected of ["seven days", "upper-right", "8/10", "fever", "chills", "weak", "ibuprofen 400 mg", "14.8", "neutroph", "normal lactate", "basic metabolic panel", "within normal limits", "periapical abscess", "facial cellulitis", "no deep-space involvement", "systemic infection"]) assert(corpus.includes(expected), expected);

const visible = (question: string) => buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question }).allowedThisTurn;
const questions: Array<[string, string[]]> = [
  ["Have you had a fever?", ["c2.fever"]],
  ["Any chills?", ["c2.chills"]],
  ["Do you feel weak or sick?", ["c2.weak"]],
  ["How long has this been going on?", ["c2.duration"]],
  ["Where is the pain?", ["c2.location"]],
  ["Is the pain constant now?", ["c2.current-pain"]],
  ["Did hot or cold bother it earlier?", ["c2.thermal-history"]],
  ["Does it hurt to chew?", ["c2.biting"]],
  ["What medication did you take?", ["c2.med"]],
  ["Are you allergic to penicillin?", ["c2.nkda"]],
  ["Are you having trouble breathing?", ["c2.breathing-negative"]],
  ["Can you swallow liquids?", ["c2.liquids-positive"]],
  ["Has your voice changed?", ["c2.voice-negative"]],
  ["Are you drooling?", ["c2.drooling-negative"]],
  ["Can you open your mouth?", ["c2.mouth-opening"]],
  ["Is it an upper or lower tooth?", ["c2.location"]],
  ["Is it on the right or left?", ["c2.location"]],
  ["When did the cheek swelling become worse?", ["c2.systemic-timeline"]],
  ["When did the fever and chills begin?", ["c2.systemic-timeline"]],
  ["What did the pain feel like initially?", ["c2.thermal-history"]],
  ["How severe is the pain?", ["c2.severity"]],
  ["Do you have any medical problems?", ["c2.healthy"]],
  ["What dose of Motrin do you take?", ["c2.med"]],
  ["How often do you take Advil?", ["c2.med"]],
  ["Can you take ibuprofen?", ["c2.ibuprofen"]],
  ["Have you ever used opioids?", ["c2.opioid"]],
  ["Do you have a history of opioid misuse or abuse?", ["c2.opioid"]],
  ["Do you have medication allergies?", ["c2.nkda"]],
  ["Do you smoke?", ["c2.smoking"]],
  ["Do you drink alcohol?", ["c2.alcohol"]],
  ["Do you use illicit drugs?", ["c2.illicit-drugs"]],
  ["When did you last see a dentist?", ["c2.access"]],
  ["Have you already taken antibiotics for this?", ["c2.prior-antibiotics-unknown"]],
  ["Have you had a root canal on this tooth?", ["c2.prior-root-canal-unknown"]],
  ["Have you had other treatment done on this tooth?", ["c2.prior-treatment-unknown"]],
  ["Was this painful tooth previously extracted?", ["c2.painful-tooth-not-extracted"]],
  ["Have you ever had another tooth extracted?", ["c2.other-extraction-unknown"]],
  ["Do you know your exact heart rate?", ["c2.heart-rate-unknown"]],
  ["Do you know whether you meet SIRS criteria?", ["c2.sirs-unknown"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert.deepEqual(visible("Have you checked your temperature?").map((fact) => fact.id), ["c2.temperature-unknown"]);
assert.deepEqual(visible("Do you know your exact temperature?").map((fact) => fact.id), ["c2.temperature-unknown"]);

for (const question of ["Have you had a fever?", "Did hot or cold bother it earlier?", "Do you feel weak or sick?", "Tell me about the pain."]) {
  const facts = visible(question);
  assert(facts.every((fact) => !/14\.8|lactate|basic metabolic|ct|cellulitis|deep-space/i.test(fact.text)), `${question} exposed diagnostics`);
}
assert(visible("Have you had a fever?").every((fact) => fact.topic !== "medications"));
assert(visible("Do you feel weak or sick?").every((fact) => fact.topic !== "medications"));
assert(visible("Tell me about the pain.").every((fact) => !/breath|swallow|voice|drool/i.test(fact.text)));
assert.equal(visible("The CT shows cellulitis.").length, 0);
assert(!caseData.supportingInfo.patientFacts!.some((fact) => /14\.8|neutroph|lactate|basic metabolic|ct face|deep-space/i.test(fact.text)), "Diagnostic data must not be patient-disclosable");

const legacy: Array<[string, string]> = [
  ["Have you had a fever?", "c2-fever"], ["Any chills?", "c2-chills"], ["Can you swallow liquids?", "c2-liquids"], ["Has your voice changed?", "c2-voice"], ["Are you drooling?", "c2-drooling"], ["Can you open your mouth?", "c2-mouth-opening"], ["Did hot or cold bother it earlier?", "c2-historical-thermal"],
];
for (const [question, scriptId] of legacy) assert.equal(sendMessage("case-02", question, []).matchedConversationId, scriptId, question);
const scriptIds = caseData.conversation.scripted.map((script) => script.id);
assert.equal(new Set(scriptIds).size, scriptIds.length);
const triggerSets = caseData.conversation.scripted.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"));
assert.equal(new Set(triggerSets).size, triggerSets.length);
assert(!corpus.includes("has not noticed fever"));
assert(!corpus.includes("acetaminophen only"));
assert(!corpus.includes("seven out of ten"));
assert(!corpus.includes("deep-space involvement is present"));

const patientFacts = caseData.supportingInfo.patientFacts ?? [];
for (const response of [
  "The pain is in my upper-left tooth.", "This is a lower-right molar.",
  "The dental pain only started yesterday.", "My cheek has been swollen for the full seven days.",
  "My pain is 3/10 now.", "I am drooling.", "My voice is muffled.",
  "I cannot swallow liquids.", "I am having trouble breathing.", "I cannot open my mouth.",
  "I have diabetes.", "I have hypertension.", "I take insulin.", "I am allergic to penicillin.",
  "Yes, I have used opioids before.", "I do not drink alcohol at all.", "I drink alcohol every day.",
  "I smoke one pack per day.", "I already completed antibiotics.",
  "I previously had a root canal on this tooth.", "This tooth never had a root canal.",
  "I previously had treatment done on this tooth.", "This tooth never had other treatment.",
  "I already had this painful tooth extracted.",
  "I had another tooth extracted.", "I have never had another tooth extracted.",
  "I measured a temperature of 103 degrees.", "I know that I meet SIRS criteria.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, false, response);

for (const response of [
  "The painful tooth is my back upper-right molar.", "The dental pain has been worsening for seven days.",
  "The fever, chills, fatigue, and right-cheek swelling began about twenty-four hours ago.",
  "The pain is eight out of ten now.", "I can open my mouth, but it is uncomfortable.",
  "No, I am not drooling.", "My voice is normal.", "No, I am not having trouble breathing.",
  "Yes, I can swallow liquids.", "I take Motrin 400 milligrams as needed about every six hours.",
  "I have no known drug allergies, and I am not allergic to penicillin.",
  "No, I have no history of opioid use or misuse.", "I smoke about half a pack per day.",
  "I drink alcohol rarely.", "No, I do not use illicit drugs.",
  "I do not know or recall whether I took antibiotics for this before.",
  "I'm not sure whether that tooth ever had a root canal.",
  "I don't remember having treatment done on that tooth.",
  "No, the tooth is still there.",
  "I'm not sure whether I've had another tooth extracted.",
  "I feel feverish, but I do not know my exact temperature.", "I do not know whether I meet SIRS criteria.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, true, response);

const labs = caseData.assets.examinations.find((item) => item.id === "laboratory-results");
const ct = caseData.assets.examinations.find((item) => item.id === "ct-face");
assert(labs?.type === "diagnostic-results" && ct?.type === "diagnostic-results");
assert.deepEqual(labs.findings.map((item) => item.value), ["14.8 ×10⁹/L", "Neutrophil predominant leukocytosis", "Normal", "Within normal limits"]);
assert.deepEqual(ct.findings.map((item) => item.value), ["Periapical abscess of the upper-right molar", "Surrounding facial cellulitis", "No deep-space involvement"]);

const rubric = facultyRubrics.find((item) => item.caseId === "case-02")!;
for (const id of ["C2-CI-002", "C2-CI-003", "C2-EX-005", "C2-EX-006", "C2-EX-007", "C2-EX-008", "C2-MP-007", "C2-MP-008", "C2-MP-009", "C2-MP-010"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(rubric.criteria.filter((criterion) => criterion.id !== "C2-EX-001" && criterion.id.startsWith("C2-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));
assert(rubric.criteria.find((criterion) => criterion.id === "C2-IG-004")?.facultyNotes?.includes("pending faculty"));

console.log("Case 2 systemic-infection validation passed.");
