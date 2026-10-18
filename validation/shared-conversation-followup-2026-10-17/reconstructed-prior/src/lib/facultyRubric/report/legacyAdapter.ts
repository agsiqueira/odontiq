import type { EvaluatorDomain } from "@/data/cases";
import type {
  ReportDomainSection,
  StructuredCaseReport,
} from "@/lib/reportTypes";

import type {
  FacultyReport,
  FacultyReportCriterionResult,
  FacultyReportImprovementArea,
  FacultyReportStrength,
} from "./types";

export type LegacyReportAdapterContext = {
  legacyReport: StructuredCaseReport;
};

export type FacultyRubricPreview = {
  score: number | null;
  rawScore: number | null;
  passStatus: FacultyReport["passStatus"];
  passingThreshold: 84;
  scoringVersion: string;
  rubricVersion: string;
};

export type FacultyReportLegacyComparison = {
  legacyOverallScore: number;
  proposedFacultyRubricScore: number | null;
  legacyDomainScores: Record<EvaluatorDomain, number>;
  adaptedFacultyDomainScores: Record<EvaluatorDomain, number>;
  legacyStrengths: Record<EvaluatorDomain, string[]>;
  adaptedStrengths: Record<EvaluatorDomain, string[]>;
  legacyImprovementAreas: Record<EvaluatorDomain, string[]>;
  adaptedNotMetItems: Record<EvaluatorDomain, string[]>;
  adaptedUncertainItems: Record<EvaluatorDomain, string[]>;
  legacyCriticalSafetyItems: string[];
  adaptedCriticalSafetyItems: string[];
};

export type FacultyReportLegacyAdapterResult = {
  adaptedReport: StructuredCaseReport;
  facultyRubricPreview: FacultyRubricPreview;
  comparison: FacultyReportLegacyComparison;
  validation: FacultyReportLegacyAdapterValidationResult;
};

export type FacultyReportLegacyAdapterValidationResult = {
  valid: boolean;
  errors: string[];
};

export const FACULTY_COMPETENCY_TO_REPORT_DOMAIN: Record<
  string,
  EvaluatorDomain
> = {
  "information-gathering": "history",
  "clinical-findings": "examination",
  "clinical-interpretation": "reasoning",
  "management-planning": "management",
  "patient-communication": "communication",
  "procedural-decision": "management",
  examination: "examination",
};

const evaluatorDomains: EvaluatorDomain[] = [
  "communication",
  "history",
  "examination",
  "reasoning",
  "management",
];

export function adaptFacultyReportToLegacyReport(
  facultyReport: FacultyReport,
  legacyContext: LegacyReportAdapterContext,
): FacultyReportLegacyAdapterResult {
  const adaptedDomains = createAdaptedDomainSections(facultyReport);
  const adaptedReport: StructuredCaseReport = {
    ...legacyContext.legacyReport,
    overallPerformance: {
      ...legacyContext.legacyReport.overallPerformance,
      summary: facultyReport.overallResult.message,
      mainTakeaway:
        facultyReport.criticalSafetySummary.message ??
        facultyReport.uncertaintySummary.message ??
        legacyContext.legacyReport.overallPerformance.mainTakeaway,
    },
    domains: adaptedDomains,
  };
  const facultyRubricPreview: FacultyRubricPreview = {
    score: facultyReport.overallScore.percentage,
    rawScore: facultyReport.overallScore.rawPercentage,
    passStatus: facultyReport.passStatus,
    passingThreshold: 84,
    scoringVersion: facultyReport.scoringVersion,
    rubricVersion: facultyReport.rubricVersion,
  };
  const comparison = compareFacultyReportToLegacyReport({
    facultyReport,
    adaptedReport,
    legacyReport: legacyContext.legacyReport,
  });
  const validation = validateFacultyReportLegacyAdapterResult({
    facultyReport,
    result: {
      adaptedReport,
      facultyRubricPreview,
      comparison,
      validation: { valid: true, errors: [] },
    },
    legacyReport: legacyContext.legacyReport,
  });

  return {
    adaptedReport,
    facultyRubricPreview,
    comparison,
    validation,
  };
}

