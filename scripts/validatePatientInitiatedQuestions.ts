import assert from "node:assert/strict";

import {
  PATIENT_QUESTION_CATALOG,
  getPatientQuestion,
} from "../src/lib/patientQuestions/catalog";
import {
  buildPatientQuestionClassifierPrompt,
  classifierEventsForCase,
  type PatientQuestionEvidenceAlias,
} from "../src/lib/patientQuestions/prompt";
import { parsePatientQuestionClassification } from "../src/lib/patientQuestions/schema";
import { classifyPatientQuestionTrigger } from "../src/lib/patientQuestions/classifier";
import { applyPatientQuestionClassification } from "../src/lib/patientQuestions/stateMachine";
import {
  EMPTY_PATIENT_QUESTION_EVENTS,
  createEmptyPatientQuestionState,
  type PatientQuestionClassification,
  type PatientQuestionEventId,
  type PatientQuestionEvents,
  type PatientQuestionId,
} from "../src/lib/patientQuestions/types";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { SAFE_PATIENT_BASE_RESPONSE_FALLBACK } from "../src/lib/patientRoleGuard";

const expectedText: Record<PatientQuestionId, string> = {
  "c1-extraction-question": "Will they pull out the bad tooth?",
  "c2-antibiotic-effect-question": "Will the antibiotic make the tooth better?",
  "c3-follow-up-needed-question":
    "Since I am going to do this, do I still need to see my dentist soon?",
  "c3-follow-up-why": "Why?",
  "c4-antibiotic-needed-question": "Do I need an antibiotic?",
  "c5-antibiotic-request":
    "Can I get an antibiotic? It has helped in the past when I had a toothache.",
};
assert.equal(PATIENT_QUESTION_CATALOG.length, 6);
for (const [id, text] of Object.entries(expectedText)) {
  assert.equal(getPatientQuestion(id as PatientQuestionId)?.text, text);
}

function classification(
  caseId: string,
  events: Partial<PatientQuestionEvents>,
): PatientQuestionClassification {
  return {
    schemaVersion: 1,
    caseId,
    analyzedStudentMessageId: "student-current-id",
    detectedEvents: events,
    confidence: 0.97,
    evidenceAliases: ["patient-draft"],
    evidenceMessageIds: ["patient-draft-id"],
  };
}

const simpleCases: Array<{
  caseId: string;
  id: PatientQuestionId;
  events: Partial<PatientQuestionEvents>;
}> = [
  {
    caseId: "case-01",
    id: "c1-extraction-question",
    events: { hospitalAdmissionOrSurgicalManagementDiscussed: true },
  },
  {
    caseId: "case-02",
    id: "c2-antibiotic-effect-question",
    events: { antibioticsRecommendedAsCurrentPlan: true },
  },
  {
    caseId: "case-04",
    id: "c4-antibiotic-needed-question",
    events: {
      painManagementOrDispositionDiscussed: true,
      antibioticsRecommended: false,
      antibioticsNotIndicatedExplained: false,
    },
  },
  {
    caseId: "case-05",
    id: "c5-antibiotic-request",
    events: { patientPainDescribed: true },
  },
];

for (const test of simpleCases) {
  const first = applyPatientQuestionClassification({
    caseId: test.caseId,
    classification: classification(test.caseId, test.events),
  });
  assert.equal(first.selectedQuestionId, test.id);
  const repeated = applyPatientQuestionClassification({
    caseId: test.caseId,
    state: first.state,
    classification: classification(test.caseId, test.events),
  });
  assert.equal(repeated.selectedQuestionId, undefined, `${test.id} must be once-only`);
}

for (const suppressingEvent of [
  "antibioticsRecommended",
  "antibioticsNotIndicatedExplained",
] as const) {
  const suppressed = applyPatientQuestionClassification({
    caseId: "case-04",
    classification: classification("case-04", {
      painManagementOrDispositionDiscussed: true,
      antibioticsRecommended: false,
      antibioticsNotIndicatedExplained: false,
      [suppressingEvent]: true,
    }),
  });
  assert.equal(suppressed.selectedQuestionId, undefined);
}

const c5Insufficient = applyPatientQuestionClassification({
  caseId: "case-05",
  classification: classification("case-05", { patientPainDescribed: false }),
});
assert.equal(c5Insufficient.selectedQuestionId, undefined);

