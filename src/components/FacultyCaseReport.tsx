"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Home,
  Download,
} from "lucide-react";

import { RetryCaseButton } from "@/components/RetryCaseButton";
import { Button } from "@/components/ui/button";
import type {
  FacultyReport,
  FacultyReportCompetencyStatus,
  FacultyReportCriterionResult,
  FacultyReportImprovementArea,
  FacultyReportStrength,
} from "@/lib/facultyRubric/report";
import type { FacultyComparisonSection } from "@/lib/facultyRubric/report/comparison";
import type { ConversationMessage } from "@/lib/conversationEngine";
import {
  FACULTY_REPORT_DISPLAY_TITLES,
  formatEncounterTranscriptTimestamp,
  formatFacultyReportPercent,
  getCriticalSafetyDisplayMessage,
  getCriticalSafetyDisplayTitle,
} from "@/lib/facultyRubric/report/displayContent";

type FacultyCaseReportProps = {
  studentName?: string;
  caseLabel?: string;
  completedAt?: string;
  caseId: string;
  attemptId?: string;
  caseTitle: string;
  patientName: string;
  facultyReport: FacultyReport;
  modeSwitcher?: React.ReactNode;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  pdfError?: string;
  comparisonSections?: FacultyComparisonSection[];
  transcript: ConversationMessage[];
};

type StatusTone = "success" | "warning" | "danger" | "neutral";

const competencyOrder = [
  "information-gathering",
  "clinical-findings",
  "clinical-interpretation",
  "management-planning",
  "patient-communication",
  "procedural-decision",
  "examination",
];

