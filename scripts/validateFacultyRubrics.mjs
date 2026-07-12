import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const loadedModules = new Map();
const nodeRequire = createRequire(import.meta.url);

function resolveModule(request, parentFilename) {
  if (request.startsWith("@/")) {
    const base = path.join(srcRoot, request.slice(2));
    const candidates = [`${base}.ts`, `${base}.json`, path.join(base, "index.ts")];
    const match = candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );

    if (match) {
      return match;
    }

    return `${base}.ts`;
  }

  if (request.startsWith(".")) {
    const base = path.resolve(path.dirname(parentFilename), request);
    const candidates = [base, `${base}.ts`, `${base}.json`, path.join(base, "index.ts")];
    const match = candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );

    if (match) {
      return match;
    }
  }

  return request;
}

function loadModule(filename) {
  if (loadedModules.has(filename)) {
    return loadedModules.get(filename).exports;
  }

  if (filename.endsWith(".json")) {
    const jsonModule = { exports: JSON.parse(fs.readFileSync(filename, "utf8")) };
    loadedModules.set(filename, jsonModule);
    return jsonModule.exports;
  }

  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      resolveJsonModule: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  loadedModules.set(filename, cjsModule);

  const requireFromFile = (request) => {
    const resolved = resolveModule(request, filename);

    if (request === "server-only") {
      return {};
    }

    if (resolved === request && !path.isAbsolute(resolved)) {
      return nodeRequire(request);
    }

    return loadModule(resolved);
  };

  new Function("exports", "require", "module", "__filename", "__dirname", output)(
    cjsModule.exports,
    requireFromFile,
    cjsModule,
    filename,
    path.dirname(filename),
  );

  return cjsModule.exports;
}

const {
  buildFacultyConversationExchanges,
  createFacultyRubricTranscriptRevision,
  evaluateDeterministicFacultyCriteria,
  evaluateFacultyRubricForEncounter,
  evaluateSemanticFacultyCriteria,
  FACULTY_RUBRIC_SCORING_VERSION,
  FACULTY_RUBRIC_VERSION,
  facultyRubrics,
  getContextualPatientMessages,
  getDeterministicFacultyEvaluationCoverageReport,
  getEligibleEncounterEvents,
  getEligibleLearnerMessages,
  getFacultyRubric,
  getFacultyRubricByCompetency,
  getFacultyRubricCriterion,
  getSemanticFacultyEvaluationCoverageReport,
  isFacultyRubricEvaluationStateStale,
  mergeFacultyCriterionEvaluations,
  normalizeFacultyEvaluationInput,
  parseAndValidateAiFacultyEvaluationResponse,
  buildFacultyRubricCalibrationCsv,
  buildFacultyRubricCalibrationExport,
  DEFAULT_EVALUATION_COVERAGE_POLICY,
  DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
  FINAL_FACULTY_RUBRIC_POLICY,
  getAllResolvedFacultyRubricCalibration,
  getCriticalPolicyProjections,
  getFacultyRubricActivationReadiness,
  getFacultyRubricCalibrationReport,
  getFacultyRubricPassStatus,
  getFacultyRubricScenarioResults,
  getUnsupportedFacultyRubricCriterionIds,
  scoreFacultyRubricEvaluations,
  validateEvaluationCoveragePolicy,
  validateFacultyRubricActivationPolicy,
  validateFacultyRubricCalibration,
  validateFacultyCriterionEvaluation,
  validateFacultyRubrics,
} = loadModule(path.join(srcRoot, "lib", "facultyRubric", "index.ts"));
const { CASE_DATA } = loadModule(path.join(srcRoot, "data", "cases", "index.ts"));
const { evaluateEncounter } = loadModule(
  path.join(srcRoot, "lib", "checklistEvaluation.ts"),
);

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const validation = validateFacultyRubrics();
assert(validation.valid, `Faculty rubric validation failed: ${JSON.stringify(validation.issues, null, 2)}`);
assert(facultyRubrics.length === 5, "All five faculty rubrics should load.");

const allCriteria = facultyRubrics.flatMap((rubric) => rubric.criteria);
assert(
  new Set(allCriteria.map((criterion) => criterion.id)).size === allCriteria.length,
  "Faculty criterion IDs should be globally unique.",
);

for (const caseData of CASE_DATA) {
  const rubric = getFacultyRubric(caseData.metadata.id);
  assert(Boolean(rubric), `${caseData.metadata.id} should have a faculty rubric.`);
  assert(
    rubric?.caseId === caseData.metadata.id,
    `${caseData.metadata.id} should preserve existing case ID compatibility.`,
  );

  const informationGathering = getFacultyRubricByCompetency(
    caseData.metadata.id,
    "information-gathering",
  );
  assert(
    informationGathering.length > 0,
    `${caseData.metadata.id} should include information-gathering criteria.`,
  );

  const firstCriterion = rubric?.criteria[0];
  assert(
    !firstCriterion ||
      getFacultyRubricCriterion(caseData.metadata.id, firstCriterion.id)?.id ===
        firstCriterion.id,
    `${caseData.metadata.id} criterion lookup should work.`,
  );
}

const case02AirwayState = getFacultyRubricCriterion("case-02", "C2-CF-001");
assert(
  case02AirwayState?.expectation === "expected-case-state" &&
    case02AirwayState.evaluationMode === "case-state" &&
    case02AirwayState.weight === 0,
  "Case 2 none-of-the-above airway state should be non-scoring case state.",
);

const neutralCriteria = allCriteria.filter(
  (criterion) => criterion.expectation === "neutral",
);
assert(
  neutralCriteria.every((criterion) => criterion.weight === 0),
  "Neutral findings should not carry score.",
);

const requiredPositiveFindings = allCriteria.filter(
  (criterion) =>
    criterion.competency === "clinical-findings" &&
    criterion.expectation === "required",
);
assert(
  requiredPositiveFindings.length > 0,
  "Required positive findings should be represented as scored criteria.",
);

const provisionalWeights = allCriteria.filter(
  (criterion) => criterion.provisionalWeight,
);
assert(
  provisionalWeights.length > 0,
  "New rubric-only criteria should mark provisional default weights.",
);

const serialized = JSON.parse(JSON.stringify(facultyRubrics));
assert(
  serialized.length === facultyRubrics.length,
  "Faculty rubrics should serialize safely.",
);

const sampleScoresBeforeActivation = CASE_DATA.map((caseData) =>
  evaluateEncounter({
    caseId: caseData.metadata.id,
    coveredChecklistItems: [],
  }),
);
assert(
  sampleScoresBeforeActivation.every((score) => score.overall === 0),
  "Faculty rubric architecture should not alter current empty-coverage scoring.",
);

function isScoredCriterion(criterion) {
  return criterion.expectation === "required" && criterion.weight > 0;
}

