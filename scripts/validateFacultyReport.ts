import {
  buildFacultyReport,
  adaptFacultyReportToLegacyReport,
  FACULTY_REPORT_CRITICAL_MISS_MESSAGE,
  FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE,
  FACULTY_REPORT_OVERALL_MESSAGES,
  FACULTY_REPORT_UNCERTAINTY_MESSAGE,
  getCompetencyStatus,
  validatePersistedFacultyArtifacts,
  type BuildFacultyReportInput,
  type FacultyReportRubric,
  validateFacultyReportLegacyAdapterResult,
  validateFacultyReport,
} from "../src/lib/facultyRubric/report";
import {
  scoreFacultyRubricEvaluations,
  FACULTY_RUBRIC_SCORING_VERSION,
} from "../src/lib/facultyRubric/scoring";
import { FACULTY_RUBRIC_VERSION } from "../src/lib/facultyRubric/evaluation/state";
import { facultyRubrics } from "../src/lib/facultyRubric/caseRubrics";
import type { StructuredCaseReport } from "../src/lib/reportTypes";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const rubric: FacultyReportRubric = {
  caseId: "case-report-validation",
  rubricVersion: "rubric-validation-v1",
  criteria: [
    {
      id: "RPT-001",
      title: "Gathered the main concern",
      competency: "information-gathering",
      critical: false,
      learnerDescription: "Explored the patient's main concern",
    },
    {
      id: "RPT-002",
      title: "Assessed safety risk",
      competency: "clinical-interpretation",
      critical: true,
      learnerDescription: "Recognized a safety-critical finding",
    },
    {
      id: "RPT-UNSUPPORTED",
      title: "Unsupported future criterion",
      competency: "procedural-decision",
    },
  ],
};

const completedEvaluations: BuildFacultyReportInput["completedEvaluations"] = [
  {
    criterionId: "RPT-001",
    status: "met",
    rationale: "Structured evidence showed the criterion was met.",
    evidence: [{ source: "legacy-checklist-coverage", checklistItemId: "chief-complaint" }],
  },
  {
    criterionId: "RPT-002",
    status: "uncertain",
    rationale: "Available evidence was insufficient for a definitive evaluation.",
    evidence: [{ source: "semantic-evaluation", excerpt: "Ambiguous learner response" }],
  },
];

const score = {
  caseId: rubric.caseId,
  rubricVersion: "rubric-validation-v1",
  scoringVersion: "faculty-rubric-scoring-3c-3-v1",
  status: "complete",
  earnedPoints: 1,
  possiblePoints: 2,
  percentage: 50,
  rawPercentage: 50,
  passStatus: "does-not-pass",
  passingScorePercentage: 84,
  evaluatedScoredWeight: 2,
  configuredScoredWeight: 2,
  evaluationCoveragePercentage: 100,
  metCount: 1,
  notMetCount: 0,
  uncertainCount: 1,
  supportedScoredCriterionCount: 2,
  competencies: [
    {
      competency: "information-gathering",
      earnedPoints: 1,
      possiblePoints: 1,
      percentage: 100,
    },
    {
      competency: "clinical-interpretation",
      earnedPoints: 0,
      possiblePoints: 1,
      percentage: 0,
    },
  ],
  criteria: [
    {
      criterionId: "RPT-001",
      competency: "information-gathering",
      status: "met",
      weight: 1,
      originalWeight: 3,
      activeScoreWeight: 1,
      earnedPoints: 1,
      possiblePoints: 1,
      critical: false,
      provisionalWeight: false,
    },
    {
      criterionId: "RPT-002",
      competency: "clinical-interpretation",
      status: "uncertain",
      weight: 1,
      originalWeight: 2,
      activeScoreWeight: 1,
      earnedPoints: 0,
      possiblePoints: 1,
      critical: true,
      provisionalWeight: false,
    },
    {
      criterionId: "RPT-UNSUPPORTED",
      competency: "procedural-decision",
      status: "not-met",
      weight: 0,
      originalWeight: 1,
      activeScoreWeight: 0,
      earnedPoints: 0,
      possiblePoints: 0,
      critical: false,
      provisionalWeight: true,
    },
  ],
  safetyStatus: "critical-review",
  criticalMissCriterionIds: [],
  criticalReviewCriterionIds: ["RPT-002"],
  criticalUncertainCriterionIds: ["RPT-002"],
  unsupportedCriterionIds: ["RPT-UNSUPPORTED"],
  missingEvaluationCriterionIds: [],
  uncertainCriterionIds: ["RPT-002"],
  technicalValidationErrors: [],
} as unknown as BuildFacultyReportInput["score"];

const report = buildFacultyReport({
  rubric,
  completedEvaluations,
  score,
  generatedAt: "2026-07-11T00:00:00.000Z",
});
const validation = validateFacultyReport({ report, rubric, completedEvaluations, score });

