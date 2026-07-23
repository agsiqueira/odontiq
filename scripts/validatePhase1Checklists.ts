import assert from "node:assert/strict";

import { loadCase } from "../src/data/cases";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

const rubric = (caseId: string) => {
  const result = facultyRubrics.find((candidate) => candidate.caseId === caseId);
  assert(result, `${caseId} rubric must exist`);
  return result;
};

const criterionNames = (caseId: string) =>
  new Set(rubric(caseId).criteria.map((criterion) => criterion.name));
const scoredCriterionNames = (caseId: string) =>
  new Set(
    rubric(caseId).criteria
      .filter((criterion) => criterion.expectation === "required" && criterion.weight > 0)
      .map((criterion) => criterion.name),
  );

const case1Removed = [
  "asked-about-fever",
  "asked-about-penicillin-allergy",
  "asked-about-cold-pain",
  "asked-about-lingering-cold-pain",
  "asked-about-biting-pain",
  "asked-about-home-medication-use",
];
const case2Removed = [
  "asked-about-cold-pain",
  "asked-about-lingering-cold-pain",
  "asked-about-biting-pain",
  "explained-temporary-pain-relief",
];

for (const name of case1Removed) {
  assert(!scoredCriterionNames("case-01").has(name), `Case 1 must not score ${name}`);
}
for (const name of case2Removed) {
  assert(!scoredCriterionNames("case-02").has(name), `Case 2 must not score ${name}`);
}

for (const name of [
  "asked-about-fever",
  "asked-about-penicillin-allergy",
  "asked-about-general-medication-allergies",
  "asked-about-cold-pain",
  "asked-about-lingering-cold-pain",
  "asked-about-biting-pain",
  "asked-about-home-medication-use",
  "offered-dental-anesthesia",
  "explained-temporary-pain-relief",
  "offered-incision-and-drainage",
  "recommended-prompt-dental-follow-up",
]) assert(criterionNames("case-03").has(name), `Case 3 must retain ${name}`);

for (const name of [
  "asked-about-fever",
  "asked-about-penicillin-allergy",
  "asked-about-general-medication-allergies",
  "asked-about-cold-pain",
  "asked-about-lingering-cold-pain",
  "asked-about-biting-pain",
  "asked-about-home-medication-use",
  "offered-dental-anesthesia",
  "explained-temporary-pain-relief",
  "explained-antibiotics-not-indicated",
  "explained-when-antibiotics-indicated",
  "recommended-prompt-dental-follow-up",
  "asked-about-dental-follow-up-access",
  "asked-whether-patient-wants-to-save-tooth",
]) assert(criterionNames("case-04").has(name), `Case 4 must retain ${name}`);

for (const name of [
  "asked-about-fever",
  "asked-about-penicillin-allergy",
  "asked-about-general-medication-allergies",
  "asked-about-cold-pain",
  "asked-about-lingering-cold-pain",
  "asked-about-biting-pain",
  "asked-about-home-medication-use",
  "offered-dental-anesthesia",
  "explained-temporary-pain-relief",
  "explained-antibiotics-not-indicated",
  "recommended-prompt-dental-follow-up",
  "asked-about-dental-follow-up-access",
  "asked-whether-patient-wants-to-save-tooth",
]) assert(criterionNames("case-05").has(name), `Case 5 must retain ${name}`);

for (const caseId of ["case-01", "case-02"]) {
  const scored = rubric(caseId).criteria.filter(
    (criterion) => criterion.expectation === "required" && criterion.weight > 0,
  );
  const evaluations: FacultyCriterionEvaluation[] = scored.map((criterion) => {
    const expected =
      criterion.name === "selected-appropriate-iv-antibiotic" ||
      criterion.expectedValue !== false;
    return {
      caseId,
      criterionId: criterion.id,
      status: expected ? "met" : "not-met",
      confidence: 1,
      evidence: [],
      rationale: "All remaining scored criteria satisfied in normalization test.",
      evaluationMethod: "deterministic",
      evaluatedAt: "2026-07-22T00:00:00.000Z",
      expectedValue: expected,
      observedValue: false,
    };
  });
  const score = scoreFacultyRubricEvaluations({ caseId, evaluations });
  assert.equal(score.percentage, 100, `${caseId} revised denominator must normalize to 100%: ${JSON.stringify(score.criteria.filter((criterion) => criterion.earnedPoints !== criterion.possiblePoints || criterion.penaltyPoints > 0))}`);
  assert.equal(score.technicalValidationErrors.length, 0);
  assert.equal(score.possiblePoints, score.earnedPoints);
}

for (const caseId of ["case-01", "case-02", "case-03", "case-04", "case-05"]) {
  const caseData = loadCase(caseId);
  assert(caseData, `${caseId} case data must exist`);
  assert(caseData.conversation.scripted.length > 0, `${caseId} dialogue must remain configured`);
}

assert(criterionNames("case-02").has("asked-about-penicillin-allergy"));
assert(criterionNames("case-02").has("asked-about-home-medication-use"));
assert(criterionNames("case-02").has("offered-dental-anesthesia"));
assert(criterionNames("case-02").has("explained-antibiotics-do-not-resolve-source"));
assert(criterionNames("case-01").has("recommended-monitor-maintain-airway"));
assert(criterionNames("case-01").has("recommended-omfs-consult"));

console.log("Phase 1 checklist validation passed.");