function mockCriterionEvaluation(criterion, status = "met") {
  const expectedValue =
    typeof criterion.expectedValue === "boolean"
      ? criterion.expectedValue
      : criterion.evaluationMode === "recommendation"
        ? false
        : true;
  const observedValue =
    status === "uncertain"
      ? undefined
      : expectedValue
        ? status === "met"
        : status === "not-met";
  return {
    caseId: criterion.caseId,
    criterionId: criterion.id,
    status,
    confidence: status === "uncertain" ? 0.5 : 1,
    evidence:
      status === "not-applicable"
        ? []
        : [
            {
              source: "student-message",
              messageId: `${criterion.id}-message`,
              excerpt: `Mock evidence for ${criterion.id}.`,
            },
          ],
    rationale: `Mock ${status} evaluation for ${criterion.id}.`,
    evaluationMethod: "deterministic",
    evaluatedAt: "2026-07-11T12:00:00.000Z",
    expectedValue,
    observedValue,
  };
}

function scoredCriteriaForCase(caseId) {
  return (
    facultyRubrics
      .find((rubric) => rubric.caseId === caseId)
      ?.criteria.filter(isScoredCriterion)
      .map((criterion) => ({ ...criterion, caseId })) ?? []
  );
}

for (const rubric of facultyRubrics) {
  const scoredCriteria = scoredCriteriaForCase(rubric.caseId);
  const allMetScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion) =>
      mockCriterionEvaluation(criterion, "met"),
    ),
  });

  assert(
    allMetScore.percentage === 100 &&
      allMetScore.status === "complete" &&
      allMetScore.passStatus === "pass" &&
      allMetScore.scoringVersion === FACULTY_RUBRIC_SCORING_VERSION,
    `${rubric.caseId} all-met faculty score should be complete and 100%.`,
  );
  assert(
    allMetScore.passingScorePercentage ===
      FINAL_FACULTY_RUBRIC_POLICY.passingScorePercentage &&
      allMetScore.criteria.every(
        (criterion) =>
          criterion.activeScoreWeight === 1 &&
          criterion.possiblePoints === 1,
      ),
    `${rubric.caseId} should use approved equal-item scoring weight.`,
  );
  assert(
    allMetScore.competencies.every(
      (competency) =>
        competency.possiblePoints > 0 || competency.percentage === null,
    ),
    `${rubric.caseId} competencies without available criteria should be unavailable, not 0%.`,
  );

  const firstCriterion = scoredCriteria[0];
  const firstMissScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion) =>
      mockCriterionEvaluation(
        criterion,
        criterion.id === firstCriterion.id ? "not-met" : "met",
      ),
    ),
  });
  assert(
    firstMissScore.percentage !== null &&
      firstMissScore.percentage < 100 &&
      firstMissScore.criteria.some(
        (criterion) =>
          criterion.criterionId === firstCriterion.id &&
          criterion.earnedPoints === 0,
      ),
    `${rubric.caseId} one missed criterion should reduce proposed points.`,
  );

  const multipleMissScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion, index) =>
      mockCriterionEvaluation(criterion, index < 2 ? "not-met" : "met"),
    ),
  });
  assert(
    multipleMissScore.percentage !== null &&
      firstMissScore.percentage !== null &&
      multipleMissScore.percentage <= firstMissScore.percentage,
    `${rubric.caseId} multiple missed criteria should not improve the proposed score.`,
  );

  const uncertainScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion) =>
      mockCriterionEvaluation(
        criterion,
        criterion.id === firstCriterion.id ? "uncertain" : "met",
      ),
    ),
  });
  assert(
    uncertainScore.status === "complete" &&
      uncertainScore.uncertainCriterionIds.includes(firstCriterion.id) &&
      uncertainScore.possiblePoints === allMetScore.possiblePoints &&
      uncertainScore.earnedPoints === allMetScore.earnedPoints - 1,
    `${rubric.caseId} uncertain criteria should be valid completed results and earn no direct credit.`,
  );

  const missingScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria
      .filter((criterion) => criterion.id !== firstCriterion.id)
      .map((criterion) => mockCriterionEvaluation(criterion, "met")),
  });
  assert(
    missingScore.status === "technical-invalid" &&
      missingScore.passStatus === "technical-invalid" &&
      missingScore.percentage === null &&
      missingScore.missingEvaluationCriterionIds.includes(firstCriterion.id) &&
      missingScore.evaluationCoveragePercentage < 100,
    `${rubric.caseId} missing supported criteria should produce technical-invalid scoring.`,
  );

  const unsupportedScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria
      .filter((criterion) => criterion.id !== firstCriterion.id)
      .map((criterion) => mockCriterionEvaluation(criterion, "met")),
    unsupportedCriterionIds: [firstCriterion.id],
  });
  assert(
    unsupportedScore.unsupportedCriterionIds.includes(firstCriterion.id) &&
      !unsupportedScore.missingEvaluationCriterionIds.includes(
        firstCriterion.id,
      ) &&
      unsupportedScore.possiblePoints === missingScore.possiblePoints,
    `${rubric.caseId} unsupported criteria should be excluded from the active denominator.`,
  );
  const firstCompetencyCriterionIds = scoredCriteria
    .filter((criterion) => criterion.competency === firstCriterion.competency)
    .map((criterion) => criterion.id);
  const unsupportedCompetencyScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria
      .filter((criterion) => !firstCompetencyCriterionIds.includes(criterion.id))
      .map((criterion) => mockCriterionEvaluation(criterion, "met")),
    unsupportedCriterionIds: firstCompetencyCriterionIds,
  });
  assert(
    unsupportedCompetencyScore.competencies.some(
      (competency) =>
        competency.competency === firstCriterion.competency &&
        competency.possiblePoints === 0 &&
        competency.percentage === null,
    ),
    `${rubric.caseId} a competency with no available scored criteria should remain unavailable.`,
  );

  const notApplicableScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion) =>
      mockCriterionEvaluation(
        criterion,
        criterion.id === firstCriterion.id ? "not-applicable" : "met",
      ),
    ),
  });
  assert(
    notApplicableScore.status === "technical-invalid" &&
      notApplicableScore.technicalValidationErrors.some((error) =>
        error.startsWith("invalid-supported-status:"),
      ),
    `${rubric.caseId} not-applicable should be invalid for supported scored criteria.`,
  );

  const caseStateCriterion = rubric.criteria.find(
    (criterion) => criterion.expectation === "expected-case-state",
  );
  if (caseStateCriterion) {
    const caseStateScore = scoreFacultyRubricEvaluations({
      caseId: rubric.caseId,
      evaluations: [
        ...scoredCriteria.map((criterion) =>
          mockCriterionEvaluation(criterion, "met"),
        ),
        mockCriterionEvaluation(
          { ...caseStateCriterion, caseId: rubric.caseId },
          "not-applicable",
        ),
      ],
    });
    assert(
      caseStateScore.possiblePoints === allMetScore.possiblePoints &&
        caseStateScore.status === "complete",
      `${rubric.caseId} expected-case-state criteria should remain excluded from scoring.`,
    );
  }

  const neutralCriterion = rubric.criteria.find(
    (criterion) => criterion.expectation === "neutral",
  );
  if (neutralCriterion) {
    const neutralScore = scoreFacultyRubricEvaluations({
      caseId: rubric.caseId,
      evaluations: [
        ...scoredCriteria.map((criterion) =>
          mockCriterionEvaluation(criterion, "met"),
        ),
        mockCriterionEvaluation(
          { ...neutralCriterion, caseId: rubric.caseId },
          "met",
        ),
      ],
    });
    assert(
      neutralScore.possiblePoints === allMetScore.possiblePoints,
      `${rubric.caseId} neutral criteria should remain excluded from possible points.`,
    );
  }

  const criticalCriterion = scoredCriteria.find(
    (criterion) => criterion.critical,
  );
  if (criticalCriterion) {
    const criticalMissScore = scoreFacultyRubricEvaluations({
      caseId: rubric.caseId,
      evaluations: scoredCriteria.map((criterion) =>
        mockCriterionEvaluation(
          criterion,
          criterion.id === criticalCriterion.id ? "not-met" : "met",
        ),
      ),
    });
    assert(
      criticalMissScore.safetyStatus === "critical-miss" &&
        criticalMissScore.criticalMissCriterionIds.includes(
          criticalCriterion.id,
        ),
      `${rubric.caseId} critical misses should be flagged separately from numeric scoring.`,
    );

    const criticalReviewScore = scoreFacultyRubricEvaluations({
      caseId: rubric.caseId,
      evaluations: scoredCriteria.map((criterion) =>
        mockCriterionEvaluation(
          criterion,
          criterion.id === criticalCriterion.id ? "uncertain" : "met",
        ),
      ),
    });
    assert(
      criticalReviewScore.safetyStatus === "critical-review" &&
        criticalReviewScore.criticalReviewCriterionIds.includes(
          criticalCriterion.id,
        ) &&
        criticalReviewScore.criticalUncertainCriterionIds.includes(
          criticalCriterion.id,
        ) &&
        criticalReviewScore.passStatus !== "technical-invalid",
      `${rubric.caseId} uncertain critical criteria should require critical review.`,
    );
  }

  const duplicateScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: [
      ...scoredCriteria.map((criterion) =>
        mockCriterionEvaluation(criterion, "met"),
      ),
      mockCriterionEvaluation(firstCriterion, "met"),
    ],
  });
  assert(
    duplicateScore.status === "technical-invalid" &&
      duplicateScore.technicalValidationErrors.some((error) =>
        error.startsWith("duplicate-result:"),
      ),
    `${rubric.caseId} duplicate supported criterion results should be technical-invalid.`,
  );

  const serializedScore = JSON.parse(JSON.stringify(allMetScore));
  assert(
    serializedScore.scoringVersion === FACULTY_RUBRIC_SCORING_VERSION &&
      serializedScore.percentage === allMetScore.percentage,
    `${rubric.caseId} proposed faculty score should serialize stably.`,
  );
}