export function compareFacultyReportToLegacyReport({
  facultyReport,
  adaptedReport,
  legacyReport,
}: {
  facultyReport: FacultyReport;
  adaptedReport: StructuredCaseReport;
  legacyReport: StructuredCaseReport;
}): FacultyReportLegacyComparison {
  return {
    legacyOverallScore: legacyReport.overallPerformance.score,
    proposedFacultyRubricScore: facultyReport.overallScore.percentage,
    legacyDomainScores: mapDomains((domain) => legacyReport.domains[domain].score),
    adaptedFacultyDomainScores: mapDomains(
      (domain) => adaptedReport.domains[domain].score,
    ),
    legacyStrengths: mapDomains((domain) => legacyReport.domains[domain].strengths),
    adaptedStrengths: mapDomains((domain) => adaptedReport.domains[domain].strengths),
    legacyImprovementAreas: mapDomains(
      (domain) => legacyReport.domains[domain].missedOrIncomplete,
    ),
    adaptedNotMetItems: mapDomains((domain) =>
      adaptedReport.domains[domain].missedOrIncomplete.filter(
        (item) => !item.startsWith("Uncertain"),
      ),
    ),
    adaptedUncertainItems: mapDomains((domain) =>
      adaptedReport.domains[domain].missedOrIncomplete.filter((item) =>
        item.startsWith("Uncertain"),
      ),
    ),
    legacyCriticalSafetyItems: evaluatorDomains.flatMap(
      (domain) => legacyReport.domains[domain].criticalMisses,
    ),
    adaptedCriticalSafetyItems: evaluatorDomains.flatMap(
      (domain) => adaptedReport.domains[domain].criticalMisses,
    ),
  };
}

