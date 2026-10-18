import assert from "node:assert/strict";
import { loadCase } from "../src/data/cases";
import { buildPatientDisclosureState, classifyQuestion } from "../src/lib/patientDisclosure";
import { patientImmediateResponse } from "../src/lib/patientImmediateResponse";
import { requiredFactsForTurn } from "../src/lib/patientTurnFacts";
import { generatePatientRoleSafeResponse } from "../src/lib/patientRoleResponse";
import { assessPatientOutputIntegrity } from "../src/lib/patientOutputGuard";

type Scenario = {
  caseId: string;
  questions: string[];
  expected: string[];
  forbidden: string[];
  answer: string;
};
const scenarios: Scenario[] = [
  {
    caseId: "case-03",
    questions: ["Do you have dental insurance?", "Are you insured?", "What coverage do you have?"],
    expected: ["c3.background-insurance"], forbidden: ["c3.appointment"],
    answer: "No, I don't have insurance.",
  },
  {
    caseId: "case-03",
    questions: ["Do you have a daughter, and what insurance does she have?", "Is your daughter covered by Medicaid?", "What coverage does your child have?"],
    expected: ["c3.background-family_care"], forbidden: ["c3.appointment"],
    answer: "I have a young daughter, and she's on Medicaid. I'd prefer to use the same clinic as her.",
  },
  {
    caseId: "case-03",
    questions: ["Do you have insurance, and is your daughter covered by Medicaid?", "Are you insured and would you prefer the same clinic as your daughter?"],
    expected: ["c3.background-insurance", "c3.background-family_care"], forbidden: ["c3.appointment"],
    answer: "I'm uninsured, but my young daughter has Medicaid, and I'd prefer to go to her clinic.",
  },
  {
    caseId: "case-03",
    questions: ["Do you have dental insurance and an appointment?", "When is your next appointment, and what coverage do you have?"],
    expected: ["c3.background-insurance", "c3.appointment"], forbidden: [],
    answer: "I don't have insurance, but I have an appointment with my dentist next week.",
  },
  {
    caseId: "case-03",
    questions: ["When is your dental appointment?", "Can you get a dental appointment?", "When will you see your dentist?"],
    expected: ["c3.appointment"], forbidden: ["c3.background-insurance", "c3.background-family_care"],
    answer: "I have an appointment with my dentist next week.",
  },
  {
    caseId: "case-04",
    questions: ["Would you be willing to pay for dental care on a sliding-scale fee?", "Could you afford a sliding scale payment?", "Are you open to an income-based fee?", "What about paying on a sliding scale?"],
    expected: ["c4.background-care_cost"], forbidden: ["c4.severity"],
    answer: "Yes, I'm willing to pay a sliding-scale fee for dental care.",
  },
  {
    caseId: "case-04",
    questions: ["Are you insured, and would a sliding-scale fee work?", "Do you have dental insurance and can you pay a sliding scale fee?"],
    expected: ["c4.background-insurance", "c4.background-care_cost"], forbidden: ["c4.severity"],
    answer: "I don't have insurance, but I'm open to paying a sliding-scale fee.",
  },
  {
    caseId: "case-04",
    questions: ["How bad is your pain on a scale of one to ten?", "Rate the pain.", "What is your pain level?", "How severe is it?"],
    expected: ["c4.severity"], forbidden: ["c4.background-care_cost"],
    answer: "The pain is seven out of ten.",
  },
  {
    caseId: "case-04",
    questions: ["Rate your pain on a scale of one to ten, and could you pay a sliding-scale fee?", "Would a sliding scale fee work, and how bad is your pain?"],
    expected: ["c4.severity", "c4.background-care_cost"], forbidden: [],
    answer: "My pain is seven out of ten, and I'm willing to pay a sliding-scale fee for care.",
  },
];

async function validate() {
  let count = 0;
  for (const scenario of scenarios) {
    const caseData = loadCase(scenario.caseId)!;
    for (const question of scenario.questions) {
      // Prior appointment/pain disclosure must not contaminate the next answer.
      const prior = scenario.caseId === "case-03"
        ? "I have an appointment with my dentist next week."
        : "My pain is seven out of ten.";
      const state = buildPatientDisclosureState({ caseData, latestStudentMessage: question, conversation: [
        { id: "prior-patient", role: "patient", text: prior, timestamp: "2026-10-16T00:00:00Z" },
      ] });
      const permitted = [...state.allowedThisTurn, ...state.alreadyDisclosed];
      for (const id of scenario.expected) assert(permitted.some(fact => fact.id === id), `${question}: missing ${id}`);
      for (const id of scenario.forbidden) assert(!state.allowedThisTurn.some(fact => fact.id === id), `${question}: unrelated ${id} unlocked`);
      const required = requiredFactsForTurn(state, question, caseData.supportingInfo.patientFacts ?? []);
      for (const id of scenario.forbidden) assert(!required.some(fact => fact.id === id), `${question}: unrelated ${id} required`);
      if (scenario.caseId === "case-04" && !scenario.expected.includes("c4.severity")) {
        assert(!classifyQuestion(question).questionIntents.includes("pain_severity"), question);
        assert(!classifyQuestion(question).topics.includes("pain"), question);
      }
      assert.equal(patientImmediateResponse({ caseId: scenario.caseId, message: question, disclosureState: state }), undefined, question);
      const assessment = assessPatientOutputIntegrity(scenario.answer, caseData.supportingInfo.patientFacts ?? [], [], required);
      assert(assessment.valid, `${question}: ${assessment.reason}; required: ${required.map(fact => fact.id).join(", ")}`);
      const safe = await generatePatientRoleSafeResponse({
        initialOutput: scenario.answer, visibleFacts: caseData.supportingInfo.patientFacts,
        requiredFacts: required, allowPatientInitiatedQuestion: false,
        fallbackText: prior,
        retry: async () => { throw Error(`Correct answer incorrectly rejected: ${question}`); },
      });
      assert.equal(safe.text, scenario.answer, question);
      count++;
    }
  }
  console.log(`Patient background conflict validation passed (${count} exact/paraphrase/combined questions through final response guards).`);
}
void validate();