assert(validation.valid, `Inactive faculty report validation failed: ${validation.errors.join("; ")}`);
assert(report.criterionResults.length === 2, "Unsupported criteria should be excluded from the report.");
assert(
  report.criterionResults.some((criterion) => criterion.criterionId === "RPT-001"),
  "Supported met criteria should be included.",
);
assert(
  report.competencyScores.some(
    (competency) =>
      competency.competency === "information-gathering" &&
      competency.earnedPoints === 1 &&
      competency.possiblePoints === 1,
  ),
  "Competency totals should come from the score object.",
);
assert(
  report.uncertainItems.some((item) => item.criterion.criterionId === "RPT-002"),
  "Uncertain criteria should be represented.",
);
assert(
  report.criticalSafetyItems.some((item) => item.criterion.criterionId === "RPT-002"),
  "Critical items should be represented.",
);
assert(
  report.strengths.some((strength) => strength.criterionId === "RPT-001"),
  "Met supported criteria should produce deterministic strengths.",
);
assert(
  report.improvementAreas.some(
    (improvement) => improvement.criterionId === "RPT-002" && improvement.status === "uncertain",
  ),
  "Uncertain supported criteria should produce deterministic improvement areas.",
);
assert(
  !report.strengths.some((strength) => strength.criterionId === "RPT-UNSUPPORTED"),
  "Unsupported criteria should not produce strengths.",
);
assert(
  !report.improvementAreas.some((improvement) => improvement.criterionId === "RPT-UNSUPPORTED"),
  "Unsupported criteria should not produce improvement areas.",
);
assert(report.passStatus === "does-not-pass", "Pass status should match the score object.");
assert(report.overallResult.message === FACULTY_REPORT_OVERALL_MESSAGES["does-not-pass"], "Does-not-pass message should be deterministic.");
assert(report.uncertaintySummary.message === FACULTY_REPORT_UNCERTAINTY_MESSAGE, "Uncertainty summary should be present.");
assert(report.uncertaintySummary.uncertainItemCount === 1, "Uncertainty summary should count uncertain items.");
assert(report.uncertaintySummary.hasCriticalUncertainItems, "Uncertainty summary should flag critical uncertainty.");
assert(report.criticalSafetySummary.message === FACULTY_REPORT_CRITICAL_UNCERTAIN_MESSAGE, "Critical uncertainty message should be present.");
assert(report.criticalSafetySummary.criticalUncertainCount === 1, "Critical uncertainty count should be present.");

assert(getCompetencyStatus(100) === "strong", "100% competency should be strong.");
assert(getCompetencyStatus(84) === "strong", "84% competency should be strong.");
assert(getCompetencyStatus(83.999) === "developing", "Just below 84% competency should be developing.");
assert(getCompetencyStatus(50) === "developing", "50% competency should be developing.");
assert(getCompetencyStatus(49.999) === "needs-attention", "Below 50% competency should need attention.");
assert(getCompetencyStatus(null) === "unavailable", "No scored criteria should be unavailable.");

const passReport = buildFacultyReport({
  rubric,
  completedEvaluations: [
    {
      criterionId: "RPT-001",
      status: "met",
      evidence: [],
    },
    {
      criterionId: "RPT-002",
      status: "met",
      evidence: [],
    },
  ],
  score: {
    ...score,
    earnedPoints: 2,
    percentage: 100,
    rawPercentage: 100,
    passStatus: "pass",
    uncertainCount: 0,
    criteria: score.criteria.map((criterion) => ({
      ...criterion,
      status: criterion.criterionId === "RPT-UNSUPPORTED" ? criterion.status : "met",
      earnedPoints: criterion.criterionId === "RPT-UNSUPPORTED" ? 0 : 1,
    })),
    competencies: score.competencies.map((competency) => ({
      ...competency,
      earnedPoints: competency.possiblePoints,
      percentage: competency.possiblePoints === 0 ? null : 100,
    })),
    safetyStatus: "clear",
    criticalReviewCriterionIds: [],
    criticalUncertainCriterionIds: [],
    uncertainCriterionIds: [],
  } as BuildFacultyReportInput["score"],
});

assert(passReport.overallResult.message === FACULTY_REPORT_OVERALL_MESSAGES.pass, "Pass message should be deterministic.");
assert(!passReport.uncertaintySummary.message, "Uncertainty message should be absent when no uncertain items exist.");
assert(!passReport.criticalSafetySummary.message, "Critical safety message should be absent when clear.");

