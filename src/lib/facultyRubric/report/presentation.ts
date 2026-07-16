import type { LocalEncounterSummary } from "../../localEncounter";
import type { FacultyCriterionEvaluation } from "../evaluation/types";
import { validatePersistedFacultyArtifacts } from "./artifactIntegrity";
import {
  buildFacultyComparisonSections,
  type FacultyComparisonSection,
} from "./comparison";
import { getCaseDisplayLabel } from "../../caseDisplay";
import type { ConversationMessage } from "../../conversationEngine";

export type CanonicalFacultyReportCriterion =
  NonNullable<LocalEncounterSummary["facultyReport"]>["criterionResults"][number] & {
    evaluationMethod: FacultyCriterionEvaluation["evaluationMethod"];
    confidence: number;
  };

export type CanonicalFacultyReportPresentation = {
  caseId: string;
  caseTitle: string;
  patientName: string;
  studentName?: string;
  caseLabel: string;
  attemptId?: string;
  completedAt?: string;
  report: NonNullable<LocalEncounterSummary["facultyReport"]>;
  transcript: ConversationMessage[];
  criteria: CanonicalFacultyReportCriterion[];
  comparisonSections: FacultyComparisonSection[];
};

export function buildCanonicalFacultyReportPresentation(
  summary: LocalEncounterSummary,
  patientName: string,
  caseTitle: string,
  metadata: {
    studentName?: string;
    attemptId?: string;
  } = {},
): CanonicalFacultyReportPresentation | null {
  const evaluation = summary.facultyRubricEvaluation;
  const score = summary.facultyRubricScore;
  const report = summary.facultyReport;

  if (
    evaluation?.status !== "complete" ||
    !score ||
    !report ||
    score.passStatus === "technical-invalid"
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Canonical faculty report load found incomplete artifacts.",
        JSON.stringify({
          caseId: summary.caseId,
          evaluationStatus: evaluation?.status ?? "missing",
          hasScore: Boolean(score),
          scorePassStatus: score?.passStatus ?? "missing",
          hasReport: Boolean(report),
          evaluationError: evaluation?.error,
        }),
      );
    }
    return null;
  }

  const integrity = validatePersistedFacultyArtifacts({
    caseId: summary.caseId,
    evaluation,
    score,
    report,
  });

  if (integrity.status !== "valid") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Canonical faculty report load rejected persisted artifacts.",
        JSON.stringify({
          caseId: summary.caseId,
          integrityStatus: integrity.status,
          errors: integrity.errors,
          warnings: integrity.warnings,
        }),
      );
    }
    return null;
  }

  const evaluations = new Map(
    evaluation.evaluations.map((item) => [item.criterionId, item]),
  );
  const criteria = report.criterionResults.map((criterion) => {
    const item = evaluations.get(criterion.criterionId);

    if (!item) {
      throw new Error(`missing_canonical_evaluation:${criterion.criterionId}`);
    }

    return {
      ...criterion,
      evaluationMethod: item.evaluationMethod,
      confidence: item.confidence,
    };
  });
  const reportCriterionIds = new Set(
    criteria.map((criterion) => criterion.criterionId),
  );
  const comparisonSections = buildFacultyComparisonSections(
    summary.caseId,
    evaluation.evaluations,
  )
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) =>
        reportCriterionIds.has(row.criterionId),
      ),
    }))
    .filter((section) => section.rows.length > 0);

  return {
    caseId: summary.caseId,
    caseTitle,
    patientName,
    studentName: metadata.studentName,
    caseLabel: getCaseDisplayLabel(summary.caseId),
    attemptId: metadata.attemptId,
    completedAt: summary.metadata?.completedAt ?? summary.savedAt,
    report,
    transcript: summary.conversationHistory.map((message) => ({ ...message })),
    criteria,
    comparisonSections,
  };
}