const c3Initial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: classification("case-03", {
    incisionAndDrainageProposed: true,
    patientAgreedToIncisionAndDrainage: true,
  }),
});
assert.equal(c3Initial.selectedQuestionId, "c3-follow-up-needed-question");

const whyWithoutInitial = applyPatientQuestionClassification({
  caseId: "case-03",
  classification: classification("case-03", {
    promptDentalFollowUpConfirmed: true,
  }),
});
assert.equal(whyWithoutInitial.selectedQuestionId, undefined);

const whyIncomplete = applyPatientQuestionClassification({
  caseId: "case-03",
  state: c3Initial.state,
  classification: classification("case-03", {
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true,
    definitiveDentalTreatmentExplained: false,
  }),
});
assert.equal(whyIncomplete.selectedQuestionId, "c3-follow-up-why");

const whyComplete = applyPatientQuestionClassification({
  caseId: "case-03",
  state: c3Initial.state,
  classification: classification("case-03", {
    promptDentalFollowUpConfirmed: true,
    drainageTemporaryOrNondefinitiveExplained: true,
    definitiveDentalTreatmentExplained: true,
  }),
});
assert.equal(whyComplete.selectedQuestionId, undefined);

const productionStudentId = "case-05-1784904859139-1";
const productionPatientId = "1ae30f2a-6630-4ef5-b7b4-0fe44364a6d4";
const productionDraft =
  "It's a sharp, throbbing pain that won't let me rest, and it's been going on for a few days now.";
const productionPrompt = buildPatientQuestionClassifierPrompt({
  caseId: "case-05",
  studentMessageId: productionStudentId,
  studentMessage: "Please, describe your pain.",
  draftPatientMessageId: productionPatientId,
  draftPatientResponse: productionDraft,
  conversation: [],
  state: createEmptyPatientQuestionState(),
});
assert.deepEqual(productionPrompt.allowedEvents, ["patientPainDescribed"]);
assert(!productionPrompt.systemPrompt.includes("eligibleQuestionId"));
assert(!productionPrompt.userPrompt.includes(productionStudentId));
assert(!productionPrompt.userPrompt.includes(productionPatientId));
assert(!productionPrompt.userPrompt.includes('"confidence":0'));
assert(!productionPrompt.userPrompt.includes('"patientPainDescribed":false'));
assert(productionPrompt.userPrompt.includes("student-current"));
assert(productionPrompt.userPrompt.includes("patient-draft"));

const rawProductionResult = JSON.stringify({
  schemaVersion: 1,
  caseId: "case-05",
  events: { patientPainDescribed: true },
  confidence: 0.97,
  evidence: ["patient-draft"],
});
const classifiedProduction = await classifyPatientQuestionTrigger({
  provider: {
    name: "case-05-regression",
    generateText: async () => ({ text: rawProductionResult }),
    generateConversationResponse: async () => ({ text: productionDraft }),
  },
  caseId: "case-05",
  studentMessageId: productionStudentId,
  studentMessage: "Please, describe your pain.",
  draftPatientMessageId: productionPatientId,
  draftPatientResponse: productionDraft,
  conversation: [],
  state: createEmptyPatientQuestionState(),
});
assert(classifiedProduction.success);
const parsedProduction = parsePatientQuestionClassification({
  text: rawProductionResult,
  caseId: "case-05",
  studentMessageId: productionStudentId,
  allowedEvents: productionPrompt.allowedEvents,
  evidenceAliases: productionPrompt.evidenceAliases,
});
assert.equal(parsedProduction.success, true);
assert(parsedProduction.success);
assert.deepEqual(parsedProduction.classification.evidenceMessageIds, [
  productionPatientId,
]);
const productionTransition = applyPatientQuestionClassification({
  caseId: "case-05",
  classification: parsedProduction.classification,
});
assert.equal(productionTransition.selectedQuestionId, "c5-antibiotic-request");
const finalProductionResponse = `${productionDraft} ${getPatientQuestion(
  productionTransition.selectedQuestionId!,
)!.text}`;
assert.equal(
  finalProductionResponse,
  `${productionDraft} Can I get an antibiotic? It has helped in the past when I had a toothache.`,
);