const criticalMissReport = buildFacultyReport({
  rubric,
  completedEvaluations: [
    {
      criterionId: "RPT-001",
      status: "met",
      evidence: [],
    },
    {
      criterionId: "RPT-002",
      status: "not-met",
      evidence: [],
    },
  ],
  score: {
    ...score,
    uncertainCount: 0,
    criteria: score.criteria.map((criterion) => ({
      ...criterion,
      status: criterion.criterionId === "RPT-002" ? "not-met" : criterion.status,
    })),
    criticalMissCriterionIds: ["RPT-002"],
    criticalReviewCriterionIds: [],
    criticalUncertainCriterionIds: [],
    uncertainCriterionIds: [],
    safetyStatus: "critical-miss",
  } as BuildFacultyReportInput["score"],
});

assert(
  criticalMissReport.criticalSafetySummary.message === FACULTY_REPORT_CRITICAL_MISS_MESSAGE,
  "Critical miss message should be deterministic.",
);
assert(
  buildFacultyReport({
    rubric,
    completedEvaluations,
    score: {
      ...score,
      competencies: [
        {
          competency: "information-gathering",
          earnedPoints: 0.83999,
          possiblePoints: 1,
          percentage: 83.999,
        },
      ],
      criteria: [
        {
          ...score.criteria[0],
          earnedPoints: 0.83999,
          possiblePoints: 1,
        },
      ],
      earnedPoints: 0.83999,
      possiblePoints: 1,
      percentage: 84,
      rawPercentage: 83.999,
      unsupportedCriterionIds: [],
      uncertainCriterionIds: [],
      criticalReviewCriterionIds: [],
      criticalUncertainCriterionIds: [],
    } as BuildFacultyReportInput["score"],
  }).competencyScores[0]?.statusLabel === "developing",
  "Display rounding should not change competency classification.",
);

const legacyReport: StructuredCaseReport = {
  case: {
    caseId: rubric.caseId,
    title: "Mock Legacy Case",
    patientName: "Mock Patient",
    chiefComplaint: "Mock complaint",
    completedAt: "2026-07-11T00:00:00.000Z",
  },
  overallPerformance: {
    score: 72,
    summary: "Legacy summary",
    mainTakeaway: "Legacy takeaway",
  },
  domains: {
    communication: createLegacyDomain(80),
    history: createLegacyDomain(70),
    examination: createLegacyDomain(60),
    reasoning: createLegacyDomain(50),
    management: createLegacyDomain(40),
  },
  clinicalReasoning: {
    expectedDiagnosis: "Legacy diagnosis",
    differentialDiagnosis: ["Legacy differential"],
    supportingFindings: ["Legacy finding"],
    keyRedFlags: ["Legacy red flag"],
  },
  management: {
    requiredInvestigations: ["Legacy investigation"],
    treatmentExpectations: ["Legacy treatment"],
    referralExpectations: ["Legacy referral"],
    safetyNettingExpectations: ["Legacy safety-netting"],
  },
  practiceNext: ["Legacy practice item"],
  transcript: [{ role: "student", text: "What brings you in?", timestamp: "2026-07-11T00:00:00.000Z" }],
  timeline: [{ type: "student_message", label: "Student message", timestamp: "2026-07-11T00:00:00.000Z" }],
  grading: {
    patient: createChecklistSection(1, 1, 100),
    clinical: createChecklistSection(1, 1, 100),
    domains: {
      communication: createChecklistSection(1, 1, 80),
      history: createChecklistSection(1, 1, 70),
      examination: createChecklistSection(1, 1, 60),
      reasoning: createChecklistSection(1, 1, 50),
      management: createChecklistSection(1, 1, 40),
    },
    overall: 72,
  },
};

const adapted = adaptFacultyReportToLegacyReport(report, { legacyReport });
const adapterValidation = validateFacultyReportLegacyAdapterResult({
  facultyReport: report,
  result: adapted,
  legacyReport,
});

assert(adapterValidation.valid, `Faculty report legacy adapter validation failed: ${adapterValidation.errors.join("; ")}`);
assert(adapted.adaptedReport.overallPerformance.score === 72, "Adapter must not overwrite active legacy score.");
assert(adapted.facultyRubricPreview.score === report.overallScore.percentage, "Adapter should expose proposed faculty score separately.");
assert(adapted.facultyRubricPreview.passingThreshold === 84, "Adapter should preserve the inactive 84% threshold.");
assert(adapted.adaptedReport.transcript === legacyReport.transcript, "Adapter should preserve transcript references.");
assert(adapted.adaptedReport.timeline === legacyReport.timeline, "Adapter should preserve timeline references.");
assert(
  adapted.comparison.adaptedUncertainItems.reasoning.some((item) => item.includes("Uncertain")),
  "Uncertain items should remain identifiable in the adapted data.",
);
assert(
  adapted.comparison.adaptedCriticalSafetyItems.some((item) => item.includes("Uncertain")),
  "Critical uncertain items should be represented separately from ordinary misses.",
);
assert(
  !JSON.stringify(adapted).includes("RPT-UNSUPPORTED"),
  "Unsupported criteria should not leak into the adapted report.",
);

