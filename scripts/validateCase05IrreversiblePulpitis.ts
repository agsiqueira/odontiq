import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { sendMessage } from "../src/lib/conversationEngine";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";

const caseData = loadCase("case-05")!;
const corpus = JSON.stringify(caseData).toLowerCase();
assert.equal(caseData.patient.age, 32);
for (const expected of ["four days", "lower-left", "constant", "deep", "throbbing", "9/10", "spontaneous", "wakes", "cold drinks worsen", "does not stop immediately", "chewing", "slight biting", "no swelling", "no drainage", "no fever", "ibuprofen 400 mg", "five years", "half-pack", "without insurance", "save the tooth", "irreversible pulpitis", "antibiotics are not currently indicated"]) assert(corpus.includes(expected), expected);
for (const forbidden of ["hot drinks worsen", "radiates toward", "not pregnant", "postponed treatment", "known cavity", "two weeks", "\"age\":27", "cold relieves"]) assert(!corpus.includes(forbidden), forbidden);

const visible = (question: string) => buildPatientDisclosureState({ caseData, conversation: [], latestStudentMessage: question }).allowedThisTurn;
const questions: Array<[string, string[]]> = [
  ["Where does it hurt?", ["c5.location"]],
  ["How long has it been hurting?", ["c5.duration"]],
  ["Is the pain constant?", ["c5.constant"]],
  ["Does it hurt spontaneously?", ["c5.spontaneous"]],
  ["Does it wake you at night?", ["c5.nocturnal"]],
  ["What does the pain feel like?", ["c5.quality"]],
  ["How severe is it?", ["c5.severity"]],
  ["Does cold make it worse?", ["c5.cold"]],
  ["Does it stop immediately after the cold is removed?", ["c5.lingering"]],
  ["How long does it keep hurting after cold?", ["c5.lingering"]],
  ["How many seconds does it last after cold?", ["c5.lingering"]],
  ["Does chewing hurt?", ["c5.chewing"]],
  ["Does biting or tapping hurt?", ["c5.biting"]],
  ["Have you had swelling?", ["c5.no-swelling"]],
  ["Any drainage or pus?", ["c5.no-drainage"]],
  ["Any fever or chills?", ["c5.no-fever"]],
  ["Any trouble swallowing?", ["c5.swallowing"]],
  ["Any trouble breathing?", ["c5.breathing"]],
  ["What have you taken for pain?", ["c5.med"]],
  ["Do you smoke?", ["c5.smoking"]],
  ["When was your last dental visit?", ["c5.dental-history"]],
  ["Do you want to save the tooth?", ["c5.goal"]],
  ["Can you afford a dentist or do you have insurance?", ["c5.access"]],
];
for (const [question, ids] of questions) assert.deepEqual(visible(question).map((fact) => fact.id), ids, question);
assert(visible("How many seconds does it last after cold?").every((fact) => !/\b\d+\s*(seconds?|minutes?)\b/i.test(fact.text)));
assert(visible("Does cold make it worse?").every((fact) => !/percussion|chewing|swelling/i.test(fact.text)));
assert(visible("Tell me about the pain.").every((fact) => !/insurance|smok|dental visit/i.test(fact.text)));
assert.equal(visible("You have irreversible pulpitis.").length, 0);

for (const [question, scriptId] of [["spontaneous pain", "c5-spontaneous"], ["wake at night", "c5-nocturnal"], ["cold drinks", "c5-cold"], ["stop immediately", "c5-lingering"], ["chewing uncomfortable", "c5-chewing"], ["tapping", "c5-biting"], ["last dental visit", "c5-dental-history"], ["save the tooth", "c5-goal"]] as const) assert.equal(sendMessage("case-05", question, []).matchedConversationId, scriptId, question);
const scripts = caseData.conversation.scripted;
assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);

const exam = caseData.assets.examinations.find((item) => item.id === "oral-examination");
assert(exam?.type === "clinical-findings");
for (const expected of ["left mandibular first molar", "cold", "persists", "slight tenderness", "no swelling", "no fluctuance", "no purulence", "no gingival palpation pain", "soft", "midline", "patent", "normal voice", "no drooling"]) assert(JSON.stringify(exam).toLowerCase().includes(expected), expected);

const rubric = facultyRubrics.find((item) => item.caseId === "case-05")!;
for (const id of ["C5-IG-007", "C5-IG-008", "C5-IG-009", "C5-IG-010", "C5-IG-011", "C5-MP-002", "C5-MP-003", "C5-MP-004", "C5-MP-005", "C5-CF-005", "C5-CI-002", "C5-CI-006", "C5-EX-002", "C5-EX-003", "C5-EX-004", "C5-EX-005", "C5-EX-006", "C5-EX-007"]) assert(rubric.criteria.some((criterion) => criterion.id === id), id);
assert(!rubric.criteria.some((criterion) => criterion.acceptedConcepts?.some((concept) => /hot sensitivity|radiat|pregnan|postpon/i.test(concept))));
assert(rubric.criteria.filter((criterion) => criterion.id !== "C5-EX-001" && criterion.id.startsWith("C5-EX-")).every((criterion) => criterion.evaluationMode === "clinical-statement"));

console.log("Case 5 irreversible-pulpitis validation passed.");
