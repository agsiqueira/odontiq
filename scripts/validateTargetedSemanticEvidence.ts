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
const validWithContext = (
  criterionId: string,
  criterionName: string,
  messages: FacultyEvaluationMessage[],
  learnerEvidenceMessageIds: string[],
  contextualPatientMessageIds: string[],
) =>
  validateTargetedSemanticEvidence({
    criterionId,
    criterionName,
    result: { learnerEvidenceMessageIds, contextualPatientMessageIds },
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

const case2PenicillinCriterion = "established-penicillin-allergy-status";
assert(
  validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "Are you allergic to penicillin?"),
      patient("p1", "No."),
    ],
    ["s1"],
    ["p1"],
  ),
  "Explicit penicillin inquiry plus explicit response should establish status",
);
assert(
  validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "Have you ever had an allergy or reaction to amoxicillin?"),
      patient("p1", "No, I am not allergic to amoxicillin or penicillin."),
    ],
    ["s1"],
    ["p1"],
  ),
  "Amoxicillin inquiry plus explicit penicillin-class response should establish status",
);
assert(
  validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "Do you have any medication allergies?"),
      patient("p1", "I have no known drug allergies, and I am not allergic to penicillin."),
    ],
    ["s1"],
    ["p1"],
  ),
  "General medication-allergy inquiry should count when the response explicitly establishes penicillin status",
);
assert(
  !validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "Do you have any medication allergies?"),
      patient("p1", "I once had a rash, but I do not remember which medicine caused it."),
    ],
    ["s1"],
    ["p1"],
  ),
  "General medication-allergy inquiry must fail when the response does not establish penicillin status",
);
assert(
  !validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "Do you have any food allergies?"),
      patient("p1", "I am not allergic to penicillin."),
    ],
    ["s1"],
    ["p1"],
  ),
  "Food-allergy inquiry must not establish penicillin status",
);
assert(
  !validWithContext(
    "C2-IG-002",
    case2PenicillinCriterion,
    [
      student("s1", "What brings you in?"),
      patient("p1", "My tooth hurts, and I am not allergic to penicillin."),
    ],
    ["s1"],
    ["p1"],
  ),
  "Volunteered penicillin status without a relevant learner inquiry must not count",
);

const medicationRuleValid = (
  criterionId: "C3-MP-002" | "C3-MP-007",
  content: string,
) =>
  validWithContext(
    criterionId,
    criterionId === "C3-MP-002"
      ? "preferred-acetaminophen-with-dose-review"
      : "recommended-nsaid-despite-ulcer-intolerance",
    [student("s1", content)],
    ["s1"],
    [],
  );
assert(medicationRuleValid("C3-MP-002", "I recommend Tylenol for pain."), "Tylenol recommendation should pass the positive gate");
assert(medicationRuleValid("C3-MP-002", "Avoid ibuprofen; use acetaminophen instead."), "Acetaminophen with ibuprofen avoidance should pass the positive gate");
assert(!medicationRuleValid("C3-MP-002", "Ibuprofen upsets your stomach because of your ulcers."), "Intolerance recognition alone must not pass the positive gate");
for (const unsafe of ["Take ibuprofen for pain.", "I recommend Advil.", "You should use Motrin.", "Start an NSAID for pain.", "Take naproxen for pain.", "I recommend Toradol."]) {
  assert(medicationRuleValid("C3-MP-007", unsafe), `${unsafe} should pass the unsafe recommendation gate`);
}
for (const safe of ["Do not take ibuprofen.", "Avoid Motrin.", "I recommend against ibuprofen.", "Ibuprofen upsets your stomach.", "Use Tylenol instead of ibuprofen."]) {
  assert(!medicationRuleValid("C3-MP-007", safe), `${safe} must not pass the unsafe recommendation gate`);
}
assert(medicationRuleValid("C3-MP-002", "Use Tylenol and ibuprofen for pain."), "Mixed recommendation should pass the positive gate");
assert(medicationRuleValid("C3-MP-007", "Use Tylenol and ibuprofen for pain."), "Mixed recommendation should also pass the unsafe gate");
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
assert(
  valid("asked-about-fever", [student("s1", "Any fever or chills?")], ["s1"]),
  "Compound fever-and-chills assessment should pass",
);
assert(
  valid("asked-about-fever", [student("s1", "Have you had an elevated or high temperature?")], ["s1"]),
  "Elevated/high-temperature assessment should pass",
);
assert(
  !valid("asked-about-fever", [student("s1", "Have you had chills?")], ["s1"]),
  "Chills alone must not satisfy fever assessment",
);
assert(
  !valid("asked-about-fever", [patient("p1", "I have had chills.")], ["p1"]),
  "Patient-volunteered chills must not satisfy fever assessment",
);

console.log("Targeted semantic evidence validation passed.");
