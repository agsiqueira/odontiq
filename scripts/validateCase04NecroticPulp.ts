import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";

const caseData = loadCase("case-04")!;
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 38);
for (const expected of ["left mandibular", "five days", "stopped", "returned", "broken", "old filling", "constant", "sharp", "biting", "7/10", "ibuprofen 400 mg", "penicillin", "hives", "cold hurt previously", "no current response to cold", "no swelling", "no drainage", "no fever", "necrotic pulp", "acute apical periodontitis", "no dental insurance", "save the tooth", "antibiotics are not currently indicated"]) assert(corpus.includes(expected), expected);
for (const forbidden of ["\"diagnosis\":\"possible cracked tooth", "\"diagnosis\":\"occlusal trauma", "bit something hard last week", "routine antibiotics are indicated", "delayed antibiotic prescription as required"]) assert(!corpus.includes(forbidden), forbidden);

const visible = (question: string) => buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question }).allowedThisTurn;
const questions: Array<[string, string[]]> = [
  ["Where does it hurt?", ["c4.location"]],
  ["How long has it been hurting?", ["c4.duration"]],
  ["Did it stop and come back?", ["c4.sequence", "c4.filling"]],
  ["Did you bite something hard?", ["c4.no-hard-object"]],
  ["Is the pain constant?", ["c4.constant"]],
  ["Does biting hurt?", ["c4.biting"]],
  ["Did cold hurt before?", ["c4.cold-prior"]],
  ["Does cold still affect it?", ["c4.cold-now"]],
  ["Have you had swelling?", ["c4.no-swelling"]],
  ["Any drainage or pus?", ["c4.no-drainage"]],
  ["Any fever or chills?", ["c4.no-fever"]],
  ["Are you allergic to penicillin?", ["c4.penicillin"]],
  ["What reaction do you have?", ["c4.hives"]],
  ["What have you taken for pain?", ["c4.medication"]],
  ["Do you want to save the tooth?", ["c4.goal"]],
  ["Can you get a dental appointment?", ["c4.access"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert(visible("Are you allergic to penicillin?").every((fact) => !/hives/i.test(fact.text)));
assert(visible("Did cold hurt before?").every((fact) => !/percussion|purulence|fluctuance/i.test(fact.text)));
assert(visible("Tell me about the pain.").every((fact) => !/insurance|hives|airway/i.test(fact.text)));
assert.equal(visible("The tooth is necrotic.").length, 0);
assert(!caseData.supportingInfo.patientFacts!.some((fact) => /marked tenderness to percussion|no current response to cold stimulus|mild gingival erythema/i.test(fact.text)));

for (const [question, scriptId] of [["Did it stop and come back?", "c4-sequence"], ["Did you bite something hard?", "c4-hard-object"], ["Does cold still affect it?", "c4-cold-current"], ["What reaction do you have?", "c4-allergy-reaction"], ["Do you want to save the tooth?", "c4-goal"]] as const) assert.equal(sendMessage("case-04", question, []).matchedConversationId, scriptId, question);
const scripts = caseData.conversation.scripted;
assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);
assert.equal(new Set(scripts.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"))).size, scripts.length);

const exam = caseData.assets.examinations.find((item) => item.id === "oral-examination");
assert(exam?.type === "clinical-findings");
for (const expected of ["left mandibular first molar", "no current response to cold", "percussion", "biting", "large old filling", "no swelling", "no fluctuance", "no pus", "no sinus tract", "soft", "patent"]) assert(JSON.stringify(exam).toLowerCase().includes(expected), expected);

const rubric = facultyRubrics.find((item) => item.caseId === "case-04")!;
for (const id of ["C4-IG-007", "C4-IG-008", "C4-IG-009", "C4-IG-010", "C4-IG-011", "C4-CI-002", "C4-CI-005", "C4-CI-006", "C4-MP-002", "C4-MP-003", "C4-MP-004", "C4-PD-001", "C4-EX-002", "C4-EX-003", "C4-EX-004", "C4-EX-005", "C4-EX-006", "C4-EX-007"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(rubric.criteria.find((criterion) => criterion.id === "C4-PD-001")?.acceptedConcepts?.includes("inferior alveolar nerve block"));
assert(!rubric.criteria.some((criterion) => criterion.acceptedConcepts?.some((concept) => /cracked tooth|occlusal trauma/i.test(concept))));
assert(!rubric.criteria.some((criterion) => criterion.name.includes("antibiotic") && criterion.expectedValue === true && !criterion.name.includes("not-indicated")));
assert(rubric.criteria.find((criterion) => criterion.id === "C4-PC-004")?.facultyNotes?.includes("pending faculty review"));
assert(rubric.criteria.filter((criterion) => criterion.id !== "C4-EX-001" && criterion.id.startsWith("C4-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));

console.log("Case 4 necrotic-pulp validation passed.");