assert(
  getFacultyRubricPassStatus(84, false) === "pass" &&
    getFacultyRubricPassStatus(83.999, false) === "does-not-pass" &&
    getFacultyRubricPassStatus(83.6, false) === "does-not-pass" &&
    getFacultyRubricPassStatus(null, true) === "technical-invalid",
  "Pass/fail should use raw percentage and not display rounding.",
);

const unknownCriterionScore = scoreFacultyRubricEvaluations({
  caseId: "case-01",
  evaluations: [
    ...scoredCriteriaForCase("case-01").map((criterion) =>
      mockCriterionEvaluation(criterion, "met"),
    ),
    {
      ...mockCriterionEvaluation(scoredCriteriaForCase("case-01")[0], "met"),
      criterionId: "C1-UNKNOWN",
    },
  ],
});
assert(
  unknownCriterionScore.status === "technical-invalid" &&
    unknownCriterionScore.technicalValidationErrors.some((error) =>
      error.startsWith("unknown-criterion:"),
    ),
  "Unknown criterion IDs should make the proposed faculty score technical-invalid.",
);

assert(
  sampleScoresBeforeActivation.every((score) => score.overall === 0),
  "Inactive faculty scoring should leave current legacy scoring unchanged after scenario tests.",
);

const calibrationReport = getFacultyRubricCalibrationReport();
assert(
  calibrationReport.length === 5 &&
    calibrationReport.every(
      (caseReport) =>
        caseReport.totalConfiguredScoredWeight > 0 &&
        caseReport.expectedMaximumScore === 100 &&
        caseReport.criteria.length > 0,
    ),
  "Calibration report should cover all five cases with configured weights.",
);

const calibrationValidation = validateFacultyRubricCalibration();
assert(
  calibrationValidation.valid,
  `Faculty rubric calibration should validate: ${JSON.stringify(calibrationValidation.issues)}`,
);
assert(
  validateFacultyRubricActivationPolicy(
    DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
  ).valid,
  "Default warning-only critical miss policy should validate.",
);
assert(
  !validateFacultyRubricActivationPolicy({
    criticalMissPolicy: "score-cap",
    uncertainCriticalPolicy: "review-only",
  }).valid,
  "Score-cap policy should require an explicit score cap.",
);
assert(
  validateEvaluationCoveragePolicy(DEFAULT_EVALUATION_COVERAGE_POLICY).valid,
  "Default evaluation coverage policy should validate.",
);
assert(
  !validateEvaluationCoveragePolicy({
    ...DEFAULT_EVALUATION_COVERAGE_POLICY,
    minimumCoveragePercentage: 101,
  }).valid,
  "Coverage policy should reject impossible coverage thresholds.",
);

const resolvedCalibration = getAllResolvedFacultyRubricCalibration();
const scoredResolvedCalibration = resolvedCalibration.filter((row) => row.scored);
assert(
  scoredResolvedCalibration.length > 0 &&
    scoredResolvedCalibration.every((row) => row.weightSource && row.supportSource),
  "Every scored criterion should expose calibration-source metadata.",
);
assert(
  scoredResolvedCalibration
    .filter((row) => row.provisionalWeight)
    .every((row) => row.weightSource === "provisional-default"),
  "Every provisional criterion should be clearly marked as provisional-default.",
);
assert(
  scoredResolvedCalibration
    .filter((row) => row.critical)
    .every((row) => row.criticalSource && row.criticalRationale),
  "Every critical criterion should expose source and rationale metadata.",
);
assert(
  ["C3-PD-003", "C4-PD-001", "C5-PD-002"].every((criterionId) =>
    resolvedCalibration.some(
      (row) =>
        row.criterionId === criterionId &&
        !row.supported &&
        row.supportSource === "awaiting-clarification" &&
        row.facultyDecisionRequired,
    ),
  ),
  "Unsupported procedural criteria should remain awaiting faculty clarification.",
);

