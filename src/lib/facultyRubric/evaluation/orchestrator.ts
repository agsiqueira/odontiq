import "server-only";

import {
  createEvaluationEventId,
  createFacultyRubricTranscriptRevision,
  FACULTY_RUBRIC_VERSION,
  isFacultyRubricEvaluationStateStale,
  type FacultyRubricEncounterEvaluationInput,
  type FacultyRubricEvaluationState,
} from "./state";
import {
  type FacultySemanticEvaluationModel,
} from "./semantic";
import { evaluateDeterministicFacultyCriteria } from "./deterministic";
import { evaluateSemanticFacultyCriteria } from "./semantic";
import { validateFacultyCriterionEvaluations } from "./validation";
import type { FacultyEvaluationInput } from "./types";
import {
  finalizeMissingSupportedCriteria,
  normalizeBidirectionalEvaluations,
} from "./finalization";
import { getResolvedFacultyRubricCalibration } from "../calibration";

export type EvaluateFacultyRubricForEncounterInput =
  FacultyRubricEncounterEvaluationInput & {
    existingState?: FacultyRubricEvaluationState;
    forceRefresh?: boolean;
    generateText?: FacultySemanticEvaluationModel;
  };

export async function evaluateFacultyRubricForEncounter({
  existingState,
  forceRefresh = false,
  generateText,
  ...encounterInput
}: EvaluateFacultyRubricForEncounterInput): Promise<FacultyRubricEvaluationState> {
  const transcriptRevision =
    createFacultyRubricTranscriptRevision(encounterInput);
  const lastAttemptedAt = new Date().toISOString();

  if (
    existingState &&
    !forceRefresh &&
    !isFacultyRubricEvaluationStateStale(existingState, transcriptRevision) &&
    existingState.status === "complete"
  ) {
    return existingState;
  }

  const evaluationInput = buildFacultyEvaluationInput(encounterInput);
  const deterministicEvaluations =
    evaluateDeterministicFacultyCriteria(evaluationInput);

  try {
    const semanticResult = await evaluateSemanticFacultyCriteria({
      input: evaluationInput,
      deterministicEvaluations,
      generateText,
      evaluatedAt: lastAttemptedAt,
    });
    const completedEvaluations = finalizeMissingSupportedCriteria({
      caseId: encounterInput.caseId,
      evaluations: semanticResult.mergedEvaluations,
      evaluatedAt: lastAttemptedAt,
    });
    const finalEvaluations = normalizeBidirectionalEvaluations({
      caseId: encounterInput.caseId,
      evaluations: completedEvaluations,
    });
    const validation = validateFacultyCriterionEvaluations(finalEvaluations);
    const coverage = validateSupportedCriterionCoverage({
      caseId: encounterInput.caseId,
      evaluations: finalEvaluations,
    });
    const hasFailures =
      !validation.valid ||
      coverage.missingCriterionIds.length > 0 ||
      coverage.duplicateCriterionIds.length > 0;

    if (process.env.NODE_ENV !== "production") {
      const deterministicIds = deterministicEvaluations.map(
        (evaluation) => evaluation.criterionId,
      );
      const semanticIds = semanticResult.semanticEvaluations.map(
        (evaluation) => evaluation.criterionId,
      );
      const collisions = semanticIds
        .filter((criterionId) => deterministicIds.includes(criterionId))
        .map((criterionId) => ({
          criterionId,
          winner: semanticResult.mergedEvaluations.find(
            (evaluation) => evaluation.criterionId === criterionId,
          )?.evaluationMethod,
        }));
      console.info("Faculty rubric evaluation diagnostics.", {
        caseId: encounterInput.caseId,
        expectedScoredCriterionCount: coverage.expectedCriterionIds.length,
        deterministicResultCount: deterministicEvaluations.length,
        deterministicCriterionIds: deterministicIds,
        semanticCriteriaRequested: semanticResult.requestedCriterionIds.length,
        semanticResultsAccepted: semanticResult.semanticEvaluations.length,
        acceptedSemanticCriterionIds: semanticIds,
        semanticResultsRejected: semanticResult.rejected.length,
        rejectedSemanticResults: semanticResult.rejected.map((issue) => ({
          reason: issue.code,
          criterionId: issue.criterionId,
        })),
        mergedScoredCriterionCount: coverage.actualCriterionIds.length,
        mergedCriterionIds: semanticResult.mergedEvaluations.map(
          (evaluation) => evaluation.criterionId,
        ),
        collisions,
        finalizedCriterionCount: completedEvaluations.length,
        expectedSupportedCriterionIds: coverage.expectedCriterionIds,
        finalizedCriterionIds: completedEvaluations.map(
          (evaluation) => evaluation.criterionId,
        ),
        normalizedScoredCriterionCount: finalEvaluations.length,
        normalizedCriteria: finalEvaluations.map((evaluation) => ({
          criterionId: evaluation.criterionId,
          status: evaluation.status,
          expectedValue: evaluation.expectedValue,
          observedValue: evaluation.observedValue,
        })),
        evaluationValidationValid: validation.valid,
        evaluationValidationIssues: validation.issues.map((issue) => ({
          code: issue.code,
          criterionId: issue.criterionId,
        })),
        missingCriterionIds: coverage.missingCriterionIds,
        duplicateCriterionIds: coverage.duplicateCriterionIds,
        rejectedSemanticResultReasons: semanticResult.rejected.map(
          (issue) => issue.code,
        ),
        finalIntegrityStatus: hasFailures ? "invalid" : "complete",
      });
    }

    return {
      caseId: encounterInput.caseId,
      rubricVersion: FACULTY_RUBRIC_VERSION,
      transcriptRevision,
      status: hasFailures ? "partial" : "complete",
      evaluations: finalEvaluations,
      evaluatedAt: lastAttemptedAt,
      lastAttemptedAt,
      error: hasFailures
        ? summarizeEvaluationError([
            ...semanticResult.rejected,
            ...validation.issues,
            ...coverage.missingCriterionIds.map(() => ({
              code: "missing-supported-criterion",
            })),
            ...coverage.duplicateCriterionIds.map(() => ({
              code: "duplicate-supported-criterion",
            })),
          ])
        : undefined,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Faculty rubric evaluation pipeline failed.", {
        caseId: encounterInput.caseId,
        transcriptRevision,
        error: error instanceof Error ? error.message : "unknown_error",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return {
      caseId: encounterInput.caseId,
      rubricVersion: FACULTY_RUBRIC_VERSION,
      transcriptRevision,
      status: deterministicEvaluations.length > 0 ? "partial" : "failed",
      evaluations: deterministicEvaluations,
      lastAttemptedAt,
      error: summarizeUnknownError(error),
    };
  }
}

export function validateSupportedCriterionCoverage({
  caseId,
  evaluations,
}: {
  caseId: string;
  evaluations: Array<{ caseId: string; criterionId: string }>;
}) {
  const expectedCriterionIds = getResolvedFacultyRubricCalibration(caseId)
    .filter((criterion) => criterion.scored && criterion.supported)
    .map((criterion) => criterion.criterionId);
  const expected = new Set(expectedCriterionIds);
  const counts = new Map<string, number>();

  for (const evaluation of evaluations) {
    if (evaluation.caseId === caseId && expected.has(evaluation.criterionId)) {
      counts.set(
        evaluation.criterionId,
        (counts.get(evaluation.criterionId) ?? 0) + 1,
      );
    }
  }

  return {
    expectedCriterionIds,
    actualCriterionIds: [...counts.keys()],
    missingCriterionIds: expectedCriterionIds.filter(
      (criterionId) => !counts.has(criterionId),
    ),
    duplicateCriterionIds: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([criterionId]) => criterionId),
  };
}

export function buildFacultyEvaluationInput({
  caseId,
  conversationHistory,
  encounterEvents,
  coveredChecklistItems,
}: FacultyRubricEncounterEvaluationInput): FacultyEvaluationInput {
  return {
    caseId,
    messages: conversationHistory.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.text,
      createdAt: message.timestamp,
    })),
    events: encounterEvents.map((event, index) => ({
      id: createEvaluationEventId(event, index),
      type: event.type,
      createdAt: event.timestamp,
      metadata: event.payload,
    })),
    coveredChecklistItems,
  };
}

function summarizeEvaluationError(issues: Array<{ code: string }>) {
  if (issues.length === 0) {
    return undefined;
  }

  const issueCounts = issues.reduce<Record<string, number>>((counts, issue) => {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1;
    return counts;
  }, {});

  return Object.entries(issueCounts)
    .map(([code, count]) => `${code}:${count}`)
    .join(",");
}

function summarizeUnknownError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("timed out")) {
      return "semantic_evaluation_timeout";
    }
    if (/^semantic_batch_\d+_(?:request_failed|invalid_top_level_response)$/.test(error.message)) {
      return error.message;
    }
    return "semantic_evaluation_failed";
  }

  return "semantic_evaluation_failed";
}
