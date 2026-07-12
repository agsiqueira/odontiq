import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import { validateExplicitLearnerEvidence } from "../src/lib/facultyRubric/evaluation/semanticEvidenceRules";
import type { FacultyEvaluationMessage } from "../src/lib/facultyRubric/evaluation/types";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const student = (id: string, content: string): FacultyEvaluationMessage => ({
  id,
  role: "student",
  content,
});
const patient = (id: string, content: string): FacultyEvaluationMessage => ({
  id,
  role: "patient",
  content,
});

function criterion(caseId: string, criterionId: string) {
  const value = facultyRubrics
    .find((rubric) => rubric.caseId === caseId)
    ?.criteria.find((item) => item.id === criterionId);
  if (!value) throw new Error(`Missing test criterion ${caseId}/${criterionId}`);
  return value;
}

function valid(
  caseId: string,
  criterionId: string,
  messages: FacultyEvaluationMessage[],
  learnerEvidenceMessageIds: string[],
) {
  return validateExplicitLearnerEvidence({
    criterion: criterion(caseId, criterionId),
    result: { learnerEvidenceMessageIds },
    messages,
  }).valid;
}

const generic = student("s-generic", "What brings you in?");
const volunteered = patient(
  "p-volunteered",
  "I cannot chew because of pain and swelling.",
);
const passiveContext = [generic, volunteered];

for (const [caseId, criterionId] of [
  ["case-01", "C1-CI-002"],
  ["case-03", "C3-CF-002"],
  ["case-03", "C3-CI-001"],
  ["case-03", "C3-CI-002"],
  ["case-03", "C3-CI-003"],
] as const) {
  assert(
    !valid(caseId, criterionId, passiveContext, ["s-generic"]),
    `${criterionId}: generic chief-complaint evidence must not earn credit`,
  );
  assert(
    !valid(caseId, criterionId, passiveContext, ["p-volunteered"]),
    `${criterionId}: patient-only volunteered evidence must not earn credit`,
  );
}

assert(
  valid(
    "case-03",
    "C3-CF-002",
    [student("s-exam", "On examination, I see a localized intraoral abscess.")],
    ["s-exam"],
  ),
  "An explicit learner examination finding should satisfy the finding criterion",
);
assert(
  !valid(
    "case-03",
    "C3-CF-002",
    [student("s-question", "Could this be an abscess?")],
    ["s-question"],
  ),
  "A speculative diagnostic question must not count as an examination finding",
);
assert(
  valid(
    "case-03",
    "C3-CI-002",
    [student("s-diagnosis", "I think this is a localized intraoral abscess.")],
    ["s-diagnosis"],
  ),
  "An explicit learner diagnosis should satisfy clinical reasoning",
);
assert(
  !valid(
    "case-03",
    "C3-CI-002",
    [student("s-diagnosis-question", "Could this be an intraoral abscess?")],
    ["s-diagnosis-question"],
  ),
  "A question must not be inferred as a diagnosis",
);
assert(
  valid(
    "case-03",
    "C3-CI-001",
    [student("s-urgent", "I believe this is an urgent case.")],
    ["s-urgent"],
  ),
  "An explicit urgency conclusion should satisfy urgency recognition",
);
assert(
  !valid(
    "case-03",
    "C3-CI-001",
    [student("s-urgent-question", "Is this an urgent case?")],
    ["s-urgent-question"],
  ),
  "A question must not be inferred as an urgency conclusion",
);
assert(
  valid(
    "case-01",
    "C1-MP-003",
    [student("s-recommend", "I recommend starting IV antibiotics now.")],
    ["s-recommend"],
  ),
  "An explicit learner recommendation should satisfy the recommendation criterion",
);
assert(
  !valid(
    "case-01",
    "C1-MP-003",
    [student("s-negated", "I do not recommend IV antibiotics.")],
    ["s-negated"],
  ),
  "A negated recommendation must not count as performing the recommendation",
);

console.log("Explicit semantic learner-evidence validation passed.");
