import assert from "node:assert/strict";

import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import {
  finalizeMissingSupportedCriteria,
  normalizeBidirectionalEvaluations,
} from "../src/lib/facultyRubric/evaluation/finalization";
import { mergeFacultyCriterionEvaluations } from "../src/lib/facultyRubric/evaluation/merge";
import { evaluateFacultySemanticWithRetry } from "../src/lib/facultyRubric/evaluation/retry";
import type { FacultyCriterionEvaluation } from "../src/lib/facultyRubric/evaluation/types";
import { validateFacultyCriterionEvaluations } from "../src/lib/facultyRubric/evaluation/validation";
import { buildFacultyReport } from "../src/lib/facultyRubric/report";
import { scoreFacultyRubricEvaluations } from "../src/lib/facultyRubric/scoring";

const caseId = "case-01";
const rubric = facultyRubrics.find((item) => item.caseId === caseId);
assert(rubric, "Case 1 rubric is required.");
const supportedIds = rubric.criteria
  .filter((criterion) => criterion.expectation === "required")
  .map((criterion) => criterion.id);
assert.equal(supportedIds.length, 21);

const semanticIds = supportedIds.slice(0, 18);
const batches = [semanticIds.slice(0, 8), semanticIds.slice(8, 16), semanticIds.slice(16)];
const accepted: FacultyCriterionEvaluation[] = [];
let totalCalls = 0;

for (const [batchIndex, batch] of batches.entries()) {
  const batchResult = await evaluateFacultySemanticWithRetry({
    evaluate: async (attemptNumber) => {
      totalCalls += 1;
      if (batchIndex === 0 && attemptNumber === 1) {
        throw new Error("first_semantic_attempt_failed");
      }
      return batch.map((criterionId) => ({
        caseId,
        criterionId,
        status: "not-met" as const,
        confidence: 1,
        evidence: [],
        rationale: "No supporting learner evidence was returned.",
        evaluationMethod: "ai-semantic" as const,
        evaluatedAt: "2026-07-12T14:00:00.000Z",
      }));
    },
  });
  accepted.push(...batchResult);
}

assert.equal(totalCalls, 4, "Only the failed batch should be retried once.");
assert.equal(accepted.length, 18);
assert.deepEqual(
  accepted.slice(0, 8).map((evaluation) => evaluation.criterionId),
  semanticIds.slice(0, 8),
  "The successful retry must retain all eight accepted findings.",
);

const merged = mergeFacultyCriterionEvaluations({
  caseId,
  current: [],
  incoming: accepted,
});
assert.equal(merged.evaluations.length, 18);
const finalized = normalizeBidirectionalEvaluations({
  caseId,
  evaluations: finalizeMissingSupportedCriteria({
    caseId,
    evaluations: merged.evaluations,
    evaluatedAt: "2026-07-12T14:00:01.000Z",
  }),
});
assert.equal(finalized.length, 21);
assert(validateFacultyCriterionEvaluations(finalized).valid);

const score = scoreFacultyRubricEvaluations({ caseId, evaluations: finalized });
assert.notEqual(score.passStatus, "technical-invalid");
const report = buildFacultyReport({
  rubric,
  completedEvaluations: finalized,
  score,
  generatedAt: "2026-07-12T14:00:02.000Z",
});
assert.equal(report.criterionResults.length, 21);

const priorPartialState = {
  status: "partial" as const,
  evaluations: [] as FacultyCriterionEvaluation[],
};
const successfulState = {
  ...priorPartialState,
  status: "complete" as const,
  evaluations: finalized,
};
assert.equal(successfulState.status, "complete");
assert.equal(successfulState.evaluations.length, 21);

const collisionId = supportedIds[0];
const older: FacultyCriterionEvaluation = {
  ...accepted[0],
  criterionId: collisionId,
  status: "not-met",
  evaluatedAt: "2026-07-12T13:00:00.000Z",
};
const newer: FacultyCriterionEvaluation = {
  ...older,
  status: "uncertain",
  evaluatedAt: "2026-07-12T14:00:00.000Z",
};
const collision = mergeFacultyCriterionEvaluations({
  caseId,
  current: [older],
  incoming: [newer],
});
assert.equal(collision.evaluations.length, 1);
assert.equal(collision.evaluations[0]?.status, "uncertain");

console.log("Post-semantic merge/retry regression validation passed.");
