import type {
  FacultyCriterionEvaluationValidationIssue,
  FacultyEvaluationMessage,
} from "./types";

export type AiFacultyCriterionEvaluation = {
  criterionId: string;
  status: "met" | "not-met" | "uncertain";
  confidence: number;
  learnerEvidenceMessageIds: string[];
  contextualPatientMessageIds: string[];
  evidenceExcerpts: string[];
  rationale: string;
};

export type AiFacultyCriterionEvaluationParseResult =
  | {
      success: true;
      results: AiFacultyCriterionEvaluation[];
      issues: FacultyCriterionEvaluationValidationIssue[];
    }
  | {
      success: false;
      issues: FacultyCriterionEvaluationValidationIssue[];
    };

type AiResponseShape = { results: unknown[] };

const validStatuses = new Set(["met", "not-met", "uncertain"]);

export function parseAndValidateAiFacultyEvaluationResponse({
  text,
  requestedCriterionIds,
  messages,
}: {
  text: string;
  requestedCriterionIds: string[];
  messages: FacultyEvaluationMessage[];
}): AiFacultyCriterionEvaluationParseResult {
  const parsed = parseJsonObject(text);
  const issues: FacultyCriterionEvaluationValidationIssue[] = [];

  if (!isAiResponseShape(parsed)) {
    return {
      success: false,
      issues: [
        {
          code: "invalid-ai-response-shape",
          message:
            "Semantic faculty rubric response must be JSON with a results array.",
        },
      ],
    };
  }

  const requestedIds = new Set(requestedCriterionIds);
  const resultIds = new Set<string>();
  const results: AiFacultyCriterionEvaluation[] = [];

  for (const candidate of parsed.results) {
    if (!isAiFacultyCriterionEvaluation(candidate)) {
      issues.push({
        code: "invalid-ai-result-shape",
        message: "A semantic faculty result was malformed and was ignored.",
      });
      continue;
    }
    const result = candidate;
    if (!requestedIds.has(result.criterionId)) {
      issues.push({
        code: "unknown-ai-criterion-id",
        message: `${result.criterionId} was not requested for semantic evaluation.`,
        criterionId: result.criterionId,
      });
      continue;
    }

    if (resultIds.has(result.criterionId)) {
      issues.push({
        code: "duplicate-ai-criterion-id",
        message: `${result.criterionId} appears more than once in the AI response.`,
        criterionId: result.criterionId,
      });
      continue;
    }
    resultIds.add(result.criterionId);

    if (!validStatuses.has(result.status)) {
      issues.push({
        code: "invalid-ai-status",
        message: `${result.criterionId} has an invalid status.`,
        criterionId: result.criterionId,
      });
    }

    if (
      typeof result.confidence !== "number" ||
      Number.isNaN(result.confidence) ||
      result.confidence < 0 ||
      result.confidence > 1
    ) {
      issues.push({
        code: "invalid-ai-confidence",
        message: `${result.criterionId} confidence must be between 0 and 1.`,
        criterionId: result.criterionId,
      });
    }

    if (!result.rationale.trim()) {
      issues.push({
        code: "missing-ai-rationale",
        message: `${result.criterionId} is missing rationale.`,
        criterionId: result.criterionId,
      });
    }

    validateMessageIds({
      criterionId: result.criterionId,
      field: "learnerEvidenceMessageIds",
      ids: result.learnerEvidenceMessageIds,
      messages,
      expectedRole: "student",
      issues,
    });
    validateMessageIds({
      criterionId: result.criterionId,
      field: "contextualPatientMessageIds",
      ids: result.contextualPatientMessageIds,
      messages,
      expectedRole: "patient",
      issues,
    });
    validateEvidenceExcerpts({
      criterionId: result.criterionId,
      excerpts: result.evidenceExcerpts,
      messages,
      issues,
    });
    const resultIssueCount = issues.length;
    if (
      validStatuses.has(result.status) &&
      typeof result.confidence === "number" &&
      result.confidence >= 0 &&
      result.confidence <= 1 &&
      result.rationale.trim() &&
      !issues.slice(0, resultIssueCount).some(
        (issue) => issue.criterionId === result.criterionId,
      )
    ) {
      results.push(result);
    }
  }

  return {
    success: true,
    results,
    issues,
  };
}

function validateMessageIds({
  criterionId,
  field,
  ids,
  messages,
  expectedRole,
  issues,
}: {
  criterionId: string;
  field: string;
  ids: string[];
  messages: FacultyEvaluationMessage[];
  expectedRole: "student" | "patient";
  issues: FacultyCriterionEvaluationValidationIssue[];
}) {
  const matchingMessages = new Map(
    messages
      .filter((message) => message.role === expectedRole)
      .map((message) => [message.id, message]),
  );

  for (const id of ids) {
    if (!matchingMessages.has(id)) {
      issues.push({
        code: "invalid-ai-message-id",
        message: `${criterionId} references invalid ${field} value ${id}.`,
        criterionId,
      });
    }
  }
}

function validateEvidenceExcerpts({
  criterionId,
  excerpts,
  messages,
  issues,
}: {
  criterionId: string;
  excerpts: string[];
  messages: FacultyEvaluationMessage[];
  issues: FacultyCriterionEvaluationValidationIssue[];
}) {
  const suppliedText = messages.map((message) => message.content).join("\n");

  for (const excerpt of excerpts) {
    if (!excerpt.trim() || !suppliedText.includes(excerpt)) {
      issues.push({
        code: "invented-ai-evidence-excerpt",
        message: `${criterionId} includes an excerpt that was not supplied.`,
        criterionId,
      });
    }
  }
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(stripCodeFence(text));
  } catch {
    return undefined;
  }
}

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function isAiResponseShape(value: unknown): value is AiResponseShape {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    return false;
  }

  return true;
}

function isAiFacultyCriterionEvaluation(
  value: unknown,
): value is AiFacultyCriterionEvaluation {
  return (
    isRecord(value) &&
    typeof value.criterionId === "string" &&
    typeof value.status === "string" &&
    typeof value.confidence === "number" &&
    Array.isArray(value.learnerEvidenceMessageIds) &&
    value.learnerEvidenceMessageIds.every((item) => typeof item === "string") &&
    Array.isArray(value.contextualPatientMessageIds) &&
    value.contextualPatientMessageIds.every((item) => typeof item === "string") &&
    Array.isArray(value.evidenceExcerpts) &&
    value.evidenceExcerpts.every((item) => typeof item === "string") &&
    typeof value.rationale === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