for (const rubric of facultyRubrics) {
  const unsupportedCriterionIds = getUnsupportedFacultyRubricCriterionIds(
    rubric.caseId,
  );
  const scoredCriteria = scoredCriteriaForCase(rubric.caseId);
  const allMetScore = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations: scoredCriteria.map((criterion) =>
      mockCriterionEvaluation(criterion, "met"),
    ),
    unsupportedCriterionIds,
  });

  assert(
    unsupportedCriterionIds.every(
      (criterionId) =>
        !allMetScore.criteria.some(
          (criterion) => criterion.criterionId === criterionId,
        ),
    ),
    `${rubric.caseId} unsupported criteria should not contribute to the denominator.`,
  );

  const readiness = getFacultyRubricActivationReadiness({
    score: allMetScore,
    calibration: resolvedCalibration.filter((row) => row.caseId === rubric.caseId),
  });

  if (unsupportedCriterionIds.length > 0) {
    assert(
      readiness === "unsupported-criteria-remain",
      `${rubric.caseId} unsupported criteria should block activation readiness.`,
    );
  }

  const criticalPolicyProjections = getCriticalPolicyProjections({
    score: {
      ...allMetScore,
      safetyStatus: "critical-miss",
      criticalMissCriterionIds: ["mock-critical"],
    },
    activationReadiness: "requires-faculty-review",
  });
  assert(
    criticalPolicyProjections.some(
      (projection) =>
        projection.policy === "score-cap" && projection.percentage !== null,
    ) &&
      criticalPolicyProjections.some(
        (projection) =>
          projection.policy === "automatic-fail" && projection.percentage === 0,
      ),
    `${rubric.caseId} critical policy projections should support cap and fail modes without activation.`,
  );
}

const calibrationExport = buildFacultyRubricCalibrationExport(
  "2026-07-11T12:00:00.000Z",
);
const calibrationCsv = buildFacultyRubricCalibrationCsv(calibrationExport.rows);
assert(
  calibrationExport.rows.length === resolvedCalibration.length &&
    calibrationExport.summaries.length === 5 &&
    calibrationCsv.includes("caseId,criterionId,title"),
  "Calibration JSON and CSV export structures should include expected rows and headers.",
);

const scenarioResults = getFacultyRubricScenarioResults();
assert(
  scenarioResults.length === facultyRubrics.length * 6 &&
    facultyRubrics.every((rubric) =>
      [
        "excellent-encounter",
        "strong-history-weak-management",
        "weak-history-correct-diagnosis",
        "safety-critical-miss",
        "incomplete-semantic-evaluation",
        "uncertain-evidence",
      ].every((scenario) =>
        scenarioResults.some(
          (result) => result.caseId === rubric.caseId && result.scenario === scenario,
        ),
      ),
    ),
  "Scenario calibration tests should cover all five cases and six scenario types.",
);
assert(
  scenarioResults.some(
    (result) =>
      result.scenario === "incomplete-semantic-evaluation" &&
      result.score.status === "technical-invalid" &&
      result.score.passStatus === "technical-invalid",
  ),
  "Incomplete semantic evaluation scenario should produce technical-invalid scoring.",
);
assert(
  scenarioResults.some(
    (result) =>
      result.scenario === "uncertain-evidence" &&
      result.score.status === "complete" &&
      result.score.uncertainCount > 0,
  ),
  "Uncertain evidence scenario should remain a valid completed score with no-credit uncertain items.",
);
assert(
  scenarioResults.every(
    (result) =>
      result.weightingComparison.directPercentage === result.score.percentage,
  ),
  "Scenario results should compare direct and competency-balanced percentages.",
);

const baseEvaluation = {
  caseId: "case-01",
  criterionId: "C1-IG-001",
  status: "met",
  confidence: 0.9,
  evidence: [
    {
      source: "student-message",
      messageId: "message-1",
      excerpt: "Do you have a fever?",
    },
  ],
  rationale: "The learner asked about fever.",
  evaluationMethod: "deterministic",
  evaluatedAt: "2026-07-11T12:00:00.000Z",
};

assert(
  validateFacultyCriterionEvaluation(baseEvaluation).valid,
  "A valid criterion evaluation should pass validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    caseId: "missing-case",
  }).valid,
  "Invalid case IDs should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    criterionId: "C1-IG-999",
  }).valid,
  "Invalid criterion IDs should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    confidence: -0.01,
  }).valid,
  "Confidence below 0 should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    confidence: 1.01,
  }).valid,
  "Confidence above 1 should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    rationale: "",
  }).valid,
  "Missing required fields should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    evidence: [{ source: "mentor-message", messageId: "message-2" }],
  }).valid,
  "Invalid evidence sources should fail validation.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    evidence: [],
  }).valid,
  "Met results without evidence should fail unless method is case-state.",
);

const validCaseStateEvaluation = {
  caseId: "case-02",
  criterionId: "C2-CF-001",
  status: "not-applicable",
  confidence: 1,
  evidence: [],
  rationale:
    "Faculty source marks none of the airway-compromise findings for this case state.",
  evaluationMethod: "case-state",
  evaluatedAt: "2026-07-11T12:00:00.000Z",
};
assert(
  validateFacultyCriterionEvaluation(validCaseStateEvaluation).valid,
  "Non-scoring expected-case-state criteria should allow not-applicable case-state results.",
);
assert(
  !validateFacultyCriterionEvaluation({
    ...baseEvaluation,
    status: "not-applicable",
    evaluationMethod: "deterministic",
  }).valid,
  "not-applicable should fail for normal learner-action criteria.",
);

const evidenceInput = normalizeFacultyEvaluationInput({
  caseId: "case-01",
  messages: [
    {
      id: "student-1",
      role: "student",
      content: "Do you have a fever?",
      createdAt: "2026-07-11T12:00:00.000Z",
    },
    {
      id: "patient-1",
      role: "patient",
      content: "Yes, I feel feverish.",
      createdAt: "2026-07-11T12:00:01.000Z",
    },
    {
      id: "mentor-1",
      role: "mentor",
      content: "Ask about red flags.",
      createdAt: "2026-07-11T12:00:02.000Z",
    },
    {
      id: "system-1",
      role: "system",
      content: "Internal state.",
      createdAt: "2026-07-11T12:00:03.000Z",
    },
  ],
  events: [
    {
      id: "event-1",
      type: "examination-viewed",
      createdAt: "2026-07-11T12:00:04.000Z",
    },
    {
      id: "event-2",
      type: "finish-consultation",
      createdAt: "2026-07-11T12:00:05.000Z",
    },
    {
      id: "event-3",
      type: "mentor-feedback-generated",
      createdAt: "2026-07-11T12:00:06.000Z",
    },
  ],
  coveredChecklistItems: ["greeting", "greeting", "airway"],
});
assert(
  getEligibleLearnerMessages(evidenceInput).length === 1,
  "Mentor and system messages should be excluded from learner message evidence.",
);
assert(
  getContextualPatientMessages(evidenceInput).length === 1,
  "Patient messages should be retained as contextual messages.",
);
assert(
  getEligibleEncounterEvents(evidenceInput).length === 2,
  "Examination and workflow events should be eligible while mentor feedback is excluded.",
);
assert(
  evidenceInput.coveredChecklistItems.length === 2,
  "Covered checklist IDs should be deduplicated during normalization.",
);