const expectedEvents: Record<string, readonly PatientQuestionEventId[]> = {
  "case-01": ["hospitalAdmissionOrSurgicalManagementDiscussed"],
  "case-02": ["antibioticsRecommendedAsCurrentPlan"],
  "case-03": [
    "incisionAndDrainageProposed",
    "patientAgreedToIncisionAndDrainage",
  ],
  "case-04": [
    "painManagementOrDispositionDiscussed",
    "antibioticsRecommended",
    "antibioticsNotIndicatedExplained",
  ],
  "case-05": ["patientPainDescribed"],
};
for (const [caseId, events] of Object.entries(expectedEvents)) {
  assert.deepEqual(
    classifierEventsForCase(caseId, createEmptyPatientQuestionState()),
    events,
  );
  const prompt = buildPatientQuestionClassifierPrompt({
    caseId,
    studentMessageId: "student-id",
    studentMessage: "Current provider message.",
    draftPatientMessageId: "patient-id",
    draftPatientResponse: "Current patient response.",
    conversation: [],
    state: createEmptyPatientQuestionState(),
  });
  for (const knownEvent of Object.keys(EMPTY_PATIENT_QUESTION_EVENTS)) {
    assert.equal(
      prompt.systemPrompt.includes(`- ${knownEvent}:`),
      events.includes(knownEvent as PatientQuestionEventId),
      `${caseId} prompt event scope: ${knownEvent}`,
    );
  }
}

const case3FollowUpState = createEmptyPatientQuestionState();
case3FollowUpState.emittedQuestionIds.push("c3-follow-up-needed-question");
assert.deepEqual(classifierEventsForCase("case-03", case3FollowUpState), [
  "promptDentalFollowUpConfirmed",
  "drainageTemporaryOrNondefinitiveExplained",
  "definitiveDentalTreatmentExplained",
]);

const aliases: PatientQuestionEvidenceAlias[] = [
  {
    alias: "patient-draft",
    messageId: productionPatientId,
    role: "patient",
    content: productionDraft,
  },
];
function parseFixture(value: unknown) {
  return parsePatientQuestionClassification({
    text: typeof value === "string" ? value : JSON.stringify(value),
    caseId: "case-05",
    studentMessageId: productionStudentId,
    allowedEvents: ["patientPainDescribed"],
    evidenceAliases: aliases,
  });
}
assert.deepEqual(parseFixture("{bad"), {
  success: false,
  reason: "invalid-json",
  safeMetadata: { rawOutputLength: 4 },
});
assert.equal(
  parseFixture({
    schemaVersion: 1,
    caseId: "case-05",
    events: { patientPainDescribed: true },
    confidence: 0.4,
    evidence: ["patient-draft"],
  }).success,
  false,
);
assert.equal(
  parseFixture({
    schemaVersion: 1,
    caseId: "case-05",
    events: { patientPainDescribed: true },
    confidence: 0.97,
    evidence: ["invented"],
  }).success,
  false,
);
const wrongCaseEvent = parseFixture({
  schemaVersion: 1,
  caseId: "case-05",
  events: { antibioticsRecommended: true },
  confidence: 0.97,
  evidence: ["patient-draft"],
});
assert(!wrongCaseEvent.success && wrongCaseEvent.reason === "wrong-case-event");

const missingEvidence = parseFixture({
  schemaVersion: 1,
  caseId: "case-05",
  events: { patientPainDescribed: true },
  confidence: 0.97,
  evidence: [],
});
assert(!missingEvidence.success && missingEvidence.reason === "missing-evidence");

const providerFailure = await classifyPatientQuestionTrigger({
  provider: {
    name: "failing-regression-provider",
    generateText: async () => {
      throw new Error("diagnostic failure");
    },
    generateConversationResponse: async () => ({ text: "" }),
  },
  caseId: "case-05",
  studentMessageId: productionStudentId,
  studentMessage: "Please, describe your pain.",
  draftPatientMessageId: productionPatientId,
  draftPatientResponse: productionDraft,
  conversation: [],
  state: createEmptyPatientQuestionState(),
});
assert(!providerFailure.success && providerFailure.reason === "provider-failure");

const inventedQuestion = await generatePatientRoleSafeResponse({
  initialOutput: "Okay. Is the medicine safe?",
  retry: async () => "All right. What happens next?",
  allowPatientInitiatedQuestion: false,
});
assert.equal(inventedQuestion.text, SAFE_PATIENT_BASE_RESPONSE_FALLBACK);
assert.deepEqual(createEmptyPatientQuestionState().emittedQuestionIds, []);

console.log("Patient-initiated question validation passed.");
