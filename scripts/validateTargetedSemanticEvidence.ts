import { validateTargetedSemanticEvidence } from "../src/lib/facultyRubric/evaluation/semanticEvidenceRules";
import type { FacultyEvaluationMessage } from "../src/lib/facultyRubric/evaluation/types";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const student = (id: string, content: string): FacultyEvaluationMessage => ({ id, role: "student", content });
const patient = (id: string, content: string): FacultyEvaluationMessage => ({ id, role: "patient", content });
const activeIds: Record<string, string> = {
  "asked-about-fever": "C1-IG-001",
  "elicited-difficulty-breathing": "C1-CF-001",
  "elicited-difficulty-swallowing": "C1-CF-003",
  "asked-about-home-medication-use": "C1-IG-006",
  "asked-about-penicillin-allergy": "C1-IG-002",
};
const valid = (name: string, messages: FacultyEvaluationMessage[], ids: string[]) =>
  validateTargetedSemanticEvidence({
    criterionId: activeIds[name],
    criterionName: name,
    result: { learnerEvidenceMessageIds: ids },
    messages,
  }).valid;

const targeted = [
  "asked-about-fever",
  "asked-about-duration",
  "asked-about-pain-severity",
  "elicited-difficulty-breathing",
  "elicited-difficulty-swallowing",
  "asked-about-trauma",
  "asked-about-home-medication-use",
  "asked-about-penicillin-allergy",
];
for (const name of targeted) {
  assert(!valid(name, [student("s1", "What brings you in?")], ["s1"]), `${name}: generic opening must fail`);
  assert(!valid(name, [student("s1", "Tell me what happened")], ["s1"]), `${name}: broad invitation must fail`);
  assert(!valid(name, [patient("p1", "I have the relevant symptom")], ["p1"]), `${name}: wrong speaker must fail`);
}

assert(valid("asked-about-duration", [student("s1", "How long has this been going on?")], ["s1"]), "Duration paraphrase should pass");
assert(!valid("asked-about-duration", [student("s1", "How severe is the pain?")], ["s1"]), "Pain evidence must not satisfy duration");
assert(valid("asked-about-pain-severity", [student("s1", "How bad is the pain from zero to ten?")], ["s1"]), "Pain severity paraphrase should pass");
assert(valid("elicited-difficulty-breathing", [student("s1", "Are you having any trouble breathing or lying flat?")], ["s1"]), "Breathing paraphrase should pass");
assert(!valid("elicited-difficulty-breathing", [patient("p1", "I cannot breathe well")], ["p1"]), "Volunteered breathing symptom must fail");
assert(valid("elicited-difficulty-swallowing", [student("s1", "Does it hurt to swallow?")], ["s1"]), "Swallowing paraphrase should pass");
assert(!valid("elicited-difficulty-swallowing", [student("s1", "Can you breathe normally?")], ["s1"]), "Breathing evidence must not satisfy swallowing");
assert(valid("asked-about-trauma", [student("s1", "Was there an injury or accident before this started?")], ["s1"]), "Trauma paraphrase should pass");
assert(valid("asked-about-home-medication-use", [student("s1", "Have you taken anything for the pain?")], ["s1"]), "Medication paraphrase should pass");
assert(valid("asked-about-penicillin-allergy", [student("s1", "Are you allergic to penicillin?")], ["s1"]), "Allergy paraphrase should pass");
assert(
  valid(
    "asked-about-duration",
    [student("s1", "What brings you in?"), patient("p1", "My tooth hurts"), student("s2", "How long has it hurt?")],
    ["s1", "s2"],
  ),
  "Generic opening followed by targeted question should pass",
);
assert(
  validateTargetedSemanticEvidence({
    criterionId: "C1-IG-001",
    criterionName: "renamed-fever-display-label",
    result: { learnerEvidenceMessageIds: ["s1"] },
    messages: [student("s1", "Have you had fever?")],
  }).valid,
  "ID-based rule should survive a renamed criterion label",
);

console.log("Targeted semantic evidence validation passed.");
