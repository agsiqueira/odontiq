"use client";

import { useState } from "react";

import {
  buildFacultyReport,
  type BuildFacultyReportInput,
  type FacultyReport,
  type FacultyReportCompetencySummary,
  type FacultyReportCriterionResult,
  type FacultyReportEvaluation,
  type FacultyReportRubric,
} from "@/lib/facultyRubric/report";

type StoredFacultyReportCandidate = {
  storageKey: string;
  updatedAt?: string;
  caseTitle?: string;
  legacyScore?: number | null;
  rubric: FacultyReportRubric;
  completedEvaluations: FacultyReportEvaluation[];
  score: BuildFacultyReportInput["score"];
};

type PreviewState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "incompatible"; message: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      candidate: StoredFacultyReportCandidate;
      report: FacultyReport;
    };

const FACULTY_REPORT_STORAGE_MARKERS = [
  "facultyRubric",
  "faculty-rubric",
  "facultyEvaluation",
  "facultyScore",
  "rubricVersion",
];

const CANONICAL_COMPLETED_SUMMARY_KEYS = [
  "odontiq:completed-encounters",
  "odontiq.completedEncounters",
  "odontiq.completedEncounterSummaries",
  "completedEncounterSummaries",
];

const CURRENT_SCORING_VERSION = "faculty-rubric-scoring-3c-3-v1";

export function FacultyReportPreviewClient() {
  const [state] = useState<PreviewState>(() => loadLatestFacultyReportPreview());

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          Loading faculty report preview...
        </div>
      </main>
    );
  }

  if (state.status === "empty") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Development preview - not active
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Faculty Report Preview</h1>
          <p className="mt-4 text-slate-700">No completed faculty-rubric report data is available.</p>
        </div>
      </main>
    );
  }

  if (state.status === "incompatible") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">Development preview - not active</p>
          <h1 className="mt-2 text-2xl font-semibold">Faculty Report Preview</h1>
          <p className="mt-4">{state.message}</p>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide">Development preview - not active</p>
          <h1 className="mt-2 text-2xl font-semibold">Faculty Report Preview</h1>
          <p className="mt-4">{state.message}</p>
        </div>
      </main>
    );
  }

  return <FacultyReportPreview report={state.report} candidate={state.candidate} />;
}

