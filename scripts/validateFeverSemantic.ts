import { hasTargetedSystemicInquiry } from "../src/lib/facultyRubric/evaluation/semanticEvidenceRules";
import type { FacultyEvaluationMessage } from "../src/lib/facultyRubric/evaluation/types";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function evaluated(messages: FacultyEvaluationMessage[], evidenceIds: string[]) {
  return hasTargetedSystemicInquiry(
    { learnerEvidenceMessageIds: evidenceIds },
    messages,
  );
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

assert(!evaluated([student("s1", "What brings you in?")], ["s1"]), "Generic opening must not count");
assert(!evaluated([student("s1", "Tell me what happened")], ["s1"]), "Broad history invitation must not count");
assert(
  !evaluated(
    [student("s1", "What brings you in?"), patient("p1", "I have a fever")],
    ["s1"],
  ),
  "Patient-volunteered fever without learner follow-up must not count",
);
assert(evaluated([student("s1", "Have you had a fever or chills?")], ["s1"]), "Direct fever inquiry should count");
assert(
  evaluated(
    [student("s1", "You mentioned feeling sick—have you had fever, chills, or fatigue?")],
    ["s1"],
  ),
  "Targeted systemic follow-up should count",
);
assert(
  evaluated(
    [student("s1", "What brings you in?"), patient("p1", "My tooth hurts"), student("s2", "Have you had a fever?")],
    ["s2"],
  ),
  "A later targeted fever inquiry should count",
);

console.log("Fever semantic evidence validation passed.");
