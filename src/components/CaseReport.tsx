"use client";

// Development-only legacy comparison renderer. The normal report route uses
// CanonicalCaseReport and does not activate this component or its mode toggle.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Home,
} from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FacultyCaseReport } from "@/components/FacultyCaseReport";
import { RetryCaseButton } from "@/components/RetryCaseButton";
import {
  readCompletedEncounterAttempt,
  type LocalEncounterSummary,
} from "@/lib/localEncounter";
import { validatePersistedFacultyArtifacts } from "@/lib/facultyRubric/report/artifactIntegrity";
import type {
  ReportDomainSection,
  ReportTimelineEvent,
  ReportTranscriptMessage,
  StructuredCaseReport,
} from "@/lib/reportTypes";
import {
  buildReportPdfFilename,
  generateReportPdfBlob,
} from "@/lib/reportPdf";
import {
  getDisplayDomainSection,
  getDisplayOverallSummary,
  getDisplayItem,
  getDisplayPracticeItems,
  REPORT_DOMAIN_LABELS,
  REPORT_SECTION_LABELS,
} from "@/lib/reportDisplay";

type CaseReportProps = {
  caseId: string;
  attemptId: string;
};

type ReportApiResponse =
  | {
      success: true;
      report: StructuredCaseReport;
    }
  | {
      success: false;
      error?: string;
    };

type ReportStatus = "checking" | "empty" | "loading" | "ready" | "error";