function FacultyReportPreview({
  report,
  candidate,
}: {
  report: FacultyReport;
  candidate: StoredFacultyReportCandidate;
}) {
  const proposedScore = formatPercentage(report.overallScore.percentage);
  const criticalItems = report.criticalSafetyItems.filter((item) => item.status !== "met");
  const statusTone = getOverallTone(report.passStatus);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Development preview - not active
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{candidate.caseTitle ?? report.caseId}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Source: <span className="font-mono">{candidate.storageKey}</span>
                {candidate.updatedAt ? ` | Last updated ${formatDate(candidate.updatedAt)}` : ""}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <StatusPill label={`Proposed score: ${proposedScore}`} tone={statusTone} />
              <StatusPill label="Pass threshold: 84%" tone="neutral" />
              <StatusPill label={report.overallResult.label} tone={statusTone} />
            </div>
          </div>
          {candidate.legacyScore !== undefined && candidate.legacyScore !== null ? (
            <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Legacy score: {formatPercentage(candidate.legacyScore)} | Faculty-rubric proposed score:{" "}
              {proposedScore} (inactive)
            </p>
          ) : null}
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Overall Summary</h2>
          <p className="mt-3 text-slate-700">{report.overallResult.message}</p>
          {report.uncertaintySummary.message ? (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">Uncertain criteria present</p>
              <p className="mt-1">{report.uncertaintySummary.message}</p>
              <p className="mt-1">
                Count: {report.uncertaintySummary.uncertainItemCount}
                {report.uncertaintySummary.hasCriticalUncertainItems ? " | Includes critical uncertainty" : ""}
              </p>
            </div>
          ) : null}
          {report.criticalSafetySummary.message ? (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950">
              <p className="font-semibold">Critical safety warning</p>
              <p className="mt-1">{report.criticalSafetySummary.message}</p>
              <p className="mt-1">Warning-only policy; this does not imply automatic failure.</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Competency Summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.competencyScores.map((competency) => (
              <CompetencyCard key={competency.competencyId} competency={competency} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Strengths</h2>
          <ReportList
            emptyText="No deterministic strengths were generated."
            items={report.strengths.map((strength) => ({
              id: strength.criterionId,
              title: strength.title,
              meta: `${strength.competency}${isCriticalCriterion(report, strength.criterionId) ? " | Critical" : ""}`,
              tone: "positive",
            }))}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Areas for Improvement</h2>
          <ReportList
            emptyText="No deterministic improvement areas were generated."
            items={report.improvementAreas.map((improvement) => ({
              id: improvement.criterionId,
              title: improvement.title,
              meta: `${improvement.competency} | ${
                improvement.status === "uncertain" ? "Uncertain - No credit awarded" : "Not Met"
              }`,
              tone: improvement.status === "uncertain" ? "warning" : "negative",
            }))}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Critical Safety Items</h2>
          <ReportList
            emptyText="No critical safety warnings were generated."
            items={criticalItems.map((item) => ({
              id: item.criterion.criterionId,
              title: item.criterion.title,
              meta: item.status === "uncertain" ? "Critical uncertain - no credit awarded" : "Critical not met",
              tone: item.status === "uncertain" ? "warning" : "negative",
            }))}
          />
        </section>

        <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-xl font-semibold">
            Complete Criterion Results
          </summary>
          <CriterionTable criteria={report.criterionResults} />
        </details>
      </div>
    </main>
  );
}

function CompetencyCard({ competency }: { competency: FacultyReportCompetencySummary }) {
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{competency.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {competency.earnedPoints}/{competency.possiblePoints} points |{" "}
            {formatPercentage(competency.displayPercentage)}
          </p>
        </div>
        <StatusPill label={formatStatusLabel(competency.statusLabel)} tone={getCompetencyTone(competency.statusLabel)} />
      </div>
      <p className="mt-3 text-sm text-slate-700">{competency.summaryMessage}</p>
      <p className="mt-2 text-xs text-slate-500">
        Met: {competency.metCount} | Not met: {competency.notMetCount} | Uncertain:{" "}
        {competency.uncertainCount} | Critical misses: {competency.criticalMissCount} | Critical uncertain:{" "}
        {competency.criticalUncertainCount}
      </p>
    </article>
  );
}

function ReportList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: Array<{ id: string; title: string; meta: string; tone: StatusTone }>;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">{emptyText}</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-slate-500">{item.id}</p>
          </div>
          <StatusPill label={item.meta} tone={item.tone} />
        </li>
      ))}
    </ul>
  );
}

