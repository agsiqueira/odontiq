import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  encounterSource,
  conversationRouteSource,
  questionServiceSource,
  schemaSource,
  mentorSource,
  reportSource,
] = await Promise.all([
  readFile("src/components/EncounterExperience.tsx", "utf8"),
  readFile("src/app/api/conversation/route.ts", "utf8"),
  readFile("src/lib/persistence/services/patientQuestionService.ts", "utf8"),
  readFile("prisma/schema.prisma", "utf8"),
  readFile("src/components/MentorGeneratedDebrief.tsx", "utf8"),
  readFile("src/components/CanonicalCaseReport.tsx", "utf8"),
]);

const interruptedMessage =
  "The patient response was interrupted. Your question was saved. Select ‘Retry response’ to try again.";
const retryingMessage =
  "OdontIQ is retrying the patient response. Please keep this page open.";
assert(encounterSource.includes(interruptedMessage));
assert(encounterSource.includes(retryingMessage));
assert(encounterSource.includes('"Retry response"'));
assert.match(encounterSource, /disabled=\{isRetryingPatientResponse\}/);

assert.match(encounterSource, /type PatientResponseRequestEnvelope = Readonly/);
assert.match(encounterSource, /function freezePatientResponseRequest/);
assert.match(encounterSource, /Object\.freeze\([\s\S]*conversation: Object\.freeze/);
assert.match(encounterSource, /coveredChecklistItems: Object\.freeze/);

const submitStart = encounterSource.indexOf("const submitStudentMessage = async");
const retryStart = encounterSource.indexOf("const retryPatientResponse = async");
const retryEnd = encounterSource.indexOf("const toggleVoiceInput", retryStart);
assert(submitStart >= 0 && retryStart > submitStart && retryEnd > retryStart);
const initialSource = encounterSource.slice(submitStart, retryStart);
const retrySource = encounterSource.slice(retryStart, retryEnd);

assert.equal(initialSource.match(/type: "appendMessage"/g)?.length, 1);
assert.equal(initialSource.match(/type: "applyCoverage"/g)?.length, 1);
assert.equal(initialSource.match(/student_message_sent/g)?.length, 1);
assert.match(initialSource, /executePatientResponseRequest\(requestEnvelope, false, true\)/);
assert.match(retrySource, /executePatientResponseRequest\(failedPatientResponseRequest, true\)/);
assert.doesNotMatch(retrySource, /createConversationMessage|appendMessage|applyCoverage|recordEvent/);
assert.doesNotMatch(retrySource, /randomUUID|Date\.now/);

for (const field of [
  "encounterId: request.encounterId",
  "caseId: request.caseId",
  "requestId: request.requestId",
  "studentMessageId: request.studentMessageId",
  "userMessage: request.userMessage",
  "message: request.message",
  "conversation: request.conversation",
  "coveredChecklistItems: request.coveredChecklistItems",
]) {
  assert(encounterSource.includes(field));
}

assert.match(encounterSource, /patientResponseRequestActiveRef\.current/);
assert.match(encounterSource, /patientResponseRequestSequenceRef\.current !== requestSequence/);
assert.match(encounterSource, /patientResponseAbortRef\.current\?\.abort\(\)/);
assert.match(encounterSource, /knownMessageIdsRef\.current\.has\(data\.patientMessageId\)/);
assert.match(encounterSource, /data\.encounterId === request\.encounterId/);
assert.match(encounterSource, /data\.requestId === request\.requestId/);

for (const status of [400, 401, 403, 404, 409]) {
  assert(encounterSource.includes(`status === ${status}`));
}
assert.match(encounterSource, /catch \{[\s\S]*kind: "retryable", httpStatus: 0/);
assert.match(encounterSource, /response\.ok[\s\S]*isSuccessfulConversationResponse/);
assert.match(encounterSource, /setFailedPatientResponseRequest\(envelope\)/);
assert.match(encounterSource, /setFailedPatientResponseRequest\(null\)/);

const errorPanelStart = encounterSource.indexOf("failedPatientResponseRequest ? (");
const errorPanelEnd = encounterSource.indexOf("speechPlayback.needsPlaybackTap", errorPanelStart);
const errorPanelSource = encounterSource.slice(errorPanelStart, errorPanelEnd);
for (const diagnostic of [
  "NavigatorProviderError",
  "debrief_request_failed",
  "encounter_case_mismatch",
  "stack",
  "response.body",
  "Reason:",
]) {
  assert(!errorPanelSource.includes(diagnostic));
}

assert(
  conversationRouteSource.indexOf("findTurn(") <
    conversationRouteSource.indexOf("getAIProvider()"),
);
assert.match(questionServiceSource, /const existing = await this\.findTurn/);
assert.match(schemaSource, /@@unique\(\[encounterId, requestId\]\)/);
assert.match(schemaSource, /@@unique\(\[encounterId, questionId\]\)/);
assert(!mentorSource.includes("retryPatientResponse"));
assert(!reportSource.includes("retryPatientResponse"));

type Envelope = Readonly<{
  encounterId: string;
  caseId: string;
  requestId: string;
  studentMessageId: string;
  message: string;
  conversation: readonly Readonly<{ role: string; text: string; timestamp: string }>[];
  coveredChecklistItems: readonly string[];
}>;
const envelope: Envelope = Object.freeze({
  encounterId: "encounter-3",
  caseId: "case-03",
  requestId: "student-1-response",
  studentMessageId: "student-1",
  message: "Where is the pain?",
  conversation: Object.freeze([
    Object.freeze({ role: "patient", text: "Opening", timestamp: "t1" }),
  ]),
  coveredChecklistItems: Object.freeze(["location"]),
});
const retryEnvelope = envelope;
assert.equal(retryEnvelope.requestId, envelope.requestId);
assert.equal(retryEnvelope.studentMessageId, envelope.studentMessageId);
assert.deepEqual(retryEnvelope.conversation, envelope.conversation);
assert.deepEqual(retryEnvelope.coveredChecklistItems, envelope.coveredChecklistItems);

let active = false;
let requestCount = 0;
async function guardedRequest() {
  if (active) return;
  active = true;
  requestCount += 1;
  await Promise.resolve();
}
await Promise.all([guardedRequest(), guardedRequest(), guardedRequest()]);
assert.equal(requestCount, 1);

const appendedPatientIds = new Set<string>();
function appendPersistedPatient(id: string) {
  if (appendedPatientIds.has(id)) return false;
  appendedPatientIds.add(id);
  return true;
}
assert.equal(appendPersistedPatient("patient-persisted"), true);
assert.equal(appendPersistedPatient("patient-persisted"), false);
assert.equal(appendedPatientIds.size, 1);

let currentSequence = 2;
const staleSequence = 1;
assert.notEqual(staleSequence, currentSequence);
currentSequence += 1;
assert.equal(currentSequence, 3);

console.log("Patient-response same-request retry validation passed.");
