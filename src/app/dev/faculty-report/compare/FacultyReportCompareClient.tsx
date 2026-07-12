"use client";

import { useEffect, useMemo, useState } from "react";

import {
  COMPLETED_ENCOUNTERS_STORAGE_KEY,
  readCompletedEncounterStore,
} from "@/lib/localEncounter";
import type {
  ReportDomainSection,
  StructuredCaseReport,
} from "@/lib/reportTypes";
import { facultyRubrics } from "@/lib/facultyRubric/caseRubrics";
import { FACULTY_RUBRIC_VERSION } from "@/lib/facultyRubric/evaluation/state";
import {
  adaptFacultyReportToLegacyReport,
  buildFacultyReport,
  FACULTY_COMPETENCY_TO_REPORT_DOMAIN,
  type FacultyArtifactIntegrityResult,
  type FacultyReport,
} from "@/lib/facultyRubric/report";
import { validatePersistedFacultyArtifacts } from "@/lib/facultyRubric/report/artifactIntegrity";
import {
  scoreFacultyRubricEvaluations,
  type FacultyRubricScore,
} from "@/lib/facultyRubric/scoring";
import type { FacultyRubric } from "@/lib/facultyRubric/types";
import type { EvaluatorDomain } from "@/data/cases";

type CompareState =
  | { status: "loading" }
  | { status: "empty"; message: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      legacyReport: StructuredCaseReport;
      facultyReport: FacultyReport;
      integrity: FacultyArtifactIntegrityResult;
      sourceLabel: string;
    };

type ReportApiResponse =
  | { success: true; report: StructuredCaseReport }
  | { success: false; error?: string };

type MockScenario =
  | "all-met"
  | "pass-with-misses"
  | "does-not-pass"
  | "uncertain-items"
  | "critical-miss"
  | "technical-invalid";

const evaluatorDomains: EvaluatorDomain[] = [
  "communication",
  "history",
  "examination",
  "reasoning",
  "management",
];

const mockScenarios: Array<{ id: MockScenario; label: string }> = [
  { id: "all-met", label: "All met" },
  { id: "pass-with-misses", label: "Pass with several misses" },
  { id: "does-not-pass", label: "Does not pass" },
  { id: "uncertain-items", label: "Uncertain items" },
  { id: "critical-miss", label: "Critical miss" },
  { id: "technical-invalid", label: "Technical invalid" },
];

