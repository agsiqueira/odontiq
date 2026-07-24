import assert from "node:assert/strict";
import {
  CASE_1_HOSPITAL_ACKNOWLEDGEMENT,
  CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT,
  case1PlanAcknowledgement,
} from "../src/lib/case1PlanAcknowledgement";
import { loadCase } from "../src/data/cases";
import { buildPatientDisclosureState } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";
import { assessPatientRole } from "../src/lib/patientRoleGuard";
import { getPatientQuestion } from "../src/lib/patientQuestions/catalog";
import {
  applyPatientQuestionClassification,
  shouldClassifyPatientQuestions,
} from "../src/lib/patientQuestions/stateMachine";
import {
  createEmptyPatientQuestionState,
  type PatientQuestionState,
} from "../src/lib/patientQuestions/types";

const caseData = loadCase("case-01")!;
const emittedQuestionIds = ["c1-extraction-question"];
const noPriorDialogue: string[] = [];

function policy(
  message: string,
  options: {
    caseId?: string;
    emitted?: readonly string[];
    prior?: readonly string[];
    intent?: "disposition_plan" | "other";
  } = {},
) {
  return case1PlanAcknowledgement({
    caseId: options.caseId ?? "case-01",
    message,
    providerMessageIntent: options.intent ?? "disposition_plan",
    emittedQuestionIds: options.emitted ?? emittedQuestionIds,
    priorPatientDialogue: options.prior ?? noPriorDialogue,
  });
}

const hospitalPlans = [
  "I’m going to have oral surgery evaluate you, and you may need to stay in the hospital.",
  "We need to admit you so the oral surgery team can treat this safely.",
  "You’ll remain in the hospital while OMFS evaluates the infection.",
];
for (const message of hospitalPlans) {
  assert.equal(policy(message), CASE_1_HOSPITAL_ACKNOWLEDGEMENT, message);
}

assert.equal(
  policy("The oral surgeon is going to evaluate you now."),
  CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT,
);
assert.equal(
  policy("OMFS will evaluate you now."),
  CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT,
);
assert.equal(
  policy(hospitalPlans[1], { prior: [CASE_1_HOSPITAL_ACKNOWLEDGEMENT] }),
  CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT,
);

for (const message of [
  "Have you ever stayed in a hospital?",
  "Have you seen an oral surgeon before?",
  "You might possibly need something later.",
  "We may have to do something about this.",
  "What do you know about oral surgery?",
]) {
  assert.equal(policy(message), undefined, message);
}
assert.equal(policy(hospitalPlans[0], { emitted: [] }), undefined);
assert.equal(policy(hospitalPlans[0], { caseId: "case-02" }), undefined);
assert.equal(policy(hospitalPlans[0], { intent: "other" }), undefined);

const disclosureState = buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: hospitalPlans[0],
});
assert.equal(disclosureState.providerMessageIntent, "disposition_plan");
assert.equal(
  patientImmediateResponse({
    caseId: "case-01",
    message: hospitalPlans[0],
    disclosureState,
    emittedQuestionIds,
    priorPatientDialogue: [],
  }),
  CASE_1_HOSPITAL_ACKNOWLEDGEMENT,
);
assert.equal(
  patientImmediateResponse({
    caseId: "case-01",
    message: hospitalPlans[0],
    disclosureState,
    emittedQuestionIds: [],
    priorPatientDialogue: [],
  }),
  undefined,
  "The initial plan must remain on the normal question-trigger path",
);

for (const acknowledgement of [
  CASE_1_HOSPITAL_ACKNOWLEDGEMENT,
  CASE_1_SIMPLE_PLAN_ACKNOWLEDGEMENT,
]) {
  assert.equal(assessPatientRole(acknowledgement).valid, true, acknowledgement);
  assert.equal(
    assessPatientOutputIntegrity(acknowledgement, []).valid,
    true,
    acknowledgement,
  );
}

const initialState = createEmptyPatientQuestionState();
assert.equal(shouldClassifyPatientQuestions("case-01", initialState), true);
const afterQuestion = applyPatientQuestionClassification({
  caseId: "case-01",
  state: initialState,
  classification: {
    schemaVersion: 1,
    caseId: "case-01",
    analyzedStudentMessageId: "student-plan-1",
    detectedEvents: {
      hospitalAdmissionOrSurgicalManagementDiscussed: true,
    },
    confidence: 0.99,
    evidenceMessageIds: ["student-plan-1"],
    evidenceAliases: ["student_current"],
  },
}).state;
assert.deepEqual(afterQuestion.emittedQuestionIds, emittedQuestionIds);
assert.equal(
  getPatientQuestion("c1-extraction-question")?.text,
  "Will they pull out the bad tooth?",
);
assert.equal(shouldClassifyPatientQuestions("case-01", afterQuestion), false);

const resumedState: PatientQuestionState = JSON.parse(
  JSON.stringify(afterQuestion),
);
assert.equal(
  patientImmediateResponse({
    caseId: "case-01",
    message: hospitalPlans[0],
    disclosureState,
    emittedQuestionIds: resumedState.emittedQuestionIds,
    priorPatientDialogue: [
      "Please help me. My jaw is swollen, and I cannot lie back. Will they pull out the bad tooth?",
    ],
  }),
  CASE_1_HOSPITAL_ACKNOWLEDGEMENT,
);
assert.deepEqual(
  resumedState.emittedQuestionIds,
  ["c1-extraction-question"],
  "Acknowledgement logic must not mutate once-only question state",
);

console.log("Case 1 repeated-plan acknowledgement validation passed.");