export function CaseReport({ caseId, attemptId }: CaseReportProps) {
  const [status, setStatus] = useState<ReportStatus>("checking");
  const [report, setReport] = useState<StructuredCaseReport | null>(null);
  const [facultyPreviewSummary, setFacultyPreviewSummary] =
    useState<LocalEncounterSummary | null>(null);
  const [facultyPreviewNotice, setFacultyPreviewNotice] = useState("");
  const [message, setMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  const requestKeyRef = useRef<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDevelopmentReportPreview = process.env.NODE_ENV !== "production";
  const requestedReportMode = searchParams.get("reportMode");
  const isFacultyReportModeEnabled =
    isDevelopmentReportPreview && requestedReportMode !== "legacy";
  const reportModeSwitcher = isDevelopmentReportPreview ? (
    <ReportModeSwitcher
      activeMode={isFacultyReportModeEnabled ? "faculty" : "legacy"}
      pathname={pathname}
      searchParams={searchParams}
    />
  ) : null;

  const generateReport = useCallback(
    async (summary: LocalEncounterSummary, signal: AbortSignal) => {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        signal,
      });
      const data = (await response.json().catch(() => undefined)) as
        | ReportApiResponse
        | undefined;

      if (!response.ok || !data) {
        return {
          success: false,
          error: "report_request_failed",
        } satisfies ReportApiResponse;
      }

      return data;
    },
    [],
  );

  useEffect(() => {
    let controller: AbortController | null = null;
    const timer = window.setTimeout(() => {
      const summary = readCompletedEncounterAttempt(caseId, attemptId);

      if (!summary) {
        setStatus("empty");
        setMessage(
          "No completed encounter was found. Finish a consultation before opening the report.",
        );
        return;
      }

      if (summary.caseId !== caseId) {
        setStatus("empty");
        setMessage(
          "The saved encounter belongs to a different case. Finish this case to generate its report.",
        );
        return;
      }

      if (summary.conversationHistory.length === 0) {
        setStatus("empty");
        setMessage(
          "This saved encounter does not include a transcript, so a report cannot be generated yet.",
        );
        return;
      }

      const requestKey = [
        summary.caseId,
        summary.savedAt,
        summary.conversationHistory.length,
        isFacultyReportModeEnabled ? "faculty" : "legacy",
        retryCount,
      ].join(":");

      if (requestKeyRef.current === requestKey) {
        return;
      }

      requestKeyRef.current = requestKey;
      controller = new AbortController();

      setStatus("loading");
      setMessage("");
      setReport(null);
      setFacultyPreviewSummary(null);
      setFacultyPreviewNotice("");

      void generateReport(summary, controller.signal)
        .then((response) => {
          if (!controller || controller.signal.aborted) {
            return;
          }

          if (!response.success) {
            throw new Error(response.error || "invalid_report_response");
          }

          if (!isStructuredReport(response.report)) {
            throw new Error("invalid_report_response");
          }

          setReport(response.report);
          if (isFacultyReportModeEnabled) {
            const validation = validateFacultyPreviewSummary(summary);

            if (validation.valid) {
              setFacultyPreviewSummary(summary);
            } else {
              setFacultyPreviewNotice(validation.message);
            }
          }
          setStatus("ready");
        })
        .catch((error) => {
          if (!controller || controller.signal.aborted) {
            return;
          }

          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "The report could not be generated.",
          );
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [attemptId, caseId, generateReport, isFacultyReportModeEnabled, retryCount]);

  const exportPdf = useCallback(async () => {
    if (!report || isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);
    setExportError("");

    try {
      const pdfBlob = await generateReportPdfBlob(report);
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = buildReportPdfFilename(report);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);
    } catch {
      setExportError("The PDF could not be exported. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf, report]);

  if (status === "checking" || status === "loading") {
    return (
      <ReportStateCard
        title="Generating report"
        message="Building a transcript-grounded faculty report from the completed encounter..."
      />
    );
  }

  if (status === "empty") {
    return (
      <ReportStateCard
        title="No completed encounter"
        message={message}
        actions={<ReportNavigation caseId={caseId} />}
      />
    );
  }

  if (status === "error" || !report) {
    return (
      <ReportStateCard
        tone="error"
        title="Report unavailable"
        message="The report could not be generated. Please try again."
        detail={message}
        actions={
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-11 rounded-xl bg-[var(--color-brand)] text-white"
              onClick={() => setRetryCount((current) => current + 1)}
            >
              Retry report generation
            </Button>
            <ReportNavigation caseId={caseId} />
          </div>
        }
      />
    );
  }

  const legacyReportContent = (
    <LegacyReportContent
      caseId={caseId}
      exportError={exportError}
      facultyPreviewNotice={facultyPreviewNotice}
      isExportingPdf={isExportingPdf}
      onExportPdf={exportPdf}
      report={report}
      reportModeSwitcher={reportModeSwitcher}
    />
  );
  const facultyRenderFallbackContent = (
    <LegacyReportContent
      caseId={caseId}
      exportError={exportError}
      facultyPreviewNotice="faculty-render-error"
      isExportingPdf={isExportingPdf}
      onExportPdf={exportPdf}
      report={report}
      reportModeSwitcher={reportModeSwitcher}
    />
  );

  if (
    isFacultyReportModeEnabled &&
    facultyPreviewSummary?.facultyReport &&
    facultyPreviewSummary.facultyRubricScore?.passStatus !== "technical-invalid"
  ) {
    return (
      <FacultyReportRenderBoundary fallback={facultyRenderFallbackContent}>
        <FacultyCaseReport
          caseId={caseId}
          attemptId={attemptId}
          caseTitle={report.case.title}
          patientName={report.case.patientName}
          facultyReport={facultyPreviewSummary.facultyReport}
          modeSwitcher={reportModeSwitcher}
        />
      </FacultyReportRenderBoundary>
    );
  }

  return legacyReportContent;
}

function LegacyReportContent({
  caseId,
  exportError,
  facultyPreviewNotice,
  isExportingPdf,
  onExportPdf,
  report,
  reportModeSwitcher,
}: {
  caseId: string;
  exportError: string;
  facultyPreviewNotice: string;
  isExportingPdf: boolean;
  onExportPdf: () => void;
  report: StructuredCaseReport;
  reportModeSwitcher: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {reportModeSwitcher ? <div>{reportModeSwitcher}</div> : null}
      {facultyPreviewNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Faculty report preview was unavailable. Showing the legacy report.
        </div>
      ) : null}
      <OverallPerformance report={report} />
      <DomainPerformance report={report} />
      <ClinicalReasoning report={report} />
      <Management report={report} />
      <PracticeNext items={report.practiceNext} />
      <TranscriptAndTimeline
        transcript={report.transcript}
        timeline={report.timeline}
      />
      <ReportActions
        caseId={caseId}
        exportError={exportError}
        isExportingPdf={isExportingPdf}
        onExportPdf={onExportPdf}
      />
    </div>
  );
}

class FacultyReportRenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Development-only preview failures should not block the legacy report.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function ReportModeSwitcher({
  activeMode,
  pathname,
  searchParams,
}: {
  activeMode: "faculty" | "legacy";
  pathname: string;
  searchParams: Pick<URLSearchParams, "toString">;
}) {
  return (
    <nav
      aria-label="Development report renderer"
      className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1 text-sm shadow-[var(--elevation-subtle)]"
    >
      <ReportModeLink
        active={activeMode === "faculty"}
        href={createReportModeHref(pathname, searchParams, "faculty")}
        label="Faculty Report"
      />
      <ReportModeLink
        active={activeMode === "legacy"}
        href={createReportModeHref(pathname, searchParams, "legacy")}
        label="Legacy Report"
      />
    </nav>
  );
}

function ReportModeLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 font-semibold transition ${
        active
          ? "bg-[var(--color-brand)] text-white"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function createReportModeHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
  mode: "faculty" | "legacy",
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("reportMode", mode);
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

function OverallPerformance({ report }: { report: StructuredCaseReport }) {
  return (
    <ReportCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-brand)]">
            Overall Performance
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">
            {report.case.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {report.case.patientName}
          </p>
        </div>
        <ScoreBadge label="Overall score" score={report.overallPerformance.score} />
      </div>
      <div className="mt-5 space-y-4">
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {getDisplayOverallSummary(report.overallPerformance.summary)}
        </p>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
            Main takeaway
          </p>
          <p className="mt-2 text-sm leading-6">
            {report.overallPerformance.mainTakeaway}
          </p>
        </div>
      </div>
    </ReportCard>
  );
}

function DomainPerformance({ report }: { report: StructuredCaseReport }) {
  return (
    <ReportCard title={REPORT_SECTION_LABELS.domainScores}>
      <div className="space-y-3">
        {REPORT_DOMAIN_LABELS.map(({ id, label }) => (
          <DomainSection key={id} label={label} section={report.domains[id]} />
        ))}
      </div>
    </ReportCard>
  );
}

function DomainSection({
  label,
  section,
}: {
  label: string;
  section: ReportDomainSection;
}) {
  const displaySection = getDisplayDomainSection(section);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {displaySection.displayNarrative}
          </p>
        </div>
        <ScoreBadge label={`${label} score`} score={section.score} compact />
      </div>

      <ReportListGroup
        title="Strengths"
        items={displaySection.displayStrengths}
        emptyText={
          displaySection.score === 0 && displaySection.completed === 0
            ? "No demonstrated strength was identified in this domain."
            : undefined
        }
      />
      <ReportListGroup
        title="Missed or incomplete"
        items={displaySection.displayMissedOrIncomplete}
        emptyText="No missed or incomplete areas were identified."
      />
      {displaySection.displayCriticalMisses.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="size-4" />
            Priority safety point
          </div>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {displaySection.displayCriticalMisses.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ClinicalReasoning({ report }: { report: StructuredCaseReport }) {
  return (
    <ReportCard title={REPORT_SECTION_LABELS.clinicalReasoningDetails}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
            Expected diagnosis
          </p>
          <p className="mt-2 text-base font-semibold">
            {report.clinicalReasoning.expectedDiagnosis}
          </p>
        </div>
        <ReportListGroup
          title="Differential diagnosis"
          items={report.clinicalReasoning.differentialDiagnosis}
        />
        <ReportListGroup
          title="Supporting findings"
          items={report.clinicalReasoning.supportingFindings}
        />
        <ReportListGroup
          title="Key red flags"
          items={report.clinicalReasoning.keyRedFlags}
        />
      </div>
    </ReportCard>
  );
}

function Management({ report }: { report: StructuredCaseReport }) {
  return (
    <ReportCard title={REPORT_SECTION_LABELS.managementPlanExpectations}>
      <div className="space-y-4">
        <ReportListGroup
          title="Required investigations"
          items={report.management.requiredInvestigations}
        />
        <ReportListGroup
          title="Treatment expectations"
          items={report.management.treatmentExpectations}
        />
        <ReportListGroup
          title="Referral or escalation"
          items={report.management.referralExpectations}
        />
        <ReportListGroup
          title="Safety-netting"
          items={report.management.safetyNettingExpectations}
        />
      </div>
    </ReportCard>
  );
}

function PracticeNext({ items }: { items: string[] }) {
  const displayItems = getDisplayPracticeItems(items);

  return (
    <ReportCard title="What to Practice Next">
      <ol className="space-y-3">
        {displayItems.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-action)_8%,white)] p-3 text-sm leading-6"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-action)] text-sm font-semibold text-white">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </ReportCard>
  );
}

function TranscriptAndTimeline({
  transcript,
  timeline,
}: {
  transcript: ReportTranscriptMessage[];
  timeline: ReportTimelineEvent[];
}) {
  return (
    <ReportCard title="Transcript and Timeline">
      <div className="space-y-3">
        <details className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Transcript
          </summary>
          <div className="mt-4 space-y-3">
            {transcript.map((message, index) => (
              <div key={`${message.timestamp ?? index}-${index}`} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold capitalize">{message.role}</p>
                  {message.timestamp ? (
                    <time className="text-xs text-[var(--color-text-secondary)]">
                      {formatDateTime(message.timestamp)}
                    </time>
                  ) : null}
                </div>
                <p className="mt-1 leading-6 text-[var(--color-text-secondary)]">
                  {message.text}
                </p>
              </div>
            ))}
          </div>
        </details>
        <details className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Timeline and examination events
          </summary>
          <div className="mt-4 space-y-3">
            {timeline.length > 0 ? (
              timeline.map((event, index) => (
                <div
                  key={`${event.type}-${event.timestamp ?? index}-${index}`}
                  className="border-l-2 border-[color-mix(in_srgb,var(--color-brand)_25%,white)] pl-3 text-sm"
                >
                  <p className="font-semibold">{event.label}</p>
                  {event.timestamp ? (
                    <time className="text-xs text-[var(--color-text-secondary)]">
                      {formatDateTime(event.timestamp)}
                    </time>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No timeline events were recorded.
              </p>
            )}
          </div>
        </details>
      </div>
    </ReportCard>
  );
}

function ReportNavigation({ caseId }: { caseId: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Button
        asChild
        variant="outline"
        className="h-11 rounded-xl bg-[var(--color-surface)]"
      >
        <Link href={`/mentor/${caseId}`}>
          <ArrowLeft className="size-4" />
          Return to Mentor
        </Link>
      </Button>
      <RetryCaseButton caseId={caseId} />
      <Button
        asChild
        variant="outline"
        className="h-11 rounded-xl bg-[var(--color-surface)]"
      >
        <Link href="/home">
          <Home className="size-4" />
          Return Home
        </Link>
      </Button>
    </div>
  );
}

function ReportActions({
  caseId,
  exportError,
  isExportingPdf,
  onExportPdf,
}: {
  caseId: string;
  exportError: string;
  isExportingPdf: boolean;
  onExportPdf: () => void;
}) {
  return (
    <section className="space-y-3">
      <Button
        type="button"
        className="h-11 w-full rounded-xl bg-[var(--color-brand)] text-white hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,black)]"
        disabled={isExportingPdf}
        onClick={onExportPdf}
      >
        <Download className="size-4" />
        {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
      </Button>
      {exportError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          {exportError}
        </p>
      ) : null}
      <ReportNavigation caseId={caseId} />
    </section>
  );
}

function ReportStateCard({
  title,
  message,
  detail,
  tone = "default",
  actions,
}: {
  title: string;
  message: string;
  detail?: string;
  tone?: "default" | "error";
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-[var(--elevation-subtle)] ${
        tone === "error"
          ? "border-red-200 bg-red-50"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          tone === "error" ? "text-red-700" : "text-[var(--color-brand)]"
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-3 text-sm leading-6 ${
          tone === "error"
            ? "text-red-700"
            : "text-[var(--color-text-secondary)]"
        }`}
      >
        {message}
      </p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          Reason: {detail}
        </p>
      ) : null}
      {actions ? <div className="mt-5">{actions}</div> : null}
    </section>
  );
}

function ReportCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)]">
      {title ? (
        <h2 className="mb-4 text-lg font-semibold leading-tight">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

function ReportListGroup({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText?: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {items.map((item) => (
            <li key={item}>- {getDisplayItem(item)}</li>
          ))}
        </ul>
      ) : emptyText ? (
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {emptyText}
        </p>
      ) : null}
    </div>
  );
}

function ScoreBadge({
  label,
  score,
  compact = false,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  return (
    <div
      aria-label={`${label}: ${formatScore(score)} percent`}
      className={`shrink-0 rounded-2xl bg-[color-mix(in_srgb,var(--color-brand)_10%,white)] text-center ${
        compact ? "min-w-20 px-3 py-2" : "min-w-28 px-4 py-3"
      }`}
    >
      <p
        className={`font-semibold text-[var(--color-brand)] ${
          compact ? "text-xl" : "text-3xl"
        }`}
      >
        {formatScore(score)}%
      </p>
      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        Score
      </p>
    </div>
  );
}

function isStructuredReport(value: unknown): value is StructuredCaseReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<StructuredCaseReport>;

  return (
    Boolean(report.case) &&
    Boolean(report.overallPerformance) &&
    Boolean(report.domains) &&
    Boolean(report.clinicalReasoning) &&
    Boolean(report.management) &&
    Array.isArray(report.practiceNext) &&
    Array.isArray(report.transcript) &&
    Array.isArray(report.timeline)
  );
}

function validateFacultyPreviewSummary(summary: LocalEncounterSummary): {
  valid: boolean;
  message: string;
} {
  if (
    !summary.facultyRubricEvaluation ||
    !summary.facultyRubricScore ||
    !summary.facultyReport
  ) {
    return {
      valid: false,
      message:
        "Faculty-rubric preview is unavailable because the completed encounter does not include faculty artifacts.",
    };
  }

  if (summary.facultyRubricScore.passStatus === "technical-invalid") {
    return {
      valid: false,
      message:
        "Faculty-rubric preview is unavailable because the saved faculty score is technical-invalid.",
    };
  }

  const integrity = validatePersistedFacultyArtifacts({
    caseId: summary.caseId,
    evaluation: summary.facultyRubricEvaluation,
    score: summary.facultyRubricScore,
    report: summary.facultyReport,
  });

  if (integrity.status !== "valid") {
    const detail =
      integrity.errors[0] ?? integrity.warnings[0] ?? "Integrity check failed.";

    return {
      valid: false,
      message: `Faculty-rubric preview fell back to the legacy report: ${detail}`,
    };
  }

  return { valid: true, message: "" };
}

function formatScore(score: number) {
  return Number.isInteger(score) ? score.toString() : score.toFixed(1);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