export function FacultyReportCompareClient() {
  const [state, setState] = useState<CompareState>({ status: "loading" });
  const [mockCaseId, setMockCaseId] = useState("case-01");
  const [mockScenario, setMockScenario] = useState<MockScenario>("all-met");

  useEffect(() => {
    let cancelled = false;

    loadComparisonFromCompletedEncounter()
      .then((nextState) => {
        if (!cancelled) {
          setState(nextState);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Comparison data could not be loaded.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mockState = useMemo(
    () => createMockCompareState(mockCaseId, mockScenario),
    [mockCaseId, mockScenario],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Development comparison - not active
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Legacy Report vs Faculty-Rubric Adapted Report
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This page does not change the active student report, PDF, grading, or navigation.
          </p>
        </header>

        <MockScenarioControls
          caseId={mockCaseId}
          scenario={mockScenario}
          onCaseIdChange={setMockCaseId}
          onScenarioChange={setMockScenario}
        />

        {state.status === "ready" ? (
          <ComparisonView state={state} />
        ) : (
          <StateCard state={state} />
        )}

        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Development-only mocked scenario</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mocked data is not persisted and is only for validating the comparison renderer.
          </p>
        <ComparisonView state={mockState} />
        </section>
      </div>
    </main>
  );
}

function ComparisonView({
  state,
}: {
  state: Extract<CompareState, { status: "ready" }>;
}) {
  const adapted = adaptFacultyReportToLegacyReport(state.facultyReport, {
    legacyReport: state.legacyReport,
  });

  return (
    <section className="space-y-5">
        <ComparisonSummary
        sourceLabel={state.sourceLabel}
        legacyReport={state.legacyReport}
        facultyReport={state.facultyReport}
        adapterResult={adapted}
        integrity={state.integrity}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportColumn
          title="Legacy report - currently active"
          report={state.legacyReport}
        />
        <ReportColumn
          title="Faculty-rubric report - development preview, not active"
          report={adapted.adaptedReport}
          facultyReport={state.facultyReport}
        />
      </div>
    </section>
  );
}

function ComparisonSummary({
  sourceLabel,
  legacyReport,
  facultyReport,
  adapterResult,
  integrity,
}: {
  sourceLabel: string;
  legacyReport: StructuredCaseReport;
  facultyReport: FacultyReport;
  adapterResult: ReturnType<typeof adaptFacultyReportToLegacyReport>;
  integrity: FacultyArtifactIntegrityResult;
}) {
  const comparison = adapterResult.comparison;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Comparison Summary</h2>
          <p className="mt-1 text-sm text-slate-600">{sourceLabel}</p>
        </div>
        <StatusPill
          label={
            adapterResult.validation.valid
              ? "Adapter validation passed"
              : "Adapter validation has issues"
          }
          tone={adapterResult.validation.valid ? "positive" : "warning"}
        />
        <StatusPill
          label={`Persisted faculty artifact integrity: ${integrity.status}`}
          tone={integrity.status === "valid" ? "positive" : "warning"}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="Legacy overall" value={`${legacyReport.overallPerformance.score}%`} />
        <Metric
          label="Proposed faculty score"
          value={formatPercentage(facultyReport.overallScore.percentage)}
        />
        <Metric label="Pass threshold" value="84%" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DifferenceList
          title="Domain score differences"
          items={evaluatorDomains.map((domain) => {
            const legacyScore = comparison.legacyDomainScores[domain];
            const facultyScore = comparison.adaptedFacultyDomainScores[domain];
            return `${domain}: legacy ${legacyScore}%, faculty-rubric ${facultyScore}%${
              legacyScore !== facultyScore ? " - Different score" : ""
            }`;
          })}
        />
        <DifferenceList
          title="Counts"
          items={[
            `Legacy strengths: ${countRecordItems(comparison.legacyStrengths)}`,
            `Faculty strengths: ${countRecordItems(comparison.adaptedStrengths)}`,
            `Legacy improvements: ${countRecordItems(comparison.legacyImprovementAreas)}`,
            `Faculty not-met items: ${countRecordItems(comparison.adaptedNotMetItems)}`,
            `Faculty uncertain items: ${countRecordItems(comparison.adaptedUncertainItems)}`,
            `Critical safety items: ${comparison.adaptedCriticalSafetyItems.length}`,
            `Critical uncertain items: ${facultyReport.uncertainItems.filter((item) => item.criterion.critical).length}`,
          ]}
        />
      </div>

      {!adapterResult.validation.valid ? (
        <DifferenceList
          title="Adapter validation issues"
          items={adapterResult.validation.errors}
        />
      ) : null}
      {integrity.status !== "valid" ? (
        <DifferenceList
          title="Faculty artifact integrity issues"
          items={[...integrity.errors, ...integrity.warnings]}
        />
      ) : null}
    </section>
  );
}

function ReportColumn({
  title,
  report,
  facultyReport,
}: {
  title: string;
  report: StructuredCaseReport;
  facultyReport?: FacultyReport;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">
        <Section title="Overall">
          <p className="font-semibold">{report.case.title}</p>
          <p className="text-sm text-slate-600">{report.case.patientName}</p>
          <p className="mt-2 text-sm">Score: {report.overallPerformance.score}%</p>
          <p className="mt-2 text-sm text-slate-700">{report.overallPerformance.summary}</p>
          <p className="mt-2 text-sm font-medium">{report.overallPerformance.mainTakeaway}</p>
        </Section>

        <Section title="Domains">
          <div className="space-y-3">
            {evaluatorDomains.map((domain) => (
              <DomainBlock
                key={domain}
                domain={domain}
                section={report.domains[domain]}
                facultyReport={facultyReport}
              />
            ))}
          </div>
        </Section>

        <Section title="Transcript and Timeline">
          <p className="text-sm">Transcript messages: {report.transcript.length}</p>
          <p className="text-sm">Timeline events: {report.timeline.length}</p>
        </Section>
      </div>
    </article>
  );
}

function DomainBlock({
  domain,
  section,
  facultyReport,
}: {
  domain: EvaluatorDomain;
  section: ReportDomainSection;
  facultyReport?: FacultyReport;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold capitalize">{domain}</h3>
        <StatusPill label={`${section.score}%`} tone="neutral" />
      </div>
      <p className="mt-2 text-sm text-slate-700">{section.narrative}</p>
      <MiniList title="Strengths" items={section.strengths} />
      <MiniList title="Improvements" items={section.missedOrIncomplete} />
      <MiniList title="Critical safety" items={section.criticalMisses} />
      {facultyReport ? (
        <CriterionTraceability
          domain={domain}
          facultyReport={facultyReport}
        />
      ) : null}
    </div>
  );
}

function CriterionTraceability({
  domain,
  facultyReport,
}: {
  domain: EvaluatorDomain;
  facultyReport: FacultyReport;
}) {
  const criteria = facultyReport.criterionResults.filter(
    (criterion) =>
      FACULTY_COMPETENCY_TO_REPORT_DOMAIN[criterion.competency] === domain,
  );

  if (criteria.length === 0) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Criterion traceability
      </summary>
      <div className="mt-3 space-y-3">
        {criteria.map((criterion) => (
          <div key={criterion.criterionId} className="text-sm">
            <p className="font-semibold">
              {criterion.criterionId}: {criterion.title}
            </p>
            <p className="text-slate-600">
              {criterion.competency} | {formatStatus(criterion.status)}
            </p>
            <p className="text-slate-600">Rationale: {criterion.rationale ?? "-"}</p>
            <p className="text-slate-600">
              Evidence:{" "}
              {criterion.evidence
                .map((evidence) => evidence.excerpt ?? evidence.eventId ?? evidence.source)
                .join("; ") || "-"}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function StateCard({ state }: { state: Exclude<CompareState, { status: "ready" }> }) {
  const message =
    state.status === "loading"
      ? "Loading comparison data..."
      : state.message;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <h2 className="text-lg font-semibold">Real completed encounter</h2>
      <p className="mt-2 text-sm">{message}</p>
    </section>
  );
}

function MockScenarioControls({
  caseId,
  scenario,
  onCaseIdChange,
  onScenarioChange,
}: {
  caseId: string;
  scenario: MockScenario;
  onCaseIdChange: (caseId: string) => void;
  onScenarioChange: (scenario: MockScenario) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mock scenario controls</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Case
          <select
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={caseId}
            onChange={(event) => onCaseIdChange(event.target.value)}
          >
            {facultyRubrics.map((rubric) => (
              <option key={rubric.caseId} value={rubric.caseId}>
                {rubric.caseId}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Scenario
          <select
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value as MockScenario)}
          >
            {mockScenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

async function loadComparisonFromCompletedEncounter(): Promise<CompareState> {
  if (typeof window === "undefined") {
    return { status: "empty", message: "No browser storage is available." };
  }

  const summary = Object.values(readCompletedEncounterStore())
    .flat()
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))[0];

  if (!summary) {
    return { status: "empty", message: "No completed encounter was found." };
  }

  if (!summary.facultyRubricEvaluation || !summary.facultyRubricScore || !summary.facultyReport) {
    return {
      status: "empty",
      message: "The completed encounter does not include faculty-rubric artifacts.",
    };
  }

  const legacyResponse = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: summary.caseId,
      conversationHistory: summary.conversationHistory.map((message) => ({
        role: message.role,
        text: message.text,
        timestamp: message.timestamp,
      })),
      coveredChecklistItems: summary.coveredChecklistItems,
      coveredFacts: summary.coveredFacts,
      examinationsViewed: summary.examinationsViewed,
      encounterEvents: summary.encounterEvents,
      completedAt: summary.savedAt,
    }),
  });
  const payload = (await legacyResponse.json().catch(() => undefined)) as
    | ReportApiResponse
    | undefined;

  if (!legacyResponse.ok || !payload?.success) {
    return { status: "error", message: "The active legacy report could not be generated." };
  }

  return {
    status: "ready",
    legacyReport: payload.report,
    facultyReport: summary.facultyReport,
    integrity: validatePersistedFacultyArtifacts({
      caseId: summary.caseId,
      evaluation: summary.facultyRubricEvaluation,
      score: summary.facultyRubricScore,
      report: summary.facultyReport,
    }),
    sourceLabel: `Newest completed encounter from ${COMPLETED_ENCOUNTERS_STORAGE_KEY}`,
  };
}

function createMockCompareState(
  caseId: string,
  scenario: MockScenario,
): Extract<CompareState, { status: "ready" }> {
  const rubric = facultyRubrics.find((item) => item.caseId === caseId) ?? facultyRubrics[0];

  if (!rubric) {
    throw new Error("No faculty rubric is available for mock comparison.");
  }

  const evaluations = rubric.criteria.map((criterion, index) => ({
    caseId: rubric.caseId,
    criterionId: criterion.id,
    status: getMockStatus({ scenario, criterion, index }),
    confidence: scenario === "uncertain-items" ? 0.4 : 1,
    evidence: [
      {
        source: "workflow-event" as const,
        excerpt: `Mock evidence for ${criterion.id}`,
      },
    ],
    rationale: `Mock rationale for ${criterion.title}.`,
    evaluationMethod: "deterministic" as const,
    evaluatedAt: "2026-07-11T00:00:00.000Z",
  }));
  const score = scoreFacultyRubricEvaluations({
    caseId: rubric.caseId,
    evaluations,
  });
  const facultyReport = buildFacultyReport({
    rubric,
    completedEvaluations: evaluations,
    score,
    generatedAt: "2026-07-11T00:00:00.000Z",
  });
  const legacyReport = createMockLegacyReport(rubric, score);

  return {
    status: "ready",
    legacyReport,
    facultyReport,
    integrity: validatePersistedFacultyArtifacts({
      caseId: rubric.caseId,
      evaluation: {
        caseId: rubric.caseId,
        rubricVersion: FACULTY_RUBRIC_VERSION,
        transcriptRevision: "mock-revision",
        status: score.status === "technical-invalid" ? "partial" : "complete",
        evaluations,
        evaluatedAt: "2026-07-11T00:00:00.000Z",
      },
      score,
      report: facultyReport,
    }),
    sourceLabel: `Mock ${rubric.caseId} / ${scenario}`,
  };
}

function getMockStatus({
  scenario,
  criterion,
  index,
}: {
  scenario: MockScenario;
  criterion: FacultyRubric["criteria"][number];
  index: number;
}) {
  if (scenario === "all-met") {
    return "met" as const;
  }
  if (scenario === "technical-invalid" && index > 4) {
    return "met" as const;
  }
  if (scenario === "critical-miss" && criterion.critical) {
    return "not-met" as const;
  }
  if (scenario === "uncertain-items" && index % 4 === 0) {
    return "uncertain" as const;
  }
  if (scenario === "does-not-pass" && index % 2 === 0) {
    return "not-met" as const;
  }
  if (scenario === "pass-with-misses" && index % 8 === 0) {
    return "not-met" as const;
  }
  return "met" as const;
}

function createMockLegacyReport(
  rubric: FacultyRubric,
  score: FacultyRubricScore,
): StructuredCaseReport {
  return {
    case: {
      caseId: rubric.caseId,
      title: `${rubric.title} legacy mock`,
      patientName: "Development Patient",
      chiefComplaint: "Development comparison scenario",
      completedAt: "2026-07-11T00:00:00.000Z",
    },
    overallPerformance: {
      score: score.percentage ?? 0,
      summary: "Mock legacy summary for development comparison.",
      mainTakeaway: "Mock legacy takeaway.",
    },
    domains: Object.fromEntries(
      evaluatorDomains.map((domain) => [domain, createMockDomainSection(domain)]),
    ) as Record<EvaluatorDomain, ReportDomainSection>,
    clinicalReasoning: {
      expectedDiagnosis: "Mock expected diagnosis",
      differentialDiagnosis: ["Mock differential"],
      supportingFindings: ["Mock supporting finding"],
      keyRedFlags: ["Mock red flag"],
    },
    management: {
      requiredInvestigations: ["Mock investigation"],
      treatmentExpectations: ["Mock treatment"],
      referralExpectations: ["Mock referral"],
      safetyNettingExpectations: ["Mock safety-netting"],
    },
    practiceNext: ["Mock practice item 1", "Mock practice item 2", "Mock practice item 3"],
    transcript: [{ role: "student", text: "Mock student question", timestamp: "2026-07-11T00:00:00.000Z" }],
    timeline: [{ type: "student_message", label: "Mock student message", timestamp: "2026-07-11T00:00:00.000Z" }],
    grading: {
      patient: createMockChecklistSection(),
      clinical: createMockChecklistSection(),
      domains: createMockChecklistDomains(),
      overall: score.percentage ?? 0,
    },
  };
}

function createMockDomainSection(domain: EvaluatorDomain): ReportDomainSection {
  return {
    score: 75,
    completed: 1,
    total: 2,
    earnedWeight: 1,
    availableWeight: 2,
    completedCriteria: [`Legacy ${domain} completed item`],
    strengths: [`Legacy ${domain} strength`],
    missedOrIncomplete: [`Legacy ${domain} improvement`],
    narrative: `Legacy ${domain} narrative.`,
    criticalMisses: [],
  };
}

function createMockChecklistSection() {
  return {
    total: 2,
    completed: 1,
    earnedWeight: 1,
    availableWeight: 2,
    missed: ["Mock missed item"],
    criticalMisses: [],
    score: 50,
  };
}

function createMockChecklistDomains(): StructuredCaseReport["grading"]["domains"] {
  return {
    communication: createMockChecklistSection(),
    history: createMockChecklistSection(),
    examination: createMockChecklistSection(),
    reasoning: createMockChecklistSection(),
    management: createMockChecklistSection(),
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 p-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-500">None</p>
      )}
    </div>
  );
}

function DifferenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

type StatusTone = "positive" | "warning" | "neutral";

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const className = {
    positive: "border-emerald-300 bg-emerald-50 text-emerald-900",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    neutral: "border-slate-300 bg-slate-100 text-slate-800",
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function countRecordItems(record: Record<EvaluatorDomain, string[]>) {
  return evaluatorDomains.reduce((count, domain) => count + record[domain].length, 0);
}

function formatPercentage(value: number | null) {
  return value === null ? "Unavailable" : `${value}%`;
}

function formatStatus(status: string) {
  return status === "uncertain" ? "Uncertain - No credit awarded" : status;
}
