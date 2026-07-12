import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  semanticEvidenceRules,
  validateSemanticEvidenceRuleRegistry,
  validateTargetedSemanticEvidence,
} from "../src/lib/facultyRubric/evaluation/semanticEvidenceRules";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const validation = validateSemanticEvidenceRuleRegistry(facultyRubrics);
assert(validation.valid, validation.errors.join("; "));
const activeIds = semanticEvidenceRules.flatMap((rule) => rule.criterionIds ?? []);
assert(new Set(activeIds).size === activeIds.length, "Active criterion IDs must be assigned once");
assert(
  validateSemanticEvidenceRuleRegistry(facultyRubrics, [
    { criterionIds: ["UNKNOWN"], requiredLearnerPatterns: [/fever/i] },
  ]).errors.includes("unknown-criterion-id:UNKNOWN"),
  "Unknown IDs should fail clearly",
);
assert(
  validateSemanticEvidenceRuleRegistry(facultyRubrics, [
    { criterionIds: ["C1-IG-001"], requiredLearnerPatterns: [/fever/i] },
    { criterionIds: ["C1-IG-001"], requiredLearnerPatterns: [/chills/i] },
  ]).errors.includes("duplicate-rule-id:C1-IG-001"),
  "Duplicate rule assignments should fail clearly",
);
assert(
  validateSemanticEvidenceRuleRegistry(
    [{ criteria: [{ id: "DUP" }, { id: "DUP" }] }],
    [{ criterionIds: ["DUP"], requiredLearnerPatterns: [/test/i] }],
  ).errors.includes("ambiguous-rubric-id:DUP:2"),
  "Ambiguous rubric IDs should fail clearly",
);
assert(
  validateTargetedSemanticEvidence({
    criterionId: "C1-IG-001",
    criterionName: "renamed-display-label",
    result: { learnerEvidenceMessageIds: ["s1"] },
    messages: [{ id: "s1", role: "student", content: "Any fever or chills?" }],
  }).valid,
  "Renaming a display label must not disable an ID rule",
);
assert(
  validateTargetedSemanticEvidence({
    criterionName: "asked-about-duration",
    result: { learnerEvidenceMessageIds: ["s1"] },
    messages: [{ id: "s1", role: "student", content: "How long has this been happening?" }],
  }).valid,
  "Prepared exact-name fallback must remain available",
);

console.log(`Semantic evidence rule registry validation passed for ${activeIds.length} active IDs.`);
