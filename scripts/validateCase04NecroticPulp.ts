import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { canonicalCase04 } from "../src/data/canonicalCaseSpecs/case-04";

const caseData = loadCase("case-04")!;
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 38);
assert.equal(caseData.patient.sex, "Not specified");
assert.equal(canonicalCase04.identity.gender.status, "not-specified");
for (const expected of ["lower-left molar", "five days", "stopped", "returned", "twenty years", "may have broken", "constant", "sharp", "biting", "7/10", "ibuprofen 400 mg", "penicillin", "hives", "cold hurt previously", "cold is not painful now", "no swelling", "no drainage", "no fever", "necrotic pulp", "acute apical periodontitis", "no dental insurance", "save the tooth", "antibiotics are not currently indicated"]) assert(corpus.includes(expected), expected);
for (const forbidden of ["\"diagnosis\":\"possible cracked tooth", "\"diagnosis\":\"occlusal trauma", "bit something hard last week", "routine antibiotics are indicated", "delayed antibiotic prescription as required"]) assert(!corpus.includes(forbidden), forbidden);

const visible = (question: string) => buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question }).allowedThisTurn;
const questions: Array<[string, string[]]> = [
  ["Where does it hurt?", ["c4.location"]],
  ["How long has it been hurting?", ["c4.duration"]],
  ["Did it stop and come back?", ["c4.sequence", "c4.filling-break-belief"]],
  ["Did you bite something hard?", ["c4.hard-object-unknown"]],
  ["Is the pain constant?", ["c4.constant"]],
  ["Does biting hurt?", ["c4.biting"]],
  ["How old is the filling?", ["c4.filling-present"]],
  ["Is the filling definitely broken?", ["c4.filling-break-belief"]],
  ["Did cold hurt before?", ["c4.cold-prior"]],
  ["Does cold still affect it?", ["c4.cold-now"]],
  ["Have you had swelling?", ["c4.no-swelling", "c4.no-gum-swelling"]],
  ["Any drainage or pus?", ["c4.no-drainage"]],
  ["Any fever or chills?", ["c4.no-fever"]],
  ["Is there gum swelling or an abscess?", ["c4.no-gum-swelling"]],
  ["Can you open your mouth normally?", ["c4.mouth-opening"]],
  ["Has your voice changed?", ["c4.voice"]],
  ["Are you allergic to penicillin?", ["c4.penicillin"]],
  ["What reaction do you have?", ["c4.hives"]],
  ["What have you taken for pain?", ["c4.medication"]],
  ["How often do you take ibuprofen?", ["c4.ibuprofen-frequency-unknown"]],
  ["Can you safely take ibuprofen?", ["c4.ibuprofen-suitable"]],
  ["Have you used opioids?", ["c4.opioid-negative"]],
  ["Do you drink alcohol?", ["c4.alcohol"]],
  ["Do you use illicit drugs?", ["c4.illicit-drugs-negative"]],
  ["When was your last dental visit?", ["c4.last-dentist"]],
  ["Have you had surgery?", ["c4.surgery-unknown"]],
  ["Have you taken Tylenol before coming in?", ["c4.prior-acetaminophen-unknown"]],
  ["Have you taken antibiotics before coming in?", ["c4.prior-antibiotics-unknown"]],
  ["Have you had a root canal?", ["c4.root-canal-unknown"]],
  ["Has this painful tooth been extracted?", ["c4.painful-tooth-not-extracted"]],
  ["Do you know your exact temperature?", ["c4.temperature-unknown"]],
  ["Do you know the diagnosis?", ["c4.diagnosis-unknown"]],
  ["Do you know what percentage of the tooth remains?", ["c4.tooth-percentage-unknown"]],
  ["Do you want to save the tooth?", ["c4.goal"]],
  ["Can you get a dental appointment?", ["c4.access"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert(visible("Are you allergic to penicillin?").every((fact) => !/hives/i.test(fact.text)));
assert(visible("Did cold hurt before?").every((fact) => !/percussion|purulence|fluctuance/i.test(fact.text)));
assert(visible("Tell me about the pain.").every((fact) => !/insurance|hives|airway/i.test(fact.text)));
assert.equal(visible("The tooth is necrotic.").length, 0);
assert(!caseData.supportingInfo.patientFacts!.some((fact) => /marked tenderness to percussion|no current response to cold stimulus|mild gingival erythema/i.test(fact.text)));

const patientFacts = caseData.supportingInfo.patientFacts ?? [];
for (const response of [
  "The pain is in my lower-right tooth.", "This is an upper-left molar.", "The returned pain has worsened for three days.",
  "The severe biting pain started five days ago with no change.", "The pain is 8/10 now.", "Cold still hurts now.",
  "Cold never hurt before.", "The filling is definitely broken.", "My face is swollen.", "I have pus draining.",
  "There is an abscess in my mouth.", "I have a fever.", "I have chills.", "I am drooling.", "I cannot swallow.",
  "I am short of breath.", "I cannot open my mouth.", "My voice is muffled.", "I have diabetes.",
  "I cannot take ibuprofen.", "I am not allergic to penicillin.", "Penicillin causes stomach upset.", "Penicillin caused anaphylaxis.",
  "I smoke half a pack per day.", "I do not drink alcohol.", "I drink alcohol every day.", "I use illicit drugs.",
  "I saw a dentist recently.", "I have an appointment next week.", "I want the tooth extracted.",
  "I already had this painful tooth extracted.", "I measured a temperature of 103 degrees.",
  "I know I have necrotic pulp.", "I know that only 70% of the tooth remains.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, false, response);

for (const response of [
  "The pain is in a molar on my lower-left side.", "The returned pain has worsened for five days.",
  "It hurt badly about a week ago, stopped, and then returned.", "The biting pain became sharper over the past forty-eight hours.",
  "The pain is seven out of ten and constant now.", "Biting, chewing, and tapping that tooth cause sharp pain.",
  "Cold is not painful now, although it used to hurt.", "That tooth has a large filling placed about twenty years ago.",
  "I think the old filling may have broken, but I'm not certain.", "No, my face is not swollen.",
  "No, I have not noticed pus or drainage.", "No, my gum is not swollen and there is no abscess in my mouth.",
  "No, I have not had fever or chills.", "No, I have no difficulty swallowing.", "No, I am not drooling.",
  "No, I am not short of breath.", "I can open my mouth normally.", "My voice is normal.",
  "My general health is excellent, and I have no known medical problems.",
  "I have taken ibuprofen 400 milligrams as needed, but the pain is still there.",
  "Penicillin gives me hives.", "No, I have no history of opioid use, misuse, or abuse.",
  "I smoke about one pack per day.", "I drink alcohol occasionally.", "No, I do not use illicit drugs.",
  "The last time I saw a dentist was about five years ago.", "I do not have dental insurance, so arranging care will take time.",
  "Yes, I want to save the tooth if possible.", "I don't remember whether I took Tylenol before coming in.",
  "I don't remember whether I took antibiotics before coming in.", "I don't know the diagnosis; I just know the tooth hurts.",
  "I'm not sure whether I bit down on anything hard.", "I'm not sure.",
  "I haven't had a fever, but I don't know an exact temperature.",
]) assert.equal(assessPatientOutputIntegrity(response, patientFacts).valid, true, response);

for (const [question, scriptId] of [["Did it stop and come back?", "c4-sequence"], ["Did you bite something hard?", "c4-hard-object"], ["Does cold still affect it?", "c4-cold-current"], ["What reaction do you have?", "c4-allergy-reaction"], ["Do you want to save the tooth?", "c4-goal"]] as const) assert.equal(sendMessage("case-04", question, []).matchedConversationId, scriptId, question);
assert.equal(sendMessage("case-04", "Did you bite something hard?", []).patientMessage, "I'm not sure whether I bit down on anything hard.");
const scripts = caseData.conversation.scripted;
assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);
assert.equal(new Set(scripts.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"))).size, scripts.length);

const exam = caseData.assets.examinations.find((item) => item.id === "oral-examination");
assert(exam?.type === "clinical-findings");
for (const expected of ["lower-left molar", "cold is not painful now", "percussion", "biting", "large filling", "no swelling", "fluctuance", "purulence", "no intraoral abscess", "mouth opens normally", "voice is normal"]) assert(JSON.stringify(exam).toLowerCase().includes(expected), expected);
assert.equal(caseData.assets.examinations.some((item) => item.id === "vital-signs"), false);
for (const unsupported of ["first molar", "deep caries", "mild erythema", "sinus tract", "36.7", "84 bpm", "124/78"]) assert(!corpus.includes(unsupported), unsupported);

const rubric = facultyRubrics.find((item) => item.caseId === "case-04")!;
for (const id of ["C4-IG-007", "C4-IG-008", "C4-IG-009", "C4-IG-010", "C4-IG-011", "C4-CI-002", "C4-CI-005", "C4-CI-006", "C4-MP-002", "C4-MP-003", "C4-MP-004", "C4-PD-001", "C4-EX-002", "C4-EX-003", "C4-EX-004", "C4-EX-005", "C4-EX-006", "C4-EX-007"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(rubric.criteria.find((criterion) => criterion.id === "C4-PD-001")?.acceptedConcepts?.includes("inferior alveolar nerve block"));
assert(!rubric.criteria.some((criterion) => criterion.acceptedConcepts?.some((concept) => /cracked tooth|occlusal trauma/i.test(concept))));
assert(!rubric.criteria.some((criterion) => criterion.name.includes("antibiotic") && criterion.expectedValue === true && !criterion.name.includes("not-indicated")));
assert(rubric.criteria.find((criterion) => criterion.id === "C4-PC-004")?.facultyNotes?.includes("pending faculty review"));
assert(rubric.criteria.filter((criterion) => criterion.id !== "C4-EX-001" && criterion.id.startsWith("C4-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));

console.log("Case 4 necrotic-pulp validation passed.");