const olderEvaluation = {
  ...baseEvaluation,
  status: "uncertain",
  confidence: 0.4,
  evidence: [
    {
      source: "student-message",
      messageId: "message-1",
      excerpt: "Do you have a fever?",
    },
  ],
  evaluatedAt: "2026-07-11T12:00:00.000Z",
};
const newerEvaluation = {
  ...baseEvaluation,
  status: "met",
  confidence: 0.95,
  evidence: [
    {
      source: "student-message",
      messageId: "message-1",
      excerpt: "Do you have a fever?",
    },
    {
      source: "student-message",
      messageId: "message-1",
      excerpt: "Do you have a fever?",
    },
  ],
  evaluatedAt: "2026-07-11T12:01:00.000Z",
};
const mergeResult = mergeFacultyCriterionEvaluations({
  caseId: "case-01",
  current: [olderEvaluation],
  incoming: [
    newerEvaluation,
    {
      ...baseEvaluation,
      criterionId: "C1-IG-999",
      evaluatedAt: "2026-07-11T12:02:00.000Z",
    },
    {
      ...baseEvaluation,
      confidence: 2,
      evaluatedAt: "2026-07-11T12:03:00.000Z",
    },
  ],
});
assert(
  mergeResult.evaluations.length === 1 &&
    mergeResult.evaluations[0].status === "met",
  "Merge should preserve the newest valid evaluation by criterion ID.",
);
assert(
  mergeResult.evaluations[0].evidence.length === 1,
  "Merge should deduplicate repeated evidence.",
);
assert(
  mergeResult.rejected.length >= 2,
  "Merge should reject unknown criteria and malformed incoming results.",
);

const deterministicMetResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-01",
  messages: [],
  events: [],
  coveredChecklistItems: ["systemic-symptoms", "clinical-3"],
});
assert(
  !deterministicMetResults.some(
    (evaluation) => evaluation.criterionId === "C1-IG-001",
  ),
  "Checklist coverage alone must not deterministically credit a learner question.",
);
assert(
  deterministicMetResults.every(
    (evaluation) => validateFacultyCriterionEvaluation(evaluation).valid,
  ),
  "Every deterministic result should pass Phase 3B-1 validation.",
);

const deterministicMissingResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-02",
  messages: [],
  events: [],
  coveredChecklistItems: [],
});
assert(
  !deterministicMissingResults.some(
    (evaluation) => evaluation.criterionId === "C2-IG-003",
  ),
  "History questions should remain unresolved for explicit learner-evidence evaluation.",
);
assert(
  !deterministicMissingResults.some(
    (evaluation) => evaluation.criterionId === "C2-CI-001",
  ),
  "Semantic urgency/interpretation criteria should be omitted in Phase 3B-2.",
);
assert(
  deterministicMissingResults.some(
    (evaluation) =>
      evaluation.criterionId === "C2-CF-001" &&
      evaluation.status === "not-applicable" &&
      evaluation.evaluationMethod === "case-state",
  ),
  "Expected-case-state criteria should return not-applicable case-state results.",
);
assert(
  !deterministicMissingResults.some(
    (evaluation) => evaluation.criterionId.includes("-CF-N"),
  ),
  "Neutral criteria should not produce learner-performance credit.",
);

const examinationResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-03",
  messages: [],
  events: [
    {
      id: "event-exam-1",
      type: "examination_viewed",
      createdAt: "2026-07-11T12:02:00.000Z",
      metadata: { examinationId: "examination-01" },
    },
  ],
  coveredChecklistItems: [],
});
assert(
  examinationResults.some(
    (evaluation) =>
      evaluation.criterionId === "C3-EX-001" &&
      evaluation.status === "met" &&
      evaluation.evidence.some(
        (item) =>
          item.source === "examination-event" &&
          item.eventId === "event-exam-1",
      ),
  ),
  "Specific examination-view events should produce valid deterministic evidence.",
);

const genericExaminationResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-03",
  messages: [],
  events: [
    {
      id: "event-exam-open",
      type: "examination_opened",
      createdAt: "2026-07-11T12:02:00.000Z",
    },
  ],
  coveredChecklistItems: [],
});
assert(
  genericExaminationResults.some(
    (evaluation) =>
      evaluation.criterionId === "C3-EX-001" &&
      evaluation.status === "not-met",
  ),
  "Generic examination opening should not satisfy a specific viewed-asset criterion.",
);

const malformedEventResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-04",
  messages: [],
  events: [
    {
      id: "event-malformed",
      type: "examination_viewed",
      createdAt: "2026-07-11T12:02:00.000Z",
      metadata: { examinationId: 123 },
    },
  ],
  coveredChecklistItems: ["biting-pain"],
});
assert(
  malformedEventResults.some(
      (evaluation) =>
        evaluation.criterionId === "C4-EX-001" &&
        evaluation.status === "not-met",
    ) &&
    !malformedEventResults.some(
      (evaluation) => evaluation.criterionId === "C4-IG-005",
    ),
  "Malformed examination metadata should be ignored and checklist coverage must not credit a learner question.",
);

assert(
  evaluateDeterministicFacultyCriteria({
    caseId: "unknown-case",
    messages: [],
    events: [],
    coveredChecklistItems: [],
  }).length === 0,
  "Unknown case IDs should be rejected safely by returning no deterministic results.",
);

const duplicateEvidenceResults = evaluateDeterministicFacultyCriteria({
  caseId: "case-05",
  messages: [],
  events: [
    {
      id: "event-exam-5",
      type: "examination_viewed",
      metadata: { examinationId: "examination-01" },
    },
    {
      id: "event-exam-5",
      type: "examination_viewed",
      metadata: { examinationId: "examination-01" },
    },
  ],
  coveredChecklistItems: [
    "thermal-sensitivity",
    "thermal-sensitivity",
    "clinical-2",
  ],
});
assert(
  !duplicateEvidenceResults.some(
    (evaluation) => evaluation.criterionId === "C5-IG-003",
  ),
  "Duplicate checklist coverage must not create deterministic learner-question evidence.",
);
const case05Exam = duplicateEvidenceResults.find(
  (evaluation) => evaluation.criterionId === "C5-EX-001",
);
assert(
  case05Exam?.evidence.length === 1,
  "Duplicate examination event evidence should be deduplicated.",
);

const deterministicCoverageReport =
  getDeterministicFacultyEvaluationCoverageReport();
assert(
  deterministicCoverageReport.length === 5 &&
    deterministicCoverageReport.every(
      (report) =>
        report.totalCriteria > 0 &&
        report.deterministicallyEvaluable > 0 &&
        report.examinationMappedCriteria.length === 1,
    ),
  "Development deterministic coverage report should include all five cases and examination mappings.",
);

