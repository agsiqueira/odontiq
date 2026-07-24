import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { loadCase } from "../src/data/cases";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { buildFacultyComparisonSections, getAuthoredExpectedValue } from "../src/lib/facultyRubric/report/comparison";
import { FINAL_FACULTY_RUBRIC_POLICY } from "../src/lib/facultyRubric/calibration/policy";
import { getResolvedFacultyRubricCalibration } from "../src/lib/facultyRubric/calibration/caseCalibration";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

const expectedDialogueHashes: Record<string, string> = {
  "case-01": "5db017c1f18fd0144289ac9c735d2ee6a85fcab22bc7ce4f84d205072c3847bd",
  "case-02": "9df5014bd6ce6cac24fbc3a198f6c4b26e16a1b406d12802f03045a1238d823e",
  "case-03": "f9332b4c417eb0a01f12d22d4473c41db912571fd5f84d46c8d4eac4fd2b9faa",
  "case-04": "8f944fe9e9f18b4c140e1746ed2ea76bca8a1baeefd53b615d6fb3d0da576f6f",
  "case-05": "43551ee7e0bdbf0f98fea1ad7ae91583aafb06b24d671cfae5e052d81a8cf01e",
};

const globalIds = new Set<string>();
for (const rubric of facultyRubrics) {
  assert(/^case-0[1-5]$/.test(rubric.caseId), `Unexpected rubric case: ${rubric.caseId}`);
  const localIds = new Set<string>();
  const activeNames = new Set<string>();
  const active = rubric.criteria.filter((criterion) => criterion.expectation === "required");
  const neutral = rubric.criteria.filter((criterion) => criterion.expectation === "neutral");

  for (const criterion of rubric.criteria) {
    assert(!localIds.has(criterion.id), `${rubric.caseId} duplicates criterion ID ${criterion.id}`);
    assert(!globalIds.has(criterion.id), `Criterion ID belongs to multiple cases: ${criterion.id}`);
    localIds.add(criterion.id);
    globalIds.add(criterion.id);
    assert(criterion.id.startsWith(`C${Number(rubric.caseId.slice(-2))}-`), `${criterion.id} has incorrect case prefix`);
  }

  for (const criterion of active) {
    assert(criterion.weight > 0, `${criterion.id} active weight must be positive`);
    assert(criterion.name.trim(), `${criterion.id} needs a provider-behavior name`);
    assert(criterion.title.trim(), `${criterion.id} needs a title`);
    assert(criterion.description.trim(), `${criterion.id} needs expected-evidence description`);
    assert((criterion.reportLabel ?? criterion.title).trim(), `${criterion.id} needs a report label`);
    assert(criterion.competency.trim(), `${criterion.id} needs a report competency`);
    assert(!activeNames.has(criterion.name), `${rubric.caseId} duplicates active behavior ${criterion.name}`);
    activeNames.add(criterion.name);
  }

  for (const criterion of neutral) assert.equal(criterion.weight, 0, `${criterion.id} neutral weight`);
  const resolved = getResolvedFacultyRubricCalibration(rubric.caseId);
  assert(resolved.filter((criterion) => criterion.scored).every((criterion) => criterion.currentWeight > 0));
  assert(resolved.filter((criterion) => criterion.expectation === "neutral").every((criterion) => !criterion.scored));

  const evaluations: FacultyCriterionEvaluation[] = resolved
    .filter((criterion) => criterion.scored && criterion.supported)
    .map((criterion) => {
      const authored = rubric.criteria.find((candidate) => candidate.id === criterion.criterionId)!;
      const expected = authored.name === "selected-appropriate-iv-antibiotic"
        ? rubric.criteria.some((candidate) => candidate.name === "recommended-iv-antibiotics" && getAuthoredExpectedValue(candidate))
        : getAuthoredExpectedValue(authored);
      return {
        caseId: rubric.caseId,
        criterionId: criterion.criterionId,
        status: expected ? "met" : "not-met",
        confidence: 1,
        evidence: [],
        rationale: "Maximum-score matrix validation.",
        evaluationMethod: "deterministic",
        evaluatedAt: "2026-07-22T00:00:00.000Z",
        expectedValue: expected,
        observedValue: expected,
      };
    });
  const score = scoreFacultyRubricEvaluations({ caseId: rubric.caseId, evaluations });
  assert.equal(score.percentage, 100, `${rubric.caseId} must normalize to 100%`);
  assert.equal(score.penaltyPoints, 0);
  assert(score.criteria.every((criterion) => !neutral.some((item) => item.id === criterion.criterionId)));

  const comparisonIds = buildFacultyComparisonSections(rubric.caseId, evaluations)
    .flatMap((section) => section.rows)
    .map((row) => row.criterionId);
  assert(neutral.every((criterion) => !comparisonIds.includes(criterion.id)), `${rubric.caseId} neutral report rows`);

  const caseData = loadCase(rubric.caseId)!;
  const dialogueHash = createHash("sha256").update(JSON.stringify(caseData.conversation)).digest("hex");
  assert.equal(dialogueHash, expectedDialogueHashes[rubric.caseId], `${rubric.caseId} dialogue changed`);
}

for (const caseId of ["case-03", "case-04", "case-05"]) {
  const names = new Set(facultyRubrics.find((rubric) => rubric.caseId === caseId)!.criteria.map((criterion) => criterion.name));
  assert(names.has("asked-about-general-medication-allergies"), `${caseId} general allergy criterion`);
  assert(names.has("asked-about-penicillin-allergy"), `${caseId} penicillin allergy criterion`);
}

const case3 = facultyRubrics.find((rubric) => rubric.caseId === "case-03")!;
assert(!case3.criteria.some((criterion) =>
  criterion.expectation === "required" &&
  criterion.expectedValue !== false &&
  (criterion.name === "recommended-ibuprofen" || /recommend(?:ed|s)? ibuprofen/i.test(`${criterion.title} ${criterion.description}`)),
));
assert(case3.criteria.some((criterion) =>
  criterion.name === "preferred-acetaminophen-with-dose-review" &&
  criterion.acceptedConcepts?.every((concept) => /^(?:acetaminophen|tylenol)$/i.test(concept)),
));
assert(case3.criteria.some((criterion) =>
  criterion.id === "C3-MP-007" &&
  criterion.expectedValue === false &&
  criterion.critical,
));

assert.equal(FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage, 84);
console.log("Phase 2 scoring-matrix validation passed.");
