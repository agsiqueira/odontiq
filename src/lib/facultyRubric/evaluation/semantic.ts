import "server-only";

import {
  getAIProvider,
  type AIProviderResponse,
  type AITextGenerationInput,
} from "@/lib/ai";
import { facultyRubrics } from "../caseRubrics";
import type { FacultyRubricCriterion } from "../types";
import { evaluateDeterministicFacultyCriteria } from "./deterministic";
import { mergeFacultyCriterionEvaluations } from "./merge";
import {
  buildFacultyConversationExchanges,
  buildFacultySemanticEvaluationUserPrompt,
  FACULTY_SEMANTIC_EVALUATION_SYSTEM_PROMPT,
} from "./semanticPrompt";
import {
  parseAndValidateAiFacultyEvaluationResponse,
  type AiFacultyCriterionEvaluation,
} from "./semanticSchema";
import type {
  FacultyCriterionEvaluation,
  FacultyCriterionEvaluationValidationIssue,
  FacultyEvaluationEvidence,
  FacultyEvaluationInput,
  FacultyEvaluationMessage,
} from "./types";
import { normalizeFacultyEvaluationInput } from "./evidence";
import { validateFacultyCriterionEvaluation } from "./validation";
import {
  validateExplicitLearnerEvidence,
  validateTargetedSemanticEvidence,
} from "./semanticEvidenceRules";
import { evaluateFacultySemanticWithRetry } from "./retry";

export type FacultySemanticEvaluationModel = (
  input: AITextGenerationInput,
) => Promise<AIProviderResponse>;

export type EvaluateSemanticFacultyCriteriaInput = {
  input: FacultyEvaluationInput;
  deterministicEvaluations?: FacultyCriterionEvaluation[];
  generateText?: FacultySemanticEvaluationModel;
  evaluatedAt?: string;
  batchSize?: number;
};

export type EvaluateSemanticFacultyCriteriaResult = {
  semanticEvaluations: FacultyCriterionEvaluation[];
  mergedEvaluations: FacultyCriterionEvaluation[];
  rejected: FacultyCriterionEvaluationValidationIssue[];
  requestedCriterionIds: string[];
};

const semanticEvaluationModes = new Set([
  "conversation-question",
  "finding-elicitation",
  "clinical-statement",
  "recommendation",
  "patient-education",
  "shared-decision-making",
  "procedural-choice",
]);

const defaultBatchSize = 4;
const semanticMaxTokens = 2_400;