const semanticMessages = [
  {
    id: "s-fever",
    role: "student",
    content: "Have you felt feverish or had chills?",
  },
  {
    id: "p-fever",
    role: "patient",
    content: "Yes, I have felt feverish.",
  },
  {
    id: "s-allergy",
    role: "student",
    content: "Are you allergic to penicillin or amoxicillin?",
  },
  {
    id: "p-allergy",
    role: "patient",
    content: "No, I do not think so.",
  },
  {
    id: "s-cold",
    role: "student",
    content: "Does cold make the pain worse, and does it linger after cold is gone?",
  },
  {
    id: "p-cold",
    role: "patient",
    content: "Yes, cold makes it worse and it lingers.",
  },
  {
    id: "s-biting",
    role: "student",
    content: "Does it hurt when I tap on it or when you bite down?",
  },
  {
    id: "p-biting",
    role: "patient",
    content: "Yes, biting hurts a lot.",
  },
  {
    id: "s-meds",
    role: "student",
    content: "What have you taken at home, like ibuprofen, Tylenol, or antibiotics?",
  },
  {
    id: "p-meds",
    role: "patient",
    content: "I took ibuprofen earlier.",
  },
  {
    id: "s-swallow",
    role: "student",
    content: "Are you having trouble swallowing?",
  },
  {
    id: "p-swallow",
    role: "patient",
    content: "Yes, swallowing is hard.",
  },
  {
    id: "s-emergency",
    role: "student",
    content: "This is an emergency because your airway could be at risk.",
  },
  {
    id: "s-antibiotics-education",
    role: "student",
    content: "Antibiotics will not fix the underlying tooth problem by themselves.",
  },
  {
    id: "s-drain",
    role: "student",
    content: "I can drain the abscess today to relieve pressure.",
  },
  {
    id: "s-save-tooth",
    role: "student",
    content: "Do you want to save this tooth if we can?",
  },
  {
    id: "s-pulpitis",
    role: "student",
    content: "This sounds like irreversible pulpitis.",
  },
  {
    id: "s-block",
    role: "student",
    content: "I recommend an inferior alveolar nerve block for this tooth.",
  },
];

const semanticEvidenceByCriterion = {
  "C1-IG-003": {
    status: "met",
    learnerEvidenceMessageIds: ["s-cold"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["Does cold make the pain worse"],
    rationale: "The learner asked a semantically equivalent cold-sensitivity question.",
  },
  "C1-IG-004": {
    status: "met",
    learnerEvidenceMessageIds: ["s-cold"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["does it linger after cold is gone"],
    rationale: "The learner asked whether cold pain lingers.",
  },
  "C1-IG-005": {
    status: "met",
    learnerEvidenceMessageIds: ["s-biting"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["when I tap on it or when you bite down"],
    rationale: "The learner asked about tapping and biting pain.",
  },
  "C1-CF-003": {
    status: "met",
    learnerEvidenceMessageIds: ["s-swallow"],
    contextualPatientMessageIds: ["p-swallow"],
    evidenceExcerpts: ["Are you having trouble swallowing?", "Yes, swallowing is hard."],
    rationale: "The learner investigated swallowing and the patient confirmed difficulty.",
  },
  "C1-CI-002": {
    status: "met",
    learnerEvidenceMessageIds: ["s-emergency"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["This is an emergency"],
    rationale: "The learner made an emergency-level clinical statement.",
  },
  "C2-PC-003": {
    status: "met",
    learnerEvidenceMessageIds: ["s-antibiotics-education"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["Antibiotics will not fix the underlying tooth problem"],
    rationale: "The learner explained antibiotics do not resolve the source.",
  },
  "C3-MP-001": {
    status: "met",
    learnerEvidenceMessageIds: ["s-drain"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["drain the abscess"],
    rationale: "The learner offered incision and drainage.",
  },
  "C4-PC-006": {
    status: "met",
    learnerEvidenceMessageIds: ["s-save-tooth"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["Do you want to save this tooth"],
    rationale: "The learner explored the patient's tooth-saving preference.",
  },
  "C5-CI-002": {
    status: "met",
    learnerEvidenceMessageIds: ["s-pulpitis"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["irreversible pulpitis"],
    rationale: "The learner stated the correct diagnosis.",
  },
  "C5-PD-001": {
    status: "met",
    learnerEvidenceMessageIds: ["s-block"],
    contextualPatientMessageIds: [],
    evidenceExcerpts: ["inferior alveolar nerve block"],
    rationale: "The learner recommended the mandibular block.",
  },
};

const mockSemanticGenerator = async (input) => {
  const context = JSON.parse(input.messages[0].content);

  return {
    text: JSON.stringify({
      results: context.requestedCriteria.map((criterion) => {
        const match = semanticEvidenceByCriterion[criterion.id];

        if (match) {
          return {
            criterionId: criterion.id,
            confidence: 0.92,
            ...match,
          };
        }

        return {
          criterionId: criterion.id,
          status: "not-met",
          confidence: 0.86,
          learnerEvidenceMessageIds: [],
          contextualPatientMessageIds: [],
          evidenceExcerpts: [],
          rationale: "No supplied learner evidence satisfied this criterion.",
        };
      }),
    }),
  };
};

const semanticCase1 = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-01",
    messages: semanticMessages,
    events: [],
    coveredChecklistItems: ["systemic-symptoms"],
  },
  generateText: mockSemanticGenerator,
  evaluatedAt: "2026-07-11T13:00:00.000Z",
});
assert(
  semanticCase1.semanticEvaluations.some(
    (evaluation) =>
      evaluation.criterionId === "C1-IG-003" &&
      evaluation.status === "met",
  ),
  "Semantic evaluator should credit semantically equivalent cold-pain questions.",
);
assert(
  semanticCase1.semanticEvaluations.some(
    (evaluation) =>
      evaluation.criterionId === "C1-CF-003" &&
      evaluation.status === "met" &&
      evaluation.evidence.some((item) => item.source === "student-message") &&
      evaluation.evidence.some((item) => item.source === "patient-response"),
  ),
  "Finding elicitation should cite both learner question and confirming patient response.",
);
assert(
  semanticCase1.requestedCriterionIds.includes("C1-IG-001"),
  "Fever criteria should require semantic review of explicit learner evidence.",
);
assert(
  !semanticCase1.mergedEvaluations.some(
    (evaluation) =>
      evaluation.criterionId === "C1-IG-001" &&
      evaluation.evaluationMethod === "deterministic",
  ),
  "Checklist coverage must not bypass explicit learner-evidence review.",
);

const patientOnlyFinding = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-01",
    messages: [
      {
        id: "p-only",
        role: "patient",
        content: "Yes, swallowing is hard.",
      },
    ],
    events: [],
    coveredChecklistItems: [],
  },
  generateText: async (input) => {
    const context = JSON.parse(input.messages[0].content);
    return {
      text: JSON.stringify({
        results: context.requestedCriteria.map((criterion) => ({
          criterionId: criterion.id,
          status: "not-met",
          confidence: 0.91,
          learnerEvidenceMessageIds: [],
          contextualPatientMessageIds: [],
          evidenceExcerpts: [],
          rationale:
            "Patient-only symptom text does not show learner elicitation.",
        })),
      }),
    };
  },
});
assert(
  patientOnlyFinding.semanticEvaluations.some(
    (evaluation) =>
      evaluation.criterionId === "C1-CF-003" &&
      evaluation.status === "not-met",
  ),
  "Patient response alone should not earn finding-elicitation credit.",
);

const semanticCase2 = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-02",
    messages: semanticMessages,
    events: [],
    coveredChecklistItems: [],
  },
  generateText: mockSemanticGenerator,
});
const semanticCase3 = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-03",
    messages: semanticMessages,
    events: [],
    coveredChecklistItems: [],
  },
  generateText: mockSemanticGenerator,
});
const semanticCase4 = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-04",
    messages: semanticMessages,
    events: [],
    coveredChecklistItems: [],
  },
  generateText: mockSemanticGenerator,
});
const semanticCase5 = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-05",
    messages: semanticMessages,
    events: [],
    coveredChecklistItems: [],
  },
  generateText: mockSemanticGenerator,
});
assert(
  semanticCase2.semanticEvaluations.some(
    (evaluation) =>
      evaluation.criterionId === "C2-PC-003" &&
      evaluation.status === "met",
  ) &&
    semanticCase3.semanticEvaluations.some(
      (evaluation) =>
        evaluation.criterionId === "C3-MP-001" &&
        evaluation.status === "met",
    ) &&
    semanticCase4.semanticEvaluations.some(
      (evaluation) =>
        evaluation.criterionId === "C4-PC-006" &&
        evaluation.status === "met",
    ) &&
    semanticCase5.semanticEvaluations.some(
      (evaluation) =>
        evaluation.criterionId === "C5-CI-002" &&
        evaluation.status === "met",
    ) &&
    semanticCase5.semanticEvaluations.some(
      (evaluation) =>
        evaluation.criterionId === "C5-PD-001" &&
        evaluation.status === "met",
    ),
  "Mocked semantic tests should cover education, management, shared decision-making, diagnosis, and procedure criteria across cases.",
);

