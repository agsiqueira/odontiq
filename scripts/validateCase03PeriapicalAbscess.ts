import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";

const caseData = loadCase("case-03")!;
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 25);
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
  ["Have you had a fever?", ["c3.no-fever"]],
  ["Can you open your mouth?", ["c3.mouth-opening"]],
  ["Any trouble swallowing?", ["c3.swallowing"]],
  ["Any trouble breathing?", ["c3.breathing"]],
  ["What medical conditions do you have?", ["c3.ulcers"]],
  ["What medications do you take?", ["c3.pepcid"]],
  ["Does ibuprofen bother your stomach?", ["c3.ibuprofen"]],
  ["Has that tooth had a root canal?", ["c3.crown", "c3.rct"]],
  ["Do you smoke?", ["c3.smoking"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert(visible("Have you had a fever?").every((fact) => !/ulcer|pepcid|ibuprofen|diabetes/i.test(fact.text)));
assert(visible("What medical conditions do you have?").every((fact) => !/pepcid/i.test(fact.text)));
assert(visible("Does chewing hurt?").every((fact) => !/purulence|fluctuance/i.test(fact.text)));
assert(visible("Tell me about the pain.").every((fact) => !/ulcer|breath|swallow|voice|trismus/i.test(fact.text)));
assert.equal(visible("The examination shows purulence.").length, 0);
assert(!caseData.supportingInfo.patientFacts!.some((fact) => /purulence|fluctuance|percussion|cold-negative/i.test(fact.text)));

for (const [question, scriptId] of [["Have you had a fever?", "c3-fever"], ["Does ibuprofen bother your stomach?", "c3-ibuprofen"], ["Has that tooth had a root canal?", "c3-root-canal"], ["Does it travel anywhere?", "c3-radiation"], ["Can you open your mouth?", "c3-mouth-opening"]] as const) assert.equal(sendMessage("case-03", question, []).matchedConversationId, scriptId, question);
const scripts = caseData.conversation.scripted;
assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);
assert.equal(new Set(scripts.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"))).size, scripts.length);

const exam = caseData.assets.examinations.find((item) => item.id === "oral-examination");
assert(exam?.type === "clinical-findings");
for (const finding of ["fluctuance", "purulence", "percussion", "biting", "palpation", "cold-negative", "floor of mouth", "no stridor"]) assert(JSON.stringify(exam).toLowerCase().includes(finding), finding);

const rubric = facultyRubrics.find((item) => item.caseId === "case-03")!;
for (const id of ["C3-PD-001", "C3-PD-002", "C3-PD-003", "C3-MP-001", "C3-MP-002", "C3-MP-004", "C3-MP-005", "C3-MP-006", "C3-CI-004", "C3-EX-002", "C3-EX-003", "C3-EX-004", "C3-EX-005", "C3-EX-006"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(rubric.criteria.find((criterion) => criterion.id === "C3-PD-001")?.acceptedConcepts?.includes("inferior alveolar nerve block"));
assert(!rubric.criteria.some((criterion) => criterion.acceptedConcepts?.some((concept) => /maxillary infiltration/i.test(concept))));
assert(!rubric.criteria.some((criterion) => criterion.id === "C3-MP-002" && criterion.acceptedConcepts?.some((concept) => /^ibuprofen$|^nsaid$/i.test(concept))));
assert(rubric.criteria.find((criterion) => criterion.id === "C3-MP-002")?.facultyNotes?.includes("pending faculty review"));
assert(rubric.criteria.filter((criterion) => criterion.id !== "C3-EX-001" && criterion.id.startsWith("C3-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));

console.log("Case 3 periapical-abscess validation passed.");
