import type {
  FacultyCriterionEvaluation,
  FacultyEvaluationEvidence,
  MergeFacultyCriterionEvaluationsInput,
  MergeFacultyCriterionEvaluationsResult,
} from "./types";
import { validateFacultyCriterionEvaluation } from "./validation";

export function mergeFacultyCriterionEvaluations({
  caseId,
  current,
  incoming,
}: MergeFacultyCriterionEvaluationsInput): MergeFacultyCriterionEvaluationsResult {
  const rejected: MergeFacultyCriterionEvaluationsResult["rejected"] = [];
  const merged = new Map<string, FacultyCriterionEvaluation>();

  for (const evaluation of current) {
    const validation = validateFacultyCriterionEvaluation(evaluation);

    if (!validation.valid || evaluation.caseId !== caseId) {
      rejected.push(...validation.issues);
      continue;
    }

    merged.set(evaluation.criterionId, {
      ...evaluation,
      evidence: deduplicateEvidence(evaluation.evidence),
    });
  }

  for (const evaluation of incoming) {
    const validation = validateFacultyCriterionEvaluation(evaluation);

    if (!validation.valid || evaluation.caseId !== caseId) {
      rejected.push(...validation.issues);
      continue;
    }

    const existing = merged.get(evaluation.criterionId);
    const normalizedIncoming = {
      ...evaluation,
      evidence: deduplicateEvidence(evaluation.evidence),
    };

    if (!existing) {
      merged.set(evaluation.criterionId, normalizedIncoming);
      continue;
    }

    const newest =
      Date.parse(normalizedIncoming.evaluatedAt) >= Date.parse(existing.evaluatedAt)
        ? normalizedIncoming
        : existing;

    merged.set(evaluation.criterionId, {
      ...newest,
      evidence: deduplicateEvidence([
        ...existing.evidence,
        ...normalizedIncoming.evidence,
      ]),
    });
  }

  return {
    evaluations: Array.from(merged.values()),
    rejected,
  };
}

function deduplicateEvidence(
  evidence: FacultyEvaluationEvidence[],
): FacultyEvaluationEvidence[] {
  const seen = new Set<string>();
  const deduplicated: FacultyEvaluationEvidence[] = [];

  for (const item of evidence) {
    const key = [
      item.source,
      item.messageId ?? "",
      item.eventId ?? "",
      item.excerpt ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduplicated.push(item);
  }

  return deduplicated;
}