const negationAndGenericMention = await evaluateSemanticFacultyCriteria({
  input: {
    caseId: "case-02",
    messages: [
      {
        id: "s-negation",
        role: "student",
        content:
          "This is not urgent, and there are antibiotics for infections generally.",
      },
    ],
    events: [],
    coveredChecklistItems: [],
  },
  generateText: async (input) => {
    const context = JSON.parse(input.messages[0].content);
    return {
      text: JSON.stringify({
        results: context.requestedCriteria.map((criterion) => ({
          criterionId: criterion.id,
          status: "not-met",
          confidence: 0.9,
          learnerEvidenceMessageIds: [],
          contextualPatientMessageIds: [],
          evidenceExcerpts: [],
          rationale:
            "Negated urgency and generic antibiotic mention do not satisfy the criterion.",
        })),
      }),
    };
  },
});
assert(
  negationAndGenericMention.semanticEvaluations.every(
    (evaluation) => evaluation.status !== "met",
  ),
  "Negation and generic topic mentions should not produce met semantic results.",
);

const hallucinatedCriterion = parseAndValidateAiFacultyEvaluationResponse({
  text: JSON.stringify({
    results: [
      {
        criterionId: "C1-DOES-NOT-EXIST",
        status: "met",
        confidence: 0.9,
        learnerEvidenceMessageIds: ["s-fever"],
        contextualPatientMessageIds: [],
        evidenceExcerpts: ["Have you felt feverish"],
        rationale: "Invalid criterion.",
      },
    ],
  }),
  requestedCriterionIds: ["C1-IG-003"],
  messages: semanticMessages,
});
assert(
  hallucinatedCriterion.success &&
    hallucinatedCriterion.results.length === 0 &&
    hallucinatedCriterion.issues.some(
      (issue) => issue.code === "unknown-ai-criterion-id",
    ),
  "Hallucinated semantic criterion IDs should be rejected.",
);
const inventedExcerpt = parseAndValidateAiFacultyEvaluationResponse({
  text: JSON.stringify({
    results: [
      {
        criterionId: "C1-IG-003",
        status: "met",
        confidence: 0.9,
        learnerEvidenceMessageIds: ["s-cold"],
        contextualPatientMessageIds: [],
        evidenceExcerpts: ["This quote was never supplied"],
        rationale: "Invented evidence.",
      },
    ],
  }),
  requestedCriterionIds: ["C1-IG-003"],
  messages: semanticMessages,
});
assert(
  inventedExcerpt.success &&
    inventedExcerpt.results.length === 0 &&
    inventedExcerpt.issues.some(
      (issue) => issue.code === "invented-ai-evidence-excerpt",
    ),
  "Invented semantic evidence excerpts should be rejected.",
);
assert(
  !parseAndValidateAiFacultyEvaluationResponse({
    text: "{not-json",
    requestedCriterionIds: ["C1-IG-003"],
    messages: semanticMessages,
  }).success,
  "Malformed semantic JSON should be rejected.",
);

const exchanges = buildFacultyConversationExchanges({
  caseId: "case-01",
  messages: semanticMessages,
  events: [],
  coveredChecklistItems: [],
});
assert(
  exchanges.some(
    (exchange) =>
      exchange.learnerMessage.id === "s-swallow" &&
      exchange.patientResponse?.id === "p-swallow",
  ),
  "Conversation exchange builder should pair learner questions with following patient responses.",
);

const semanticCoverageReport = getSemanticFacultyEvaluationCoverageReport();
assert(
  semanticCoverageReport.length === 5 &&
    semanticCoverageReport.every((report) => report.semanticCriteria > 0),
  "Semantic coverage report should include semantic criteria for all five cases.",
);

const baseRevisionInput = {
  conversationHistory: [
    {
      id: "msg-1",
      role: "student",
      text: "Do you have fever?",
      timestamp: "2026-07-11T12:00:00.000Z",
    },
    {
      id: "msg-2",
      role: "patient",
      text: "Yes.",
      timestamp: "2026-07-11T12:00:01.000Z",
    },
  ],
  encounterEvents: [
    {
      type: "examination_viewed",
      timestamp: "2026-07-11T12:00:02.000Z",
      payload: { examinationId: "examination-01" },
    },
  ],
  coveredChecklistItems: ["systemic-symptoms"],
};
const baseRevision = createFacultyRubricTranscriptRevision(baseRevisionInput);
assert(
  baseRevision !==
    createFacultyRubricTranscriptRevision({
      ...baseRevisionInput,
      conversationHistory: [
        ...baseRevisionInput.conversationHistory,
        {
          id: "msg-3",
          role: "student",
          text: "Any allergies?",
          timestamp: "2026-07-11T12:00:03.000Z",
        },
      ],
    }),
  "Transcript revision should change after relevant learner evidence changes.",
);
assert(
  baseRevision ===
    createFacultyRubricTranscriptRevision({
      ...baseRevisionInput,
      encounterEvents: [
        ...baseRevisionInput.encounterEvents,
        {
          type: "mentor_feedback_generated",
          timestamp: "2026-07-11T12:00:04.000Z",
          payload: { promptKey: "test" },
        },
      ],
    }),
  "Transcript revision should not change for mentor-only events.",
);
assert(
  baseRevision !==
    createFacultyRubricTranscriptRevision({
      ...baseRevisionInput,
      coveredChecklistItems: ["systemic-symptoms", "allergies"],
    }),
  "Transcript revision should change when covered checklist evidence changes.",
);