function CriterionTable({ criteria }: { criteria: FacultyReportCriterionResult[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Criterion ID</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Competency</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Weight</th>
            <th className="px-3 py-2">Earned</th>
            <th className="px-3 py-2">Critical</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((criterion) => (
            <tr key={criterion.criterionId} className="border-b border-slate-100 align-top">
              <td className="px-3 py-2 font-mono text-xs">{criterion.criterionId}</td>
              <td className="px-3 py-2">{criterion.title}</td>
              <td className="px-3 py-2">{criterion.competency}</td>
              <td className="px-3 py-2">{formatCriterionStatus(criterion.status)}</td>
              <td className="px-3 py-2">{criterion.score?.activeScoreWeight ?? criterion.score?.weight ?? "-"}</td>
              <td className="px-3 py-2">{criterion.score?.earnedPoints ?? "-"}</td>
              <td className="px-3 py-2">{criterion.critical ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{getEvaluationMetadata(criterion, "confidence")}</td>
              <td className="px-3 py-2">{getEvaluationMetadata(criterion, "evaluationMethod")}</td>
              <td className="px-3 py-2">{formatEvidence(criterion)}</td>
              <td className="px-3 py-2">{criterion.rationale ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type StatusTone = "positive" | "negative" | "warning" | "neutral";

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const className = {
    positive: "border-emerald-300 bg-emerald-50 text-emerald-900",
    negative: "border-red-300 bg-red-50 text-red-900",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    neutral: "border-slate-300 bg-slate-100 text-slate-800",
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

export function loadLatestFacultyReportPreview(): PreviewState {
  if (typeof window === "undefined") {
    return { status: "empty" };
  }

  const canonicalResult = loadFromCanonicalCompletedSummaryKeys();
  if (canonicalResult.status !== "empty") {
    return canonicalResult;
  }

  const candidates: StoredFacultyReportCandidate[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey) {
      continue;
    }

    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue || !mightContainFacultyReportData(storageKey, rawValue)) {
      continue;
    }

    const parsed = safeParseJson(rawValue);
    if (!parsed) {
      continue;
    }

    const candidate = extractFacultyReportCandidate(storageKey, parsed);
    if (candidate && getCandidateCompatibility(candidate) === "compatible") {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return { status: "empty" };
  }

  const latestCandidate = candidates.sort(compareCandidatesByUpdatedAt)[0];
  if (!latestCandidate) {
    return { status: "empty" };
  }

  try {
    const report = buildFacultyReport({
      rubric: latestCandidate.rubric,
      completedEvaluations: latestCandidate.completedEvaluations,
      score: latestCandidate.score,
    });
    return {
      status: "ready",
      candidate: latestCandidate,
      report,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Faculty report data could not be loaded.",
    };
  }
}

function loadFromCanonicalCompletedSummaryKeys(): PreviewState {
  const candidates: StoredFacultyReportCandidate[] = [];
  let foundCanonicalData = false;
  let foundCompletedWithoutFacultyData = false;
  let foundMalformedData = false;
  let foundStaleRubricData = false;
  let foundStaleScoringData = false;

  for (const key of CANONICAL_COMPLETED_SUMMARY_KEYS) {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      continue;
    }

    foundCanonicalData = true;
    const parsed = safeParseJson(rawValue);
    if (!parsed) {
      foundMalformedData = true;
      continue;
    }

    const summaries = Array.isArray(parsed) ? parsed : [parsed];
    for (const summary of summaries) {
      const candidate = extractFacultyReportCandidate(key, summary);
      if (!candidate) {
        foundCompletedWithoutFacultyData = true;
        continue;
      }
      const compatibility = getCandidateCompatibility(candidate);
      if (compatibility === "stale-rubric") {
        foundStaleRubricData = true;
        continue;
      }
      if (compatibility === "stale-scoring") {
        foundStaleScoringData = true;
        continue;
      }
      candidates.push(candidate);
    }
  }

  if (candidates.length > 0) {
    const latestCandidate = candidates.sort(compareCandidatesByUpdatedAt)[0];
    if (!latestCandidate) {
      return { status: "empty" };
    }
    try {
      return {
        status: "ready",
        candidate: latestCandidate,
        report: buildFacultyReport({
          rubric: latestCandidate.rubric,
          completedEvaluations: latestCandidate.completedEvaluations,
          score: latestCandidate.score,
        }),
      };
    } catch {
      return {
        status: "incompatible",
        message: "Faculty-rubric report cannot be finalized from this saved encounter.",
      };
    }
  }

  if (foundStaleRubricData) {
    return {
      status: "incompatible",
      message: "Stored rubric evaluation is stale and must be refreshed.",
    };
  }

  if (foundStaleScoringData) {
    return {
      status: "incompatible",
      message: "Stored scoring data uses an outdated scoring policy.",
    };
  }

  if (foundMalformedData) {
    return {
      status: "incompatible",
      message: "Faculty-rubric report cannot be finalized from this saved encounter.",
    };
  }

  if (foundCanonicalData && foundCompletedWithoutFacultyData) {
    return {
      status: "incompatible",
      message: "No completed faculty-rubric report data is available.",
    };
  }

  return { status: "empty" };
}

function extractFacultyReportCandidate(
  storageKey: string,
  value: unknown,
): StoredFacultyReportCandidate | null {
  const containers = collectCandidateContainers(value);

  for (const container of containers) {
    const rubric = readFirst<FacultyReportRubric>(container, ["rubric", "facultyRubric", "facultyReportRubric"]);
    const completedEvaluations = readFirst<FacultyReportEvaluation[]>(container, [
      "completedEvaluations",
      "evaluations",
      "facultyRubricEvaluations",
      "facultyEvaluations",
    ]);
    const score = readFirst<BuildFacultyReportInput["score"]>(container, [
      "score",
      "facultyRubricScore",
      "inactiveFacultyRubricScore",
      "proposedFacultyRubricScore",
    ]);

    if (isFacultyReportRubric(rubric) && Array.isArray(completedEvaluations) && isFacultyScore(score)) {
      const candidate: StoredFacultyReportCandidate = {
        storageKey,
        rubric,
        completedEvaluations,
        score,
      };
      const updatedAt = readString(container, ["updatedAt", "completedAt", "lastUpdatedAt", "savedAt"]);
      const caseTitle = readString(container, ["caseTitle", "title", "metadataTitle"]);
      const legacyScore = readNumber(container, ["legacyScore", "overallScore", "scorePercentage"]);
      if (updatedAt) {
        candidate.updatedAt = updatedAt;
      }
      if (caseTitle) {
        candidate.caseTitle = caseTitle;
      }
      if (legacyScore !== undefined) {
        candidate.legacyScore = legacyScore;
      }
      return candidate;
    }
  }

  return null;
}

function getCandidateCompatibility(candidate: StoredFacultyReportCandidate): "compatible" | "stale-rubric" | "stale-scoring" {
  if (candidate.score.scoringVersion !== CURRENT_SCORING_VERSION) {
    return "stale-scoring";
  }
  if (candidate.rubric.rubricVersion && candidate.score.rubricVersion !== candidate.rubric.rubricVersion) {
    return "stale-rubric";
  }
  if (candidate.rubric.version && candidate.score.rubricVersion !== candidate.rubric.version) {
    return "stale-rubric";
  }
  return "compatible";
}

function collectCandidateContainers(value: unknown): Record<string, unknown>[] {
  const containers: Record<string, unknown>[] = [];
  const visit = (current: unknown, depth: number) => {
    if (depth > 4 || !isRecord(current)) {
      return;
    }
    containers.push(current);
    for (const child of Object.values(current)) {
      if (isRecord(child)) {
        visit(child, depth + 1);
      }
    }
  };
  visit(value, 0);
  return containers;
}

function readFirst<T>(container: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = container[key];
    if (value !== undefined) {
      return value as T;
    }
  }
  return undefined;
}

function readString(container: Record<string, unknown>, keys: string[]): string | undefined {
  const value = readFirst<unknown>(container, keys);
  return typeof value === "string" ? value : undefined;
}

function readNumber(container: Record<string, unknown>, keys: string[]): number | null | undefined {
  const value = readFirst<unknown>(container, keys);
  return typeof value === "number" ? value : undefined;
}

function isFacultyReportRubric(value: unknown): value is FacultyReportRubric {
  return isRecord(value) && typeof value.caseId === "string" && Array.isArray(value.criteria);
}

function isFacultyScore(value: unknown): value is BuildFacultyReportInput["score"] {
  return isRecord(value) && typeof value.caseId === "string" && Array.isArray(value.criteria);
}

function mightContainFacultyReportData(key: string, value: string): boolean {
  const haystack = `${key} ${value.slice(0, 2000)}`;
  return FACULTY_REPORT_STORAGE_MARKERS.some((marker) => haystack.includes(marker));
}

function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function compareCandidatesByUpdatedAt(left: StoredFacultyReportCandidate, right: StoredFacultyReportCandidate): number {
  return getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt);
}

function getTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOverallTone(status: FacultyReport["passStatus"]): StatusTone {
  if (status === "pass") {
    return "positive";
  }
  if (status === "does-not-pass") {
    return "negative";
  }
  return "neutral";
}

function getCompetencyTone(status: FacultyReportCompetencySummary["statusLabel"]): StatusTone {
  if (status === "strong") {
    return "positive";
  }
  if (status === "developing") {
    return "warning";
  }
  if (status === "needs-attention") {
    return "negative";
  }
  return "neutral";
}

function formatStatusLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCriterionStatus(status: string): string {
  if (status === "uncertain") {
    return "Uncertain - No credit awarded";
  }
  return formatStatusLabel(status);
}

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  return `${Math.round(value)}%`;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function formatEvidence(criterion: FacultyReportCriterionResult): string {
  if (criterion.evidence.length === 0) {
    return "-";
  }
  return criterion.evidence
    .map((evidence) => evidence.excerpt ?? evidence.checklistItemId ?? evidence.eventId ?? evidence.source)
    .join("; ");
}

function getEvaluationMetadata(criterion: FacultyReportCriterionResult, key: "confidence" | "evaluationMethod"): string {
  const metadataValues = criterion.evidence
    .map((evidence) => evidence.metadata?.[key])
    .filter((value) => value !== undefined);
  if (metadataValues.length === 0) {
    return "-";
  }
  return metadataValues.map(String).join(", ");
}

function isCriticalCriterion(report: FacultyReport, criterionId: string): boolean {
  return report.criterionResults.some((criterion) => criterion.criterionId === criterionId && criterion.critical);
}
