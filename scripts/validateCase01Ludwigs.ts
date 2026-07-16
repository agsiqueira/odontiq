import assert from "node:assert/strict";
import fs from "node:fs";
import { loadCase } from "../src/data/cases";
import { sendMessage, type ConversationMessage } from "../src/lib/conversationEngine";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";

const caseData = loadCase("case-01")!;
assert(caseData, "Case 1 must load");
const corpus = JSON.stringify(caseData).toLowerCase();

assert.equal(caseData.patient.age, 52);
assert.equal(caseData.metadata.urgency, "Emergency");
for (const expected of ["left mandibular", "four days", "bilateral", "submandibular", "sublingual", "fever", "diabetes", "hypertension", "metformin", "lisinopril", "one pack", "ludwig's angina"]) {
  assert(corpus.includes(expected), `Case 1 must include ${expected}`);
}
const vitalSigns = caseData.assets.examinations.find((item) => item.id === "vital-signs");
assert(vitalSigns?.type === "vital-signs");
assert.deepEqual(
  vitalSigns.findings.map((item) => item.value),
  ["38.6°C (101.5°F)", "112 bpm", "142/86 mmHg", "24 breaths/min", "94% on room air"],
);

function visible(question: string, conversation: ConversationMessage[] = []) {
  return buildPatientDisclosureState({ caseData, conversation, latestStudentMessage: question });
}

const reachability: Array<[string, string[]]> = [
  ["Are you having trouble swallowing?", ["c1.dysphagia"]],
  ["Can you swallow liquids?", ["c1.liquids"]],
  ["Are you having trouble breathing?", ["c1.dyspnea"]],
  ["Is breathing worse when you lie down?", ["c1.dyspnea-supine"]],
  ["Has your voice changed?", ["c1.voice"]],
  ["Are you drooling?", ["c1.drooling"]],
  ["Any noisy breathing?", ["c1.noisy-breathing"]],
  ["Have you had a fever?", ["c1.fever"]],
  ["Any chills?", ["c1.chills"]],
  ["What medical conditions do you have?", ["c1.conditions"]],
  ["What medications do you take?", ["c1.metformin", "c1.lisinopril"]],
  ["Why haven't you had the tooth removed?", ["c1.access"]],
];
for (const [question, expectedIds] of reachability) {
  assert.deepEqual(visible(question).allowedThisTurn.map((fact) => fact.id), expectedIds, question);
}

const painIds = visible("Tell me about the pain.").allowedThisTurn.map((fact) => fact.id);
assert(painIds.every((id) => !/^c1\.(?:dysphagia|liquids|dyspnea|drooling|voice|noisy)/.test(id)), "Pain must not expose airway facts");
assert(visible("Are you having trouble swallowing?").allowedThisTurn.every((fact) => fact.topic !== "medications"), "Swallowing must not expose medications");
assert(visible("Have you had a fever?").allowedThisTurn.every((fact) => fact.topic !== "medications"), "Fever must not expose medications");
assert.equal(visible("You have Ludwig's angina.").allowedThisTurn.length, 0, "Provider statements must not unlock facts");
assert.equal(visible("What is the diagnosis?").allowedThisTurn.length, 0, "The patient must not volunteer the diagnosis");
for (const examinerTerm of ["board-like", "posteriorly displaced", "inspiratory stridor", "induration", "fluctuance"]) {
  assert(!caseData.supportingInfo.patientFacts!.some((fact) => fact.text.toLowerCase().includes(examinerTerm)), `${examinerTerm} must remain examination-only`);
}

const askedButOmitted: ConversationMessage[] = [
  { id: "s1", role: "student", text: "Are you drooling?", timestamp: "2026-07-16T12:00:00.000Z" },
  { id: "p1", role: "patient", text: "Please give me a moment.", timestamp: "2026-07-16T12:00:01.000Z" },
];
assert(visible("Are you drooling?", askedButOmitted).allowedThisTurn.some((fact) => fact.id === "c1.drooling"), "An omitted fact must remain available");
const spoken: ConversationMessage[] = [
  ...askedButOmitted.slice(0, 1),
  { id: "p2", role: "patient", text: "Yes, I cannot stop drooling.", timestamp: "2026-07-16T12:00:01.000Z" },
];
assert(visible("Are you drooling?", spoken).alreadyDisclosed.some((fact) => fact.id === "c1.drooling"), "A spoken fact must remain available for continuity");

const legacyExamples: Array<[string, string]> = [
  ["Are you having trouble swallowing?", "c1-swallowing"],
  ["Can you swallow liquids?", "c1-swallow-liquids"],
  ["Is breathing worse when you lie down?", "c1-positional-breathing"],
  ["Has your voice changed?", "c1-voice"],
];
for (const [question, expectedScript] of legacyExamples) assert.equal(sendMessage("case-01", question, []).matchedConversationId, expectedScript, question);
const scriptIds = caseData.conversation.scripted.map((script) => script.id);
assert.equal(new Set(scriptIds).size, scriptIds.length, "Case 1 script IDs must be unique");
const triggerSets = caseData.conversation.scripted.map((script) => script.triggers.map((trigger) => trigger.toLowerCase()).sort().join("|"));
assert.equal(new Set(triggerSets).size, triggerSets.length, "Case 1 scripts must not have duplicate trigger sets");

const rubric = facultyRubrics.find((item) => item.caseId === "case-01")!;
for (const id of ["C1-CI-001", "C1-CI-003", "C1-EX-002", "C1-EX-003", "C1-EX-004", "C1-EX-005", "C1-EX-006", "C1-MP-008", "C1-MP-009", "C1-MP-010", "C1-MP-011"]) assert(rubric.criteria.some((criterion) => criterion.id === id), `Missing rubric criterion ${id}`);
assert(!JSON.stringify(rubric).includes("Recognized Airway Is Patent"));

const reportRoute = fs.readFileSync("src/app/api/report/route.ts", "utf8");
assert(reportRoute.includes("supportingFindings: normalizeStringList(request.coveredFacts)"), "Legacy report must use obtained facts, not expected key findings");
assert(!caseData.supportingInfo.reportData.idealSummary.toLowerCase().includes("right"));

console.log("Case 1 Ludwig's angina validation passed.");