const orchestratedEvaluation = await evaluateFacultyRubricForEncounter({
  caseId: "case-01",
  ...baseRevisionInput,
  generateText: mockSemanticGenerator,
});
assert(
  orchestratedEvaluation.rubricVersion === FACULTY_RUBRIC_VERSION &&
    orchestratedEvaluation.transcriptRevision === baseRevision &&
    (orchestratedEvaluation.status === "complete" ||
      orchestratedEvaluation.status === "partial") &&
    orchestratedEvaluation.evaluations.length > 0,
  "Complete orchestration should return a versioned inactive evaluation state.",
);

const semanticFailureEvaluation = await evaluateFacultyRubricForEncounter({
  caseId: "case-01",
  ...baseRevisionInput,
  generateText: async () => {
    throw new Error("mock semantic failure");
  },
});
assert(
  semanticFailureEvaluation.status === "partial" &&
    semanticFailureEvaluation.evaluations.some(
      (evaluation) => evaluation.evaluationMethod === "deterministic",
    ),
  "Semantic failure should preserve deterministic results as a partial state.",
);

const unchangedEvaluation = await evaluateFacultyRubricForEncounter({
  caseId: "case-01",
  ...baseRevisionInput,
  existingState: orchestratedEvaluation,
  generateText: async () => {
    if (orchestratedEvaluation.status === "complete") {
      throw new Error("should not be called");
    }
    throw new Error("expected partial retry");
  },
});
assert(
  orchestratedEvaluation.status === "complete"
    ? unchangedEvaluation === orchestratedEvaluation
    : unchangedEvaluation !== orchestratedEvaluation &&
      unchangedEvaluation.status === "partial",
  "Only complete unchanged evaluations should be cached; partial evaluations must retry.",
);
assert(
  isFacultyRubricEvaluationStateStale(
    { ...orchestratedEvaluation, rubricVersion: "old-version" },
    baseRevision,
  ),
  "Outdated rubric versions should be detected as stale.",
);
assert(
  !isFacultyRubricEvaluationStateStale(orchestratedEvaluation, baseRevision),
  "Current rubric version and transcript revision should not be stale.",
);

const snapshotRoundTrip = JSON.parse(
  JSON.stringify({
    caseId: "case-01",
    conversationHistory: baseRevisionInput.conversationHistory,
    coveredFacts: [],
    coveredChecklistItems: baseRevisionInput.coveredChecklistItems,
    encounterEvents: baseRevisionInput.encounterEvents,
    examinationsViewed: ["examination-01"],
    savedAt: "2026-07-11T12:00:05.000Z",
    lifecycleStatus: "paused",
    facultyRubricEvaluation: orchestratedEvaluation,
  }),
);
assert(
  snapshotRoundTrip.facultyRubricEvaluation?.transcriptRevision === baseRevision,
  "Pause snapshot round-trip should preserve faculty rubric evaluation state.",
);
const summaryRoundTrip = JSON.parse(
  JSON.stringify({
    caseId: "case-01",
    conversationHistory: baseRevisionInput.conversationHistory,
    coveredFacts: [],
    coveredChecklistItems: baseRevisionInput.coveredChecklistItems,
    encounterEvents: baseRevisionInput.encounterEvents,
    examinationsViewed: ["examination-01"],
    savedAt: "2026-07-11T12:00:05.000Z",
    lifecycleStatus: "completed",
    facultyRubricEvaluation: orchestratedEvaluation,
  }),
);
assert(
  summaryRoundTrip.facultyRubricEvaluation?.rubricVersion ===
    FACULTY_RUBRIC_VERSION,
  "Completed summary round-trip should preserve faculty rubric evaluation state.",
);
assert(
  JSON.parse(
    JSON.stringify({
      caseId: "case-01",
      conversationHistory: [],
      coveredFacts: [],
      coveredChecklistItems: [],
      encounterEvents: [],
      examinationsViewed: [],
      savedAt: "2026-07-11T12:00:05.000Z",
    }),
  ).facultyRubricEvaluation === undefined,
  "Legacy summaries without evaluation data should remain readable.",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: facultyRubrics.length,
      criteria: allCriteria.length,
      provisionalWeights: provisionalWeights.length,
      neutralCriteria: neutralCriteria.length,
      scoringVersion: FACULTY_RUBRIC_SCORING_VERSION,
      deterministicCoverage: deterministicCoverageReport,
      semanticCoverage: semanticCoverageReport,
      calibration: calibrationReport.map((caseReport) => ({
        caseId: caseReport.caseId,
        totalConfiguredScoredWeight: caseReport.totalConfiguredScoredWeight,
        totalProvisionalWeight: caseReport.totalProvisionalWeight,
        competencyTotals: caseReport.competencyTotals,
        criticalCriteria: caseReport.criticalCriteria,
        unsupportedCriteria: caseReport.unsupportedCriteria,
        expectedMaximumScore: caseReport.expectedMaximumScore,
        singleMissEffects: caseReport.singleMissEffects,
        criticalMissEffects: caseReport.criticalMissEffects,
        legacyEmptyScore: caseReport.legacyEmptyScore,
        criteria: caseReport.criteria,
      })),
      activationPolicy: DEFAULT_FACULTY_RUBRIC_ACTIVATION_POLICY,
      coveragePolicy: DEFAULT_EVALUATION_COVERAGE_POLICY,
      finalPolicy: FINAL_FACULTY_RUBRIC_POLICY,
      scenarios: scenarioResults.map((result) => ({
        caseId: result.caseId,
        scenario: result.scenario,
        percentage: result.score.percentage,
        rawPercentage: result.score.rawPercentage,
        passStatus: result.score.passStatus,
        metCount: result.score.metCount,
        notMetCount: result.score.notMetCount,
        uncertainCount: result.score.uncertainCount,
        coverage: result.score.evaluationCoveragePercentage,
        safetyStatus: result.score.safetyStatus,
        readiness: result.activationReadiness,
        directPercentage: result.weightingComparison.directPercentage,
        competencyBalancedPercentage:
          result.weightingComparison.competencyBalancedPercentage,
        policyProjections: result.criticalPolicyProjections,
      })),
    },
    null,
    2,
  ),
);