export function validateFacultyReportLegacyAdapterResult({
  facultyReport,
  result,
  legacyReport,
}: {
  facultyReport: FacultyReport;
  result: FacultyReportLegacyAdapterResult;
  legacyReport: StructuredCaseReport;
}): FacultyReportLegacyAdapterValidationResult {
  const errors: string[] = [];
  const mappedCriterionIds = new Map<string, number>();

  for (const domain of evaluatorDomains) {
    const section = result.adaptedReport.domains[domain];

    if (!section) {
      errors.push(`missing-domain:${domain}`);
      continue;
    }

    for (const criterionId of extractCriterionIds(section)) {
      mappedCriterionIds.set(
        criterionId,
        (mappedCriterionIds.get(criterionId) ?? 0) + 1,
      );
    }
  }

  for (const criterion of facultyReport.criterionResults.filter(
    (item) => item.supported,
  )) {
    const count = mappedCriterionIds.get(criterion.criterionId) ?? 0;

    if (count !== 1) {
      errors.push(`criterion-map-count:${criterion.criterionId}:${count}`);
    }
  }

  for (const criterionId of mappedCriterionIds.keys()) {
    if (!facultyReport.criterionResults.some((item) => item.criterionId === criterionId)) {
      errors.push(`unknown-adapted-criterion:${criterionId}`);
    }
  }

  if (result.adaptedReport.overallPerformance.score !== legacyReport.overallPerformance.score) {
    errors.push("legacy-overall-score-changed");
  }

  if (result.adaptedReport.transcript !== legacyReport.transcript) {
    errors.push("transcript-not-preserved");
  }

  if (result.adaptedReport.timeline !== legacyReport.timeline) {
    errors.push("timeline-not-preserved");
  }

  if (
    result.facultyRubricPreview.score !== facultyReport.overallScore.percentage ||
    result.facultyRubricPreview.passStatus !== facultyReport.passStatus
  ) {
    errors.push("faculty-preview-mismatch");
  }

  try {
    JSON.stringify(result);
  } catch {
    errors.push("adapter-result-not-serializable");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function createAdaptedDomainSections(
  facultyReport: FacultyReport,
): Record<EvaluatorDomain, ReportDomainSection> {
  return mapDomains((domain) => createDomainSection(facultyReport, domain));
}

function createDomainSection(
  facultyReport: FacultyReport,
  domain: EvaluatorDomain,
): ReportDomainSection {
  const criteria = facultyReport.criterionResults.filter(
    (criterion) => mapCompetencyToReportDomain(criterion.competency) === domain,
  );
  const supportedCriteria = criteria.filter((criterion) => criterion.supported);
  const earnedWeight = sumScores(supportedCriteria, "earnedPoints");
  const availableWeight = sumScores(supportedCriteria, "possiblePoints");
  const completedCriteria = supportedCriteria
    .filter((criterion) => criterion.status === "met")
    .map(formatCriterionWithId);
  const strengths = facultyReport.strengths
    .filter((strength) => mapCompetencyToReportDomain(strength.competency) === domain)
    .map(formatStrengthWithId);
  const notMetItems = facultyReport.improvementAreas
    .filter((improvement) => mapCompetencyToReportDomain(improvement.competency) === domain)
    .map(formatImprovementWithId);
  const criticalMisses = supportedCriteria
    .filter(
      (criterion) =>
        criterion.critical &&
        (criterion.status === "not-met" || criterion.status === "uncertain"),
    )
    .map((criterion) =>
      criterion.status === "uncertain"
        ? `Uncertain — No credit awarded: ${criterion.title} [${criterion.criterionId}]`
        : `${criterion.title} [${criterion.criterionId}]`,
    );
  const narrative = facultyReport.competencyScores
    .filter((competency) => mapCompetencyToReportDomain(competency.competency) === domain)
    .map((competency) => competency.summaryMessage)
    .filter(Boolean)
    .join(" ");

  return {
    score: availableWeight > 0 ? roundScore((earnedWeight / availableWeight) * 100) : 0,
    completed: completedCriteria.length,
    total: supportedCriteria.length,
    earnedWeight,
    availableWeight,
    completedCriteria,
    strengths,
    missedOrIncomplete: notMetItems,
    narrative: narrative || "This domain was not assessed in the faculty-rubric report.",
    criticalMisses,
  };
}

function mapCompetencyToReportDomain(competency: string): EvaluatorDomain {
  return FACULTY_COMPETENCY_TO_REPORT_DOMAIN[competency] ?? "reasoning";
}

function formatCriterionWithId(criterion: FacultyReportCriterionResult): string {
  return `${criterion.title} [${criterion.criterionId}]`;
}

function formatStrengthWithId(strength: FacultyReportStrength): string {
  return `${strength.title} [${strength.criterionId}]`;
}

function formatImprovementWithId(improvement: FacultyReportImprovementArea): string {
  const title = `${improvement.title} [${improvement.criterionId}]`;

  return improvement.status === "uncertain"
    ? `Uncertain — No credit awarded: ${title}`
    : title;
}

function extractCriterionIds(section: ReportDomainSection): string[] {
  return [
    ...section.completedCriteria,
    ...section.missedOrIncomplete,
  ].flatMap((item) => {
    const match = item.match(/\[([^\]]+)\]$/);
    return match?.[1] ? [match[1]] : [];
  });
}

function sumScores(
  criteria: FacultyReportCriterionResult[],
  field: "earnedPoints" | "possiblePoints",
) {
  return roundScore(
    criteria.reduce((sum, criterion) => sum + (criterion.score?.[field] ?? 0), 0),
  );
}

function mapDomains<T>(callback: (domain: EvaluatorDomain) => T): Record<EvaluatorDomain, T> {
  return {
    communication: callback("communication"),
    history: callback("history"),
    examination: callback("examination"),
    reasoning: callback("reasoning"),
    management: callback("management"),
  };
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

