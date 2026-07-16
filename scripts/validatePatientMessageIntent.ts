import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import {
  buildPatientDisclosureState,
  classifyProviderMessageIntent,
  type ProviderMessageIntent,
} from "../src/lib/patientDisclosure";

const intentCases: Array<{
  message: string;
  expected: ProviderMessageIntent;
}> = [
  {
    message: "You will be admitted and started on antibiotics.",
    expected: "disposition_plan",
  },
  {
    message: "I'm prescribing an antibiotic for seven days.",
    expected: "medication_plan",
  },
  {
    message: "I'm referring you to an oral surgeon.",
    expected: "disposition_plan",
  },
  {
    message: "The swelling appears to be caused by a dental infection.",
    expected: "diagnosis_explanation",
  },
  {
    message: "The tooth will likely need to be removed.",
    expected: "treatment_plan",
  },
  {
    message: "Return in one week so we can check the healing.",
    expected: "disposition_plan",
  },
  {
    message: "Do not chew on that side until tomorrow.",
    expected: "instruction",
  },
  {
    message: "Do you understand why you need to be admitted?",
    expected: "question",
  },
  {
    message: "What was the name of the medication you took?",
    expected: "question",
  },
];

for (const testCase of intentCases) {
  assert.equal(
    classifyProviderMessageIntent(testCase.message),
    testCase.expected,
    testCase.message,
  );
}

const caseData = loadCase("case-01");
assert(caseData, "Case 1 must exist for disclosure-policy validation");

const planState = buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: "I'm referring you to an oral surgeon.",
});
assert.equal(planState.providerMessageIntent, "disposition_plan");
assert.equal(
  planState.asksRestrictedClinicalInterpretation,
  false,
  "A referral statement must not trigger the unknown-information fallback",
);
assert.deepEqual(
  planState.allowedThisTurn,
  [],
  "A provider plan must not unlock patient facts",
);

const restrictedQuestionState = buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: "What do you think the diagnosis is?",
});
assert.equal(restrictedQuestionState.providerMessageIntent, "question");
assert.equal(
  restrictedQuestionState.asksRestrictedClinicalInterpretation,
  true,
  "A genuine clinical-interpretation question should retain the fallback",
);

const comprehensionState = buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: "Do you understand why you need to be admitted?",
});
assert.equal(comprehensionState.providerMessageIntent, "question");
assert.equal(
  comprehensionState.asksRestrictedClinicalInterpretation,
  false,
  "A comprehension question should not trigger the clinical fallback",
);

const planComprehensionState = buildPatientDisclosureState({
  caseData,
  conversation: [],
  latestStudentMessage: "Do you understand the treatment plan?",
});
assert.equal(planComprehensionState.providerMessageIntent, "question");
assert.equal(
  planComprehensionState.asksRestrictedClinicalInterpretation,
  false,
  "Treatment-plan comprehension must not trigger the clinical fallback",
);

console.log(
  `Patient message intent validation passed (${intentCases.length} intent cases).`,
);