const integrityRubric = facultyRubrics[0];

assert(Boolean(integrityRubric), "At least one faculty rubric should be available for integrity validation.");

if (integrityRubric) {
  const integrityEvaluations = integrityRubric.criteria.map((criterion) => ({
    caseId: integrityRubric.caseId,
    criterionId: criterion.id,
    status: "met" as const,
    confidence: 1,
    evidence: [{ source: "workflow-event" as const, excerpt: `Evidence for ${criterion.id}` }],
    rationale: `Rationale for ${criterion.title}.`,
    evaluationMethod: "deterministic" as const,
    evaluatedAt: "2026-07-11T00:00:00.000Z",
  }));
  const integrityScore = scoreFacultyRubricEvaluations({
    caseId: integrityRubric.caseId,
    evaluations: integrityEvaluations,
  });
  const integrityReport = buildFacultyReport({
    rubric: integrityRubric,
    completedEvaluations: integrityEvaluations,
    score: integrityScore,
    generatedAt: "2026-07-11T00:00:00.000Z",
  });
  const integrityEvaluationState = {
    caseId: integrityRubric.caseId,
    rubricVersion: FACULTY_RUBRIC_VERSION,
    transcriptRevision: "integrity-test",
    status: "complete" as const,
    evaluations: integrityEvaluations,
    evaluatedAt: "2026-07-11T00:00:00.000Z",
  };
  const validIntegrity = validatePersistedFacultyArtifacts({
    caseId: integrityRubric.caseId,
    evaluation: integrityEvaluationState,
    score: integrityScore,
    report: integrityReport,
  });

  assert(validIntegrity.status === "valid", `Expected valid integrity, got ${validIntegrity.status}: ${validIntegrity.errors.join("; ")}`);
  assert(
    validatePersistedFacultyArtifacts({
      caseId: "wrong-case",
      evaluation: integrityEvaluationState,
      score: integrityScore,
      report: integrityReport,
    }).status === "invalid",
    "Case ID mismatch should be invalid.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: {
        ...integrityEvaluationState,
        rubricVersion: "old-rubric-version",
      },
      score: integrityScore,
      report: integrityReport,
    }).status === "stale",
    "Rubric version mismatch should be stale.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: integrityEvaluationState,
      score: {
        ...integrityScore,
        scoringVersion: "old-scoring-version",
      },
      report: integrityReport,
    }).status === "stale",
    "Scoring version mismatch should be stale.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: {
        ...integrityEvaluationState,
        evaluations: integrityEvaluations.slice(1),
      },
      score: integrityScore,
      report: integrityReport,
    }).status === "invalid",
    "Missing supported criterion should be invalid.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: {
        ...integrityEvaluationState,
        evaluations: [integrityEvaluations[0], ...integrityEvaluations],
      },
      score: integrityScore,
      report: integrityReport,
    }).status === "invalid",
    "Duplicate criterion evaluation should be invalid.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: integrityEvaluationState,
      score: {
        ...integrityScore,
        earnedPoints: integrityScore.earnedPoints - 1,
      },
      report: integrityReport,
    }).status === "invalid",
    "Score arithmetic mismatch should be invalid.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: integrityEvaluationState,
      score: {
        ...integrityScore,
        passStatus: integrityScore.passStatus === "pass" ? "does-not-pass" : "pass",
      },
      report: integrityReport,
    }).status === "invalid",
    "Pass-status mismatch should be invalid.",
  );
  assert(
    validatePersistedFacultyArtifacts({
      caseId: integrityRubric.caseId,
      evaluation: integrityEvaluationState,
      score: integrityScore,
      report: {
        ...integrityReport,
        strengths: [
          {
            criterionId: integrityReport.improvementAreas[0]?.criterionId ?? "unknown",
            competency: "history",
            title: "Invalid strength",
            supportingEvidence: [],
            displayPriority: 0,
          },
        ],
      },
    }).status === "invalid",
    "Report strength mismatch should be invalid.",
  );
  assert(FACULTY_RUBRIC_SCORING_VERSION === integrityScore.scoringVersion, "Integrity test should use current scoring version.");
}

console.log("Inactive faculty report model validation passed.");

function createLegacyDomain(scoreValue: number) {
  return {
    score: scoreValue,
    completed: 1,
    total: 1,
    earnedWeight: 1,
    availableWeight: 1,
    completedCriteria: ["Legacy completed"],
    strengths: ["Legacy strength"],
    missedOrIncomplete: ["Legacy missed"],
    narrative: "Legacy narrative",
    criticalMisses: [],
  };
}

function createChecklistSection(completed: number, total: number, scoreValue: number) {
  return {
    total,
    completed,
    earnedWeight: completed,
    availableWeight: total,
    missed: [],
    criticalMisses: [],
    score: scoreValue,
  };
}