export function FacultyCaseReport({
  studentName,
  caseLabel,
  completedAt,
  caseId,
  attemptId,
  caseTitle,
  patientName,
  facultyReport,
  modeSwitcher,
  onDownloadPdf,
  isDownloadingPdf = false,
  pdfError,
  comparisonSections = [],
  transcript,
}: FacultyCaseReportProps) {
  void studentName;
  void caseLabel;
  void completedAt;
  const criterionById = new Map(
    facultyReport.criterionResults.map((criterion) => [
      criterion.criterionId,
      criterion,
    ]),
  );
  const assessedCompetencies = [...facultyReport.competencyScores]
    .filter((competency) => competency.possiblePoints > 0)
    .sort(
      (a, b) =>
        getCompetencyOrderIndex(a.competencyId) -
        getCompetencyOrderIndex(b.competencyId),
    );
  const groupedStrengths = groupStrengthsByCompetency(
    facultyReport.strengths,
    criterionById,
  );
  const groupedImprovements = groupImprovementsByCompetency(
    facultyReport.improvementAreas,
    criterionById,
  );

  return (
    <div className="space-y-4">
      <ReportCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-brand)]">
              {FACULTY_REPORT_DISPLAY_TITLES.report}
            </p>
            {modeSwitcher ? <div className="mt-3">{modeSwitcher}</div> : null}
            <h1 className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">
              {caseTitle}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {patientName}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {facultyReport.overallResult.message}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[25rem] lg:grid-cols-1">
            <ResultMetric
              label="Overall"
              value={formatFacultyReportPercent(facultyReport.overallScore.percentage)}
            />
            <ResultMetric
              label="Required"
              value="84%"
              description="minimum score"
            />
            <ResultMetric
              label="Points"
              value={`${facultyReport.overallScore.earnedPoints}/${facultyReport.overallScore.possiblePoints}`}
              description="earned"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={facultyReport.passStatus === "pass" ? "success" : "warning"}
            label={facultyReport.overallResult.label}
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            Required score: 84%
          </span>
        </div>
      </ReportCard>

      {comparisonSections.map((section) => (
        <ComparisonSection key={section.title} section={section} />
      ))}

      {facultyReport.criticalSafetySummary.message ? (
        <CollapsibleReportCard title={FACULTY_REPORT_DISPLAY_TITLES.criticalSafety}>
          <Notice
            tone="danger"
            title={getCriticalSafetyDisplayTitle(facultyReport)}
            message={getCriticalSafetyDisplayMessage(facultyReport)}
          />
          <CriterionSummaryList
            items={facultyReport.criticalSafetyItems.map((item) => ({
              id: item.criterion.criterionId,
              title: item.criterion.title,
              meta:
                item.status === "uncertain"
                  ? "Critical uncertainty"
                  : "Critical miss",
              tone: item.status === "uncertain" ? "warning" : "danger",
            }))}
          />
        </CollapsibleReportCard>
      ) : null}

      {facultyReport.uncertaintySummary.message ? (
        <ReportCard title={FACULTY_REPORT_DISPLAY_TITLES.uncertainty}>
          <Notice
            tone="warning"
            title={`${facultyReport.uncertaintySummary.uncertainItemCount} ${pluralize(
              "uncertain item",
              facultyReport.uncertaintySummary.uncertainItemCount,
            )}`}
            message={facultyReport.uncertaintySummary.message}
          />
        </ReportCard>
      ) : null}

      <CollapsibleReportCard title={FACULTY_REPORT_DISPLAY_TITLES.competencySummary}>
        <div className="grid gap-3 lg:grid-cols-2">
          {assessedCompetencies.map((competency) => (
            <section
              key={competency.competencyId}
              className="min-w-0 rounded-xl border border-[var(--color-border)] bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">
                    {competency.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {competency.summaryMessage}
                  </p>
                </div>
                <div className="shrink-0 space-y-2 sm:text-right">
                  <p className="text-xl font-semibold">
                    {formatFacultyReportPercent(competency.percentage)}
                  </p>
                  <StatusBadge
                    tone={getCompetencyTone(competency.statusLabel)}
                    label={formatCompetencyStatus(competency.statusLabel)}
                  />
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {competency.earnedPoints}/{competency.possiblePoints} points
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </CollapsibleReportCard>

      <CollapsibleReportCard title={FACULTY_REPORT_DISPLAY_TITLES.strengths}>
        <GroupedStrengthList groups={groupedStrengths} />
      </CollapsibleReportCard>

      <CollapsibleReportCard title={FACULTY_REPORT_DISPLAY_TITLES.improvements}>
        <GroupedImprovementList groups={groupedImprovements} />
      </CollapsibleReportCard>

      <CollapsibleReportCard
        title={FACULTY_REPORT_DISPLAY_TITLES.encounterTranscript}
      >
        <EncounterTranscript messages={transcript} />
      </CollapsibleReportCard>

      {process.env.NODE_ENV !== "production" ? (
        <ReportCard title="Development details">
          <details className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Criterion evidence and rationale
            </summary>
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[48rem] space-y-4">
                {facultyReport.criterionResults.map((criterion) => (
                  <CriterionDetail
                    key={criterion.criterionId}
                    criterion={criterion}
                  />
                ))}
              </div>
            </div>
          </details>
        </ReportCard>
      ) : null}

      <ReportCard>
        {onDownloadPdf ? (
          <Button
            type="button"
            className="mb-3 h-11"
            disabled={isDownloadingPdf}
            onClick={onDownloadPdf}
          >
            <Download className="size-4" />
            {isDownloadingPdf ? "Preparing PDF…" : "Download PDF"}
          </Button>
        ) : (
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            The report must be successfully generated before it can be downloaded.
          </p>
        )}
        {pdfError ? <p className="mb-3 text-sm text-red-700">{pdfError}</p> : null}
        <ReportNavigation caseId={caseId} attemptId={attemptId} />
      </ReportCard>
    </div>
  );
}

function EncounterTranscript({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No transcript was recorded.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-[var(--color-border)]">
      {messages.map((message) => (
        <li key={message.id} className="py-4 first:pt-0 last:pb-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {message.role === "student" ? "Provider" : "Patient"}
            {formatEncounterTranscriptTimestamp(message.timestamp)
              ? ` · ${formatEncounterTranscriptTimestamp(message.timestamp)}`
              : ""}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-secondary)]">
            {message.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ComparisonSection({ section }: { section: FacultyComparisonSection }) {
  return (
    <ReportCard title={section.title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3">Expected</th>
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.criterionId} className="border-b align-top">
                <td className="py-3 pr-3 font-medium">{row.itemName}</td>
                <td className="py-3 pr-3">{row.expected}</td>
                <td className="py-3 pr-3">{row.student}</td>
                <td className="py-3 pr-3 font-medium">{row.result}</td>
                <td className="py-3 text-[var(--color-text-secondary)]">
                  {row.evidence.join("; ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
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

function CollapsibleReportCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--elevation-subtle)]"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden"
      >
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <ChevronDown className="size-5 shrink-0 text-[var(--color-text-secondary)] transition-transform group-open:rotate-180" />
      </summary>
      <div id={contentId} className="px-5 pb-5">
        {children}
      </div>
    </details>
  );
}

function ResultMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
        {label}
      </p>
      <p className="mt-1 break-words text-2xl font-semibold">{value}</p>
      {description ? (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function GroupedStrengthList({
  groups,
}: {
  groups: Array<{
    competencyId: string;
    title: string;
    items: Array<FacultyReportStrength & { critical: boolean }>;
  }>;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No deterministic strengths were identified.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.competencyId}>
          <h3 className="text-sm font-semibold">{group.title}</h3>
          <ul className="mt-2 space-y-2">
            {group.items.map((strength) => (
              <li
                key={strength.criterionId}
                className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="min-w-0 break-words text-sm font-medium">
                    {strength.title}
                  </p>
                  {strength.critical ? (
                    <StatusBadge tone="success" label="Critical strength" />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function GroupedImprovementList({
  groups,
}: {
  groups: Array<{
    competencyId: string;
    title: string;
    items: Array<FacultyReportImprovementArea & { critical: boolean }>;
  }>;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No deterministic improvement areas were identified.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.competencyId}>
          <h3 className="text-sm font-semibold">{group.title}</h3>
          <ul className="mt-2 space-y-2">
            {group.items.map((improvement) => {
              const isUncertain = improvement.status === "uncertain";

              return (
                <li
                  key={improvement.criterionId}
                  className="rounded-xl border border-[var(--color-border)] bg-white p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {improvement.title}
                      </p>
                      {isUncertain ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                          This item could not be verified clearly from the
                          encounter and received no credit.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <StatusBadge
                        tone={isUncertain ? "warning" : "danger"}
                        label={
                          isUncertain
                            ? "Uncertain - No credit awarded"
                            : "Not Met"
                        }
                      />
                      {improvement.critical ? (
                        <StatusBadge tone="danger" label="Critical" />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CriterionSummaryList({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    meta: string;
    tone: StatusTone;
  }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-[var(--color-border)] bg-white p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="min-w-0 break-words text-sm font-medium">
              {item.title}
            </p>
            <StatusBadge tone={item.tone} label={item.meta} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CriterionDetail({
  criterion,
}: {
  criterion: FacultyReportCriterionResult;
}) {
  const evidenceText =
    criterion.evidence
      .map((evidence) => evidence.excerpt ?? evidence.eventId ?? evidence.source)
      .join("; ") || "None stored in the report artifact.";

  return (
    <section className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="break-words font-semibold">{criterion.title}</p>
          <p className="mt-1 break-words text-xs text-[var(--color-text-secondary)]">
            {criterion.criterionId} - {criterion.competency}
          </p>
        </div>
        <StatusBadge
          tone={getCriterionTone(criterion.status)}
          label={`${formatStatusLabel(criterion.status)}${
            criterion.critical ? " - Critical" : ""
          }`}
        />
      </div>

      <dl className="mt-3 grid gap-2 text-[var(--color-text-secondary)] md:grid-cols-2">
        <DetailTerm label="Evidence" value={evidenceText} />
        <DetailTerm label="Rationale" value={criterion.rationale ?? "None"} />
        <DetailTerm label="Confidence" value="Not stored in FacultyReport" />
        <DetailTerm
          label="Evaluation method"
          value="Not stored in FacultyReport"
        />
      </dl>
    </section>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm leading-6">{value}</dd>
    </div>
  );
}

function Notice({
  tone,
  title,
  message,
}: {
  tone: "warning" | "danger";
  title: string;
  message: string;
}) {
  const className =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span>{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const className = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function ReportNavigation({
  caseId,
  attemptId,
}: {
  caseId: string;
  attemptId?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Button
        asChild
        variant="outline"
        className="h-11 rounded-xl bg-[var(--color-surface)]"
      >
        <Link
          href={`/mentor/${caseId}?attemptId=${encodeURIComponent(attemptId ?? "")}`}
        >
          <ArrowLeft className="size-4" />
          Back to Mentor
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

function groupStrengthsByCompetency(
  strengths: FacultyReportStrength[],
  criterionById: Map<string, FacultyReportCriterionResult>,
) {
  const grouped = new Map<
    string,
    Array<FacultyReportStrength & { critical: boolean }>
  >();

  for (const strength of strengths) {
    const critical =
      criterionById.get(strength.criterionId)?.critical ?? false;
    const group = grouped.get(strength.competency) ?? [];
    group.push({ ...strength, critical });
    grouped.set(strength.competency, group);
  }

  return [...grouped.entries()]
    .sort(
      ([a], [b]) => getCompetencyOrderIndex(a) - getCompetencyOrderIndex(b),
    )
    .map(([competencyId, items]) => ({
      competencyId,
      title: getCompetencyTitle(competencyId),
      items: items.sort(
        (a, b) =>
          Number(b.critical) - Number(a.critical) ||
          a.displayPriority - b.displayPriority,
      ),
    }));
}

function groupImprovementsByCompetency(
  improvements: FacultyReportImprovementArea[],
  criterionById: Map<string, FacultyReportCriterionResult>,
) {
  const grouped = new Map<
    string,
    Array<FacultyReportImprovementArea & { critical: boolean }>
  >();

  for (const improvement of improvements) {
    const critical =
      criterionById.get(improvement.criterionId)?.critical ?? false;
    const group = grouped.get(improvement.competency) ?? [];
    group.push({ ...improvement, critical });
    grouped.set(improvement.competency, group);
  }

  return [...grouped.entries()]
    .sort(
      ([a], [b]) => getCompetencyOrderIndex(a) - getCompetencyOrderIndex(b),
    )
    .map(([competencyId, items]) => ({
      competencyId,
      title: getCompetencyTitle(competencyId),
      items: items.sort(
        (a, b) =>
          Number(b.critical) - Number(a.critical) ||
          Number(b.status === "uncertain") - Number(a.status === "uncertain") ||
          a.displayPriority - b.displayPriority,
      ),
    }));
}

function getCompetencyOrderIndex(competencyId: string) {
  const index = competencyOrder.indexOf(competencyId);
  return index === -1 ? competencyOrder.length : index;
}

function getCompetencyTitle(competencyId: string) {
  return competencyId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCompetencyTone(status: FacultyReportCompetencyStatus): StatusTone {
  if (status === "strong") {
    return "success";
  }
  if (status === "developing") {
    return "warning";
  }
  if (status === "needs-attention") {
    return "danger";
  }
  return "neutral";
}

function getCriterionTone(status: string): StatusTone {
  if (status === "met") {
    return "success";
  }
  if (status === "uncertain") {
    return "warning";
  }
  if (status === "not-applicable") {
    return "neutral";
  }
  return "danger";
}

function formatCompetencyStatus(value: FacultyReportCompetencyStatus) {
  if (value === "needs-attention") {
    return "Needs Attention";
  }
  return formatStatusLabel(value);
}

function formatStatusLabel(value: string) {
  if (value === "not-met") {
    return "Not Met";
  }
  if (value === "not-applicable") {
    return "Not Applicable";
  }
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
