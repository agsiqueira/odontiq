"use client";

import { useMemo, useState } from "react";

import { evaluateEncounter } from "@/lib/checklistEvaluation";
import { facultyRubrics } from "@/lib/facultyRubric/caseRubrics";
import type { FacultyRubricCriterion } from "@/lib/facultyRubric/types";
import {
  getAllResolvedFacultyRubricCalibration,
  getFacultyRubricActivationReadiness,
  getFacultyRubricScenarioResults,
  getResolvedFacultyRubricCalibration,
  type ResolvedFacultyCriterionCalibration,
} from "@/lib/facultyRubric/calibration";
import {
  getFacultyRubricCriterionStatusDisplay,
  scoreFacultyRubricEvaluations,
  type FacultyRubricScore,
} from "@/lib/facultyRubric/scoring";
import {
  ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
  readCompletedEncounterStore,
  writeCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
  type LocalEncounterSnapshot,
} from "@/lib/localEncounter";
import type {
  FacultyCriterionEvaluation,
  FacultyCriterionEvaluationMethod,
  FacultyCriterionStatus,
} from "@/lib/facultyRubric/evaluation/types";
import type { FacultyRubricEvaluationState } from "@/lib/facultyRubric/evaluation/state";

type StoredEncounter =
  | {
      kind: "snapshot";
      label: string;
      encounter: LocalEncounterSnapshot;
    }
  | {
      kind: "completed";
      label: string;
      encounter: CompletedEncounterAttempt;
    };

type InspectorFilter =
  | "all"
  | FacultyCriterionStatus
  | FacultyCriterionEvaluationMethod;

type CalibrationFilter =
  | "all"
  | "provisional"
  | "critical"
  | "unsupported"
  | "faculty-review-required";

type RefreshResponse =
  | {
      success: true;
      state: FacultyRubricEvaluationState;
    }
  | {
      success: false;
      error?: string;
    };

const filters: Array<{ value: InspectorFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "met", label: "Met" },
  { value: "not-met", label: "Not met" },
  { value: "uncertain", label: "Uncertain" },
  { value: "not-applicable", label: "Not applicable" },
  { value: "deterministic", label: "Deterministic" },
  { value: "ai-semantic", label: "AI semantic" },
];

const calibrationFilters: Array<{ value: CalibrationFilter; label: string }> = [
  { value: "all", label: "All calibration rows" },
  { value: "provisional", label: "Provisional weights" },
  { value: "critical", label: "Critical criteria" },
  { value: "unsupported", label: "Unsupported criteria" },
  { value: "faculty-review-required", label: "Faculty review required" },
];

