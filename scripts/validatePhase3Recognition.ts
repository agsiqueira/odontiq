import assert from "node:assert/strict";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  validateExplicitLearnerEvidence,
  validateTargetedSemanticEvidence,
} from "../src/lib/facultyRubric/evaluation/semanticEvidenceRules";
import type { FacultyEvaluationMessage } from "../src/lib/facultyRubric/evaluation/types";

const message = (
  id: string,
  role: FacultyEvaluationMessage["role"],
  content: string,
): FacultyEvaluationMessage => ({ id, role, content });

function criterion(caseId: string, criterionId: string) {
  const result = facultyRubrics
    .find((rubric) => rubric.caseId === caseId)
    ?.criteria.find((item) => item.id === criterionId);
  assert(result, `Missing ${caseId}/${criterionId}`);
  return result;
}

function recognized(
  caseId: string,
  criterionId: string,
  evidence: FacultyEvaluationMessage,
  allMessages: FacultyEvaluationMessage[] = [evidence],
) {
  const rubricCriterion = criterion(caseId, criterionId);
  const result = { learnerEvidenceMessageIds: [evidence.id] };
  return (
    validateTargetedSemanticEvidence({
      criterionId,
      criterionName: rubricCriterion.name,
      result,
      messages: allMessages,
    }).valid &&
    validateExplicitLearnerEvidence({
      criterion: rubricCriterion,
      result,
      messages: allMessages,
    }).valid
  );
}

const feverVariants = [
  "Do you have a fever?",
  "Any fevers or chills?",
  "Have you felt feverish?",
  "You haven't had any fever, correct?",
  "Have you noticed an elevated temperature?",
  "Have you had fever, chills, or an elevated temperature?",
  "Have you had an elevated or high temperature?",
  "Any fever, chills, or swelling?",
];
for (const caseId of ["case-02", "case-03", "case-04", "case-05"]) {
  const criterionId = `C${Number(caseId.slice(-2))}-IG-001`;
  for (const [index, content] of feverVariants.entries()) {
    assert(recognized(caseId, criterionId, message(`fever-${index}`, "student", content)), `${caseId}: ${content}`);
  }
}

const feverNegatives: Array<[FacultyEvaluationMessage["role"], string]> = [
  ["patient", "I do not have a fever."],
  ["patient", "I have had chills."],
  ["student", "Have you had chills?"],
  ["student", "Any chills?"],
  ["student", "Return if you develop a fever."],
  ["student", "Fever can happen with an infection."],
  ["student", "Take this if you get a fever."],
  ["system", "The case description mentions fever."],
];
for (const [index, [role, content]] of feverNegatives.entries()) {
  assert(!recognized("case-03", "C3-IG-001", message(`fever-negative-${index}`, role, content)), content);
}
assert(!recognized(
  "case-03",
  "C3-IG-001",
  message("other-attempt", "student", "Have you had a fever?"),
  [message("current-turn", "student", "Where does it hurt?")],
));

const bitingVariants = [
  "Does it hurt when you bite?",
  "Does chewing make the pain worse?",
  "Any pain when you bite down?",
  "Does tapping the tooth hurt?",
  "Does pressure on that tooth cause pain?",
  "Is it painful when your teeth come together?",
  "Does it hurt when the tooth is touched?",
  "Any pain when chewing or when I press on the tooth?",
  "It doesn't hurt when you bite, correct?",
];
for (const caseId of ["case-03", "case-04", "case-05"]) {
  const criterionId = `C${Number(caseId.slice(-2))}-IG-005`;
  for (const [index, content] of bitingVariants.entries()) {
    assert(recognized(caseId, criterionId, message(`bite-${index}`, "student", content)), `${caseId}: ${content}`);
  }
}

const bitingNegatives: Array<[FacultyEvaluationMessage["role"], string]> = [
  ["patient", "It hurts when I chew."],
  ["student", "Are you in pain?"],
  ["student", "Avoid chewing on that side."],
  ["student", "Do you have sinus pressure?"],
  ["student", "What is your blood pressure?"],
  ["student", "Do you feel generalized facial pressure?"],
  ["student", "Does pressure on the gum cause discomfort?"],
  ["system", "The case says pain occurs on biting."],
];
for (const [index, [role, content]] of bitingNegatives.entries()) {
  assert(!recognized("case-04", "C4-IG-005", message(`bite-negative-${index}`, role, content)), content);
}

const compound = message("compound", "student", "Does it hurt with cold or when you bite down?");
assert(recognized("case-05", "C5-IG-003", compound));
assert(recognized("case-05", "C5-IG-005", compound));
assert(!recognized("case-05", "C5-IG-004", compound), "Unmentioned lingering pain must not receive credit");

for (const caseId of ["case-01", "case-02"]) {
  const rubric = facultyRubrics.find((item) => item.caseId === caseId)!;
  for (const neutral of rubric.criteria.filter((item) => item.expectation === "neutral")) {
    assert.equal(neutral.weight, 0, `${neutral.id} must remain neutral and unscored`);
  }
}

console.log("Phase 3 recognition validation passed.");