export async function evaluateSemanticFacultyCriteria({
  input,
  deterministicEvaluations,
  generateText,
  evaluatedAt = new Date().toISOString(),
  batchSize = defaultBatchSize,
}: EvaluateSemanticFacultyCriteriaInput): Promise<EvaluateSemanticFacultyCriteriaResult> {
  const normalizedInput = normalizeFacultyEvaluationInput(input);
  const rubric = getFacultyRubric(normalizedInput.caseId);

  if (!rubric) {
    return {
      semanticEvaluations: [],
      mergedEvaluations: deterministicEvaluations ?? [],
      rejected: [
        {
          code: "invalid-case-id",
          message: `${normalizedInput.caseId} is not a known faculty rubric case.`,
          caseId: normalizedInput.caseId,
        },
      ],
      requestedCriterionIds: [],
    };
  }

  const deterministic =
    deterministicEvaluations ??
    evaluateDeterministicFacultyCriteria(normalizedInput);
  const candidateCriteria = getSemanticFacultyCriteria({
    criteria: rubric.criteria,
    deterministicEvaluations: deterministic,
  });

  if (candidateCriteria.length === 0) {
    return {
      semanticEvaluations: [],
      mergedEvaluations: deterministic,
      rejected: [],
      requestedCriterionIds: [],
    };
  }

  const textGenerator = generateText ?? getDefaultSemanticTextGenerator();
  const semanticEvaluations: FacultyCriterionEvaluation[] = [];
  const rejected: FacultyCriterionEvaluationValidationIssue[] = [];

  for (const [batchIndex, batch] of chunkCriteria(candidateCriteria, batchSize).entries()) {
    const { providerResponse, parseResult, successfulAttemptNumber } =
      await evaluateFacultySemanticWithRetry({
        evaluate: async (batchAttemptNumber) => {
          let response;
          try {
            response = await textGenerator({
              systemPrompt: batchAttemptNumber === 1
                ? FACULTY_SEMANTIC_EVALUATION_SYSTEM_PROMPT
                : `${FACULTY_SEMANTIC_EVALUATION_SYSTEM_PROMPT}\n\nCORRECTION: The prior response could not be parsed. Return one complete JSON object with a results array. Do not use markdown fences, commentary, or trailing text.`,
              temperature: 0.1,
              maxTokens: semanticMaxTokens,
              messages: [
                {
                  role: "user",
                  content: buildFacultySemanticEvaluationUserPrompt({
                    caseId: rubric.caseId,
                    criteria: batch,
                    input: normalizedInput,
                  }),
                },
              ],
            });
          } catch (error) {
            throw new Error(
              `semantic_batch_${batchIndex + 1}_request_failed`,
              { cause: error },
            );
          }
          const parsed = parseAndValidateAiFacultyEvaluationResponse({
            text: response.text,
            requestedCriterionIds: batch.map((criterion) => criterion.id),
            messages: normalizedInput.messages,
          });
          if (!parsed.success) {
            if (process.env.NODE_ENV !== "production") {
              console.error("Faculty semantic response parsing failed.", {
                caseId: rubric.caseId,
                attemptNumber: batchAttemptNumber,
                batchNumber: batchIndex + 1,
                requestedCriterionIds: batch.map((criterion) => criterion.id),
                provider: response.diagnostics?.provider ?? "injected",
                providerStatus: response.diagnostics?.status,
                providerContentType: response.diagnostics?.contentType,
                responseLength: response.text.length,
                parseIssues: parsed.issues.map((issue) => issue.code),
              });
            }
            throw new Error(
              `semantic_batch_${batchIndex + 1}_invalid_top_level_response`,
            );
          }
          return {
            providerResponse: response,
            parseResult: parsed,
            successfulAttemptNumber: batchAttemptNumber,
          };
        },
        onFirstFailure: (error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("Faculty semantic batch attempt failed.", {
              caseId: rubric.caseId,
              attemptNumber: 1,
              batchNumber: batchIndex + 1,
              requestedCriterionIds: batch.map((criterion) => criterion.id),
              error: error instanceof Error ? error.message : "unknown_error",
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        },
      });

    if (process.env.NODE_ENV !== "production") {
      console.info("Faculty semantic response diagnostics.", {
        caseId: rubric.caseId,
        attemptNumber: successfulAttemptNumber,
        batchNumber: batchIndex + 1,
        provider: providerResponse.diagnostics?.provider ?? "injected",
        providerStatus: providerResponse.diagnostics?.status,
        providerContentType: providerResponse.diagnostics?.contentType,
        parsingSucceeded: parseResult.success,
        semanticItemsReturned: parseResult.success
          ? parseResult.results.length + parseResult.issues.length
          : 0,
        semanticItemsAccepted: parseResult.success
          ? parseResult.results.length
          : 0,
        semanticItemsRejected: parseResult.issues.length,
        rejected: parseResult.issues.map((issue) => ({
          reason: issue.code,
          criterionId: issue.criterionId,
        })),
      });
    }

    rejected.push(...parseResult.issues);

    for (const aiResult of parseResult.results) {
      const criterion = batch.find(
        (candidate) => candidate.id === aiResult.criterionId,
      );

      if (!criterion) {
        rejected.push({
          code: "unknown-ai-criterion-id",
          message: `${aiResult.criterionId} was not requested for semantic evaluation.`,
          caseId: rubric.caseId,
          criterionId: aiResult.criterionId,
        });
        continue;
      }

      const targetedEvidence = validateTargetedSemanticEvidence({
        criterionId: criterion.id,
        criterionName: criterion.name,
        result: aiResult,
        messages: normalizedInput.messages,
      });
      if (aiResult.status === "met" && targetedEvidence.applicable && !targetedEvidence.valid) {
        rejected.push({
          code: "unsupported-targeted-evidence",
          message:
            "The targeted criterion requires direct learner-authored evidence; generic, unrelated, or patient-only evidence was ignored.",
          caseId: rubric.caseId,
          criterionId: aiResult.criterionId,
        });
        continue;
      }

      const explicitLearnerEvidence = validateExplicitLearnerEvidence({
        criterion,
        result: aiResult,
        messages: normalizedInput.messages,
      });
      if (aiResult.status === "met" && !explicitLearnerEvidence.valid) {
        rejected.push({
          code: "unsupported-targeted-evidence",
          message: `The claimed learner behavior was not explicitly demonstrated (${explicitLearnerEvidence.reason}).`,
          caseId: rubric.caseId,
          criterionId: aiResult.criterionId,
        });
        continue;
      }

      const evaluation = convertAiResultToFacultyEvaluation({
        caseId: rubric.caseId,
        aiResult,
        messages: normalizedInput.messages,
        evaluatedAt,
      });
      const validation = validateFacultyCriterionEvaluation(evaluation);

      if (!validation.valid) {
        rejected.push(...validation.issues);
        continue;
      }

      semanticEvaluations.push(evaluation);
    }
  }

  const mergeResult = mergeFacultyCriterionEvaluations({
    caseId: rubric.caseId,
    current: deterministic,
    incoming: filterSemanticResultsForMerge({
      semanticEvaluations,
      deterministicEvaluations: deterministic,
    }),
  });

  return {
    semanticEvaluations,
    mergedEvaluations: mergeResult.evaluations,
    rejected: [...rejected, ...mergeResult.rejected],
    requestedCriterionIds: candidateCriteria.map((criterion) => criterion.id),
  };
}

export function getSemanticFacultyCriteria({
  criteria,
  deterministicEvaluations,
}: {
  criteria: FacultyRubricCriterion[];
  deterministicEvaluations: FacultyCriterionEvaluation[];
}) {
  const resolvedDeterministicIds = new Set(
    deterministicEvaluations
      .filter(
        (evaluation) =>
          evaluation.evaluationMethod === "case-state" ||
          evaluation.status === "met",
      )
      .map((evaluation) => evaluation.criterionId),
  );

  return criteria.filter((criterion) => {
    if (!semanticEvaluationModes.has(criterion.evaluationMode)) {
      return false;
    }

    if (criterion.expectation !== "required") {
      return false;
    }

    if (resolvedDeterministicIds.has(criterion.id)) {
      return false;
    }

    return !isExplicitlyDeferredCriterion(criterion);
  });
}

export function getSemanticFacultyEvaluationCoverageReport() {
  return facultyRubrics.map((rubric) => {
    const deterministicEvaluations = evaluateDeterministicFacultyCriteria({
      caseId: rubric.caseId,
      messages: [],
      events: [],
      coveredChecklistItems: [],
    });
    const semanticCriteria = getSemanticFacultyCriteria({
      criteria: rubric.criteria,
      deterministicEvaluations,
    });
    const unsupportedCriteria = rubric.criteria.filter(
      (criterion) =>
        criterion.expectation === "required" &&
        !semanticCriteria.some((semantic) => semantic.id === criterion.id) &&
        !deterministicEvaluations.some(
          (evaluation) => evaluation.criterionId === criterion.id,
        ),
    );

    return {
      caseId: rubric.caseId,
      deterministicCriteria: deterministicEvaluations.length,
      caseStateCriteria: deterministicEvaluations.filter(
        (evaluation) => evaluation.evaluationMethod === "case-state",
      ).length,
      neutralCriteria: rubric.criteria.filter(
        (criterion) => criterion.expectation === "neutral",
      ).length,
      semanticCriteria: semanticCriteria.length,
      unsupportedCriteria: unsupportedCriteria.map((criterion) => criterion.id),
    };
  });
}

export { buildFacultyConversationExchanges };

function convertAiResultToFacultyEvaluation({
  caseId,
  aiResult,
  messages,
  evaluatedAt,
}: {
  caseId: string;
  aiResult: AiFacultyCriterionEvaluation;
  messages: FacultyEvaluationMessage[];
  evaluatedAt: string;
}): FacultyCriterionEvaluation {
  return {
    caseId,
    criterionId: aiResult.criterionId,
    status: aiResult.status,
    confidence: aiResult.confidence,
    evidence: buildSemanticEvidence(aiResult, messages),
    rationale: aiResult.rationale,
    evaluationMethod: "ai-semantic",
    evaluatedAt,
  };
}

function buildSemanticEvidence(
  aiResult: AiFacultyCriterionEvaluation,
  messages: FacultyEvaluationMessage[],
): FacultyEvaluationEvidence[] {
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const evidence: FacultyEvaluationEvidence[] = [];

  for (const messageId of aiResult.learnerEvidenceMessageIds) {
    const message = messagesById.get(messageId);
    evidence.push({
      source: "student-message",
      messageId,
      excerpt: selectExcerptForMessage(message, aiResult.evidenceExcerpts),
    });
  }

  for (const messageId of aiResult.contextualPatientMessageIds) {
    const message = messagesById.get(messageId);
    evidence.push({
      source: "patient-response",
      messageId,
      excerpt: selectExcerptForMessage(message, aiResult.evidenceExcerpts),
    });
  }

  return deduplicateEvidence(evidence);
}

function selectExcerptForMessage(
  message: FacultyEvaluationMessage | undefined,
  excerpts: string[],
) {
  if (!message) {
    return undefined;
  }

  return (
    excerpts.find((excerpt) => message.content.includes(excerpt)) ??
    message.content
  );
}

function filterSemanticResultsForMerge({
  semanticEvaluations,
  deterministicEvaluations,
}: {
  semanticEvaluations: FacultyCriterionEvaluation[];
  deterministicEvaluations: FacultyCriterionEvaluation[];
}) {
  const authoritativeDeterministicIds = new Set(
    deterministicEvaluations
      .filter(
        (evaluation) =>
          evaluation.evaluationMethod === "case-state" ||
          evaluation.status === "met",
      )
      .map((evaluation) => evaluation.criterionId),
  );

  return semanticEvaluations.filter(
    (evaluation) => !authoritativeDeterministicIds.has(evaluation.criterionId),
  );
}

function chunkCriteria(criteria: FacultyRubricCriterion[], size: number) {
  const chunks: FacultyRubricCriterion[][] = [];
  const safeSize = Math.max(1, size);

  for (let index = 0; index < criteria.length; index += safeSize) {
    chunks.push(criteria.slice(index, index + safeSize));
  }

  return chunks;
}

function deduplicateEvidence(
  evidence: FacultyEvaluationEvidence[],
): FacultyEvaluationEvidence[] {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = [
      item.source,
      item.messageId ?? "",
      item.eventId ?? "",
      item.excerpt ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getDefaultSemanticTextGenerator(): FacultySemanticEvaluationModel {
  const provider = getAIProvider();

  return (input) => provider.generateText(input);
}

function isExplicitlyDeferredCriterion(criterion: FacultyRubricCriterion) {
  return /faculty should confirm|clarification needed|pending scoring calibration/i.test(
    criterion.facultyNotes ?? "",
  );
}

function getFacultyRubric(caseId: string) {
  return facultyRubrics.find((rubric) => rubric.caseId === caseId);
}