export function FacultyRubricInspectorClient() {
  const [encounters, setEncounters] = useState<StoredEncounter[]>(() =>
    typeof window === "undefined" ? [] : readStoredEncounters(),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState<InspectorFilter>("all");
  const [calibrationFilter, setCalibrationFilter] =
    useState<CalibrationFilter>("all");
  const [calibrationCaseFilter, setCalibrationCaseFilter] = useState("all");
  const [calibrationCompetencyFilter, setCalibrationCompetencyFilter] =
    useState("all");
  const [refreshState, setRefreshState] = useState<
    "idle" | "pending" | "success" | "partial" | "failed"
  >("idle");
  const [error, setError] = useState<string>();

  const selectedEncounter = encounters[selectedIndex];
  const evaluation = selectedEncounter?.encounter.facultyRubricEvaluation;
  const rubric = facultyRubrics.find(
    (candidate) => candidate.caseId === selectedEncounter?.encounter.caseId,
  );
  const criteriaById = useMemo(
    () =>
      new Map(
        rubric?.criteria.map((criterion) => [criterion.id, criterion]) ?? [],
      ),
    [rubric],
  );
  const filteredEvaluations = useMemo(
    () =>
      (evaluation?.evaluations ?? []).filter((item) => {
        if (filter === "all") {
          return true;
        }

        return item.status === filter || item.evaluationMethod === filter;
      }),
    [evaluation?.evaluations, filter],
  );
  const proposedScore = useMemo(
    () =>
      evaluation && selectedEncounter
        ? scoreFacultyRubricEvaluations({
            caseId: selectedEncounter.encounter.caseId,
            evaluations: evaluation.evaluations,
          })
        : undefined,
    [evaluation, selectedEncounter],
  );
  const legacyScore = selectedEncounter
    ? evaluateEncounter({
        caseId: selectedEncounter.encounter.caseId,
        coveredChecklistItems: selectedEncounter.encounter.coveredChecklistItems,
      })
    : undefined;
  const calibrationRows = useMemo(() => getAllResolvedFacultyRubricCalibration(), []);
  const filteredCalibrationRows = useMemo(
    () =>
      calibrationRows.filter((row) => {
        if (
          calibrationCaseFilter !== "all" &&
          row.caseId !== calibrationCaseFilter
        ) {
          return false;
        }

        if (
          calibrationCompetencyFilter !== "all" &&
          row.competency !== calibrationCompetencyFilter
        ) {
          return false;
        }

        if (calibrationFilter === "provisional") {
          return row.provisionalWeight;
        }

        if (calibrationFilter === "critical") {
          return row.critical;
        }

        if (calibrationFilter === "unsupported") {
          return !row.supported;
        }

        if (calibrationFilter === "faculty-review-required") {
          return row.facultyDecisionRequired;
        }

        return true;
      }),
    [
      calibrationCaseFilter,
      calibrationCompetencyFilter,
      calibrationFilter,
      calibrationRows,
    ],
  );
  const scenarioResults = useMemo(() => getFacultyRubricScenarioResults(), []);

  async function refreshEvaluation() {
    if (!selectedEncounter || refreshState === "pending") {
      return;
    }

    setRefreshState("pending");
    setError(undefined);

    try {
      const response = await fetch("/api/faculty-rubric/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: selectedEncounter.encounter.caseId,
          conversationHistory: selectedEncounter.encounter.conversationHistory,
          encounterEvents: selectedEncounter.encounter.encounterEvents,
          coveredChecklistItems:
            selectedEncounter.encounter.coveredChecklistItems,
          existingState: selectedEncounter.encounter.facultyRubricEvaluation,
          forceRefresh: true,
        }),
      });
      const payload = (await response.json()) as RefreshResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "request_failed" : payload.error);
      }

      writeEvaluationState(selectedEncounter, payload.state);
      setEncounters(readStoredEncounters());
      setRefreshState(
        payload.state.status === "failed"
          ? "failed"
          : payload.state.status === "partial"
            ? "partial"
            : "success",
      );
    } catch (refreshError) {
      setRefreshState("failed");
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Evaluation refresh failed.",
      );
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-5 py-6 text-[var(--color-text-primary)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
            Development
          </p>
          <h1 className="text-2xl font-semibold">Faculty Rubric Inspector</h1>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium">
              Encounter
              <select
                className="rounded-xl border border-slate-200 px-3 py-2"
                value={selectedIndex}
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
              >
                {encounters.map((encounter, index) => (
                  <option key={`${encounter.kind}-${encounter.encounter.caseId}`} value={index}>
                    {encounter.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!selectedEncounter || refreshState === "pending"}
              onClick={refreshEvaluation}
            >
              {refreshState === "pending" ? "Refreshing..." : "Refresh Evaluation"}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </section>

        {selectedEncounter ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <Metric label="Case ID" value={selectedEncounter.encounter.caseId} />
              <Metric
                label="Rubric version"
                value={evaluation?.rubricVersion ?? "No evaluation stored"}
              />
              <Metric
                label="Transcript revision"
                value={evaluation?.transcriptRevision ?? "No evaluation stored"}
              />
              <Metric label="Status" value={evaluation?.status ?? "not-started"} />
              <Metric label="Evaluated at" value={evaluation?.evaluatedAt ?? "-"} />
              <Metric
                label="Last attempted"
                value={evaluation?.lastAttemptedAt ?? "-"}
              />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
            No local encounter snapshots or completed encounters were found.
          </section>
        )}

        {evaluation ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            {proposedScore && legacyScore ? (
              <ScoreComparison
                legacyOverall={legacyScore.overall}
                proposedScore={proposedScore}
                readiness={getFacultyRubricActivationReadiness({
                  score: proposedScore,
                  calibration: getResolvedFacultyRubricCalibration(
                    proposedScore.caseId,
                  ),
                })}
              />
            ) : null}
            <div className="mb-4 flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    filter === item.value
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Criterion</th>
                    <th className="py-2 pr-3">Mode</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Weight</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Evidence</th>
                    <th className="py-2 pr-3">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluations.map((item) => (
                    <EvaluationRow
                      key={item.criterionId}
                      evaluation={item}
                      criterion={criteriaById.get(item.criterionId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <CalibrationReview
          rows={filteredCalibrationRows}
          allRows={calibrationRows}
          caseFilter={calibrationCaseFilter}
          competencyFilter={calibrationCompetencyFilter}
          filter={calibrationFilter}
          onCaseFilterChange={setCalibrationCaseFilter}
          onCompetencyFilterChange={setCalibrationCompetencyFilter}
          onFilterChange={setCalibrationFilter}
          scenarioResults={scenarioResults}
        />
      </div>
    </main>
  );
}

function ScoreComparison({
  legacyOverall,
  proposedScore,
  readiness,
}: {
  legacyOverall: number;
  proposedScore: FacultyRubricScore;
  readiness: string;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-dashed border-[var(--color-primary)]/50 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
        Proposed faculty-rubric grading - not active
      </p>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
        <Metric label="Legacy overall" value={`${legacyOverall}%`} />
        <Metric
          label="Proposed overall"
          value={
            proposedScore.percentage === null
              ? "Unavailable"
              : `${proposedScore.percentage}%`
          }
        />
        <Metric
          label="Evaluation coverage"
          value={`${proposedScore.evaluationCoveragePercentage}%`}
        />
        <Metric
          label="Pass threshold"
          value={`${proposedScore.passingScorePercentage}%`}
        />
        <Metric label="Pass status" value={proposedScore.passStatus} />
        <Metric label="Safety status" value={proposedScore.safetyStatus} />
        <Metric label="Scoring status" value={proposedScore.status} />
        <Metric label="Activation readiness" value={readiness} />
        <Metric label="Met count" value={String(proposedScore.metCount)} />
        <Metric label="Not met count" value={String(proposedScore.notMetCount)} />
        <Metric
          label="Uncertain count"
          value={String(proposedScore.uncertainCount)}
        />
        <Metric
          label="Supported scored items"
          value={String(proposedScore.supportedScoredCriterionCount)}
        />
        <Metric
          label="Critical misses"
          value={proposedScore.criticalMissCriterionIds.join(", ") || "-"}
        />
        <Metric
          label="Critical uncertain"
          value={proposedScore.criticalUncertainCriterionIds.join(", ") || "-"}
        />
        <Metric
          label="Uncertain"
          value={proposedScore.uncertainCriterionIds.join(", ") || "-"}
        />
        <Metric
          label="Unsupported"
          value={proposedScore.unsupportedCriterionIds.join(", ") || "-"}
        />
        <Metric
          label="Technical errors"
          value={proposedScore.technicalValidationErrors.join(", ") || "-"}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Competency</th>
              <th className="py-2 pr-3">Earned</th>
              <th className="py-2 pr-3">Possible</th>
              <th className="py-2 pr-3">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {proposedScore.competencies.map((competency) => (
              <tr key={competency.competency} className="border-b">
                <td className="py-2 pr-3">{competency.competency}</td>
                <td className="py-2 pr-3">{competency.earnedPoints}</td>
                <td className="py-2 pr-3">{competency.possiblePoints}</td>
                <td className="py-2 pr-3">
                  {competency.percentage === null
                    ? "Unavailable"
                    : `${competency.percentage}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalibrationReview({
  rows,
  allRows,
  caseFilter,
  competencyFilter,
  filter,
  onCaseFilterChange,
  onCompetencyFilterChange,
  onFilterChange,
  scenarioResults,
}: {
  rows: ResolvedFacultyCriterionCalibration[];
  allRows: ResolvedFacultyCriterionCalibration[];
  caseFilter: string;
  competencyFilter: string;
  filter: CalibrationFilter;
  onCaseFilterChange: (value: string) => void;
  onCompetencyFilterChange: (value: string) => void;
  onFilterChange: (value: CalibrationFilter) => void;
  scenarioResults: ReturnType<typeof getFacultyRubricScenarioResults>;
}) {
  const caseIds = Array.from(new Set(allRows.map((row) => row.caseId)));
  const competencies = Array.from(new Set(allRows.map((row) => row.competency)));

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            Faculty calibration review
          </p>
          <h2 className="text-lg font-semibold">
            Calibration and activation policy - inactive
          </h2>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <label className="flex flex-col gap-1">
            Case
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={caseFilter}
              onChange={(event) => onCaseFilterChange(event.target.value)}
            >
              <option value="all">All cases</option>
              {caseIds.map((caseId) => (
                <option key={caseId} value={caseId}>
                  {caseId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Competency
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={competencyFilter}
              onChange={(event) =>
                onCompetencyFilterChange(event.target.value)
              }
            >
              <option value="all">All competencies</option>
              {competencies.map((competency) => (
                <option key={competency} value={competency}>
                  {competency}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Review filter
            <select
              className="rounded-xl border border-slate-200 px-3 py-2"
              value={filter}
              onChange={(event) =>
                onFilterChange(event.target.value as CalibrationFilter)
              }
            >
              {calibrationFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-5 grid gap-3 text-sm md:grid-cols-4">
        <Metric label="Rows shown" value={String(rows.length)} />
        <Metric
          label="Provisional rows"
          value={String(allRows.filter((row) => row.provisionalWeight).length)}
        />
        <Metric
          label="Unsupported"
          value={String(allRows.filter((row) => !row.supported).length)}
        />
        <Metric
          label="Faculty review"
          value={String(
            allRows.filter((row) => row.facultyDecisionRequired).length,
          )}
        />
      </div>

      <div className="mb-5 overflow-x-auto">
        <table className="w-full min-w-[96rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Case</th>
              <th className="py-2 pr-3">Criterion</th>
              <th className="py-2 pr-3">Competency</th>
              <th className="py-2 pr-3">Weight</th>
              <th className="py-2 pr-3">Active score weight</th>
              <th className="py-2 pr-3">Weight source</th>
              <th className="py-2 pr-3">Critical</th>
              <th className="py-2 pr-3">Critical source</th>
              <th className="py-2 pr-3">Supported</th>
              <th className="py-2 pr-3">Mode</th>
              <th className="py-2 pr-3">Legacy mapping</th>
              <th className="py-2 pr-3">Review</th>
              <th className="py-2 pr-3">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.caseId}-${row.criterionId}`} className="border-b align-top">
                <td className="py-2 pr-3">{row.caseId}</td>
                <td className="py-2 pr-3">
                  <p className="font-semibold">{row.criterionId}</p>
                  <p>{row.title}</p>
                </td>
                <td className="py-2 pr-3">{row.competency}</td>
                <td className="py-2 pr-3">
                  original {row.currentWeight}
                  <br />
                  proposed {row.proposedWeight}
                  {row.provisionalWeight ? " provisional" : ""}
                </td>
                <td className="py-2 pr-3">{row.activeScoreWeight}</td>
                <td className="py-2 pr-3">{row.weightSource}</td>
                <td className="py-2 pr-3">{row.critical ? "yes" : "no"}</td>
                <td className="py-2 pr-3">{row.criticalSource}</td>
                <td className="py-2 pr-3">{row.supported ? "yes" : "no"}</td>
                <td className="py-2 pr-3">{row.evaluationMode}</td>
                <td className="py-2 pr-3">{row.legacyMapping ?? "-"}</td>
                <td className="py-2 pr-3">
                  {row.facultyDecisionRequired ? "required" : "-"}
                </td>
                <td className="py-2 pr-3">{row.supportRationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ScenarioSummary scenarioResults={scenarioResults} />
    </section>
  );
}

function ScenarioSummary({
  scenarioResults,
}: {
  scenarioResults: ReturnType<typeof getFacultyRubricScenarioResults>;
}) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">Inactive scenario results</p>
      <table className="w-full min-w-[72rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">Case</th>
            <th className="py-2 pr-3">Scenario</th>
            <th className="py-2 pr-3">Direct score</th>
            <th className="py-2 pr-3">Pass status</th>
            <th className="py-2 pr-3">Balanced score</th>
            <th className="py-2 pr-3">Coverage</th>
            <th className="py-2 pr-3">Safety</th>
            <th className="py-2 pr-3">Readiness</th>
          </tr>
        </thead>
        <tbody>
          {scenarioResults.map((result) => (
            <tr key={`${result.caseId}-${result.scenario}`} className="border-b">
              <td className="py-2 pr-3">{result.caseId}</td>
              <td className="py-2 pr-3">{result.scenario}</td>
              <td className="py-2 pr-3">
                {formatPercentage(result.score.percentage)}
              </td>
              <td className="py-2 pr-3">{result.score.passStatus}</td>
              <td className="py-2 pr-3">
                {formatPercentage(
                  result.weightingComparison.competencyBalancedPercentage,
                )}
              </td>
              <td className="py-2 pr-3">
                {result.score.evaluationCoveragePercentage}%
              </td>
              <td className="py-2 pr-3">{result.score.safetyStatus}</td>
              <td className="py-2 pr-3">{result.activationReadiness}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="break-all font-medium">{value}</p>
    </div>
  );
}

function EvaluationRow({
  evaluation,
  criterion,
}: {
  evaluation: FacultyCriterionEvaluation;
  criterion?: FacultyRubricCriterion;
}) {
  return (
    <tr
      className={`border-b align-top ${
        evaluation.status === "uncertain" ? "bg-amber-50" : ""
      }`}
    >
      <td className="py-3 pr-3">
        <p className="font-semibold">{evaluation.criterionId}</p>
        <p>{criterion?.title ?? "Unknown criterion"}</p>
        <p className="text-xs text-slate-500">
          {criterion?.competency ?? "-"}
          {criterion?.critical ? " | critical" : ""}
          {criterion?.provisionalWeight ? " | provisional" : ""}
          {criterion?.weight === 0 ? " | non-scoring" : ""}
        </p>
      </td>
      <td className="py-3 pr-3">{criterion?.evaluationMode ?? "-"}</td>
      <td className="py-3 pr-3">
        {getFacultyRubricCriterionStatusDisplay(evaluation.status).label}
      </td>
      <td className="py-3 pr-3">
        original {criterion ? criterion.weight : "-"}
        <br />
        active 1
        <br />
        {criterion?.provisionalWeight ? " provisional" : ""}
      </td>
      <td className="py-3 pr-3">{evaluation.confidence.toFixed(2)}</td>
      <td className="py-3 pr-3">{evaluation.evaluationMethod}</td>
      <td className="py-3 pr-3">
        {evaluation.evidence.map((evidence, index) => (
          <p key={`${evidence.source}-${index}`} className="mb-1">
            <span className="font-medium">{evidence.source}</span>{" "}
            {evidence.messageId ?? evidence.eventId ?? ""}
            {evidence.excerpt ? `: ${evidence.excerpt}` : ""}
          </p>
        ))}
      </td>
      <td className="py-3 pr-3">{evaluation.rationale}</td>
    </tr>
  );
}

function formatPercentage(value: number | null) {
  return value === null ? "Unavailable" : `${value}%`;
}

function readStoredEncounters(): StoredEncounter[] {
  const encounters: StoredEncounter[] = [];
  const snapshots = readJson<Record<string, LocalEncounterSnapshot>>(
    ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
  );
  const completed = Object.values(readCompletedEncounterStore()).flat();

  if (snapshots) {
    encounters.push(
      ...Object.values(snapshots).map((snapshot) => ({
        kind: "snapshot" as const,
        label: `${snapshot.caseId} (${snapshot.lifecycleStatus})`,
        encounter: snapshot,
      })),
    );
  }

  if (completed.length) {
    encounters.push(...completed.map((attempt) => ({
      kind: "completed",
      label: `${attempt.caseId} (completed ${attempt.attemptId})`,
      encounter: attempt,
    } as const)));
  }

  return encounters;
}

function writeEvaluationState(
  selectedEncounter: StoredEncounter,
  state: FacultyRubricEvaluationState,
) {
  if (selectedEncounter.kind === "completed") {
    writeCompletedEncounterAttempt({
        ...selectedEncounter.encounter,
        facultyRubricEvaluation: state,
      });
    return;
  }

  const snapshots =
    readJson<Record<string, LocalEncounterSnapshot>>(
      ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
    ) ?? {};
  snapshots[selectedEncounter.encounter.caseId] = {
    ...selectedEncounter.encounter,
    facultyRubricEvaluation: state,
  };
  window.localStorage.setItem(
    ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
    JSON.stringify(snapshots),
  );
}

function readJson<T>(key: string): T | null {
  const value = window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
