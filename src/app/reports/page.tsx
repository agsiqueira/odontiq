"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { CASES, type OdontIQCase } from "@/lib/cases";
import {
  readCompletedEncounterStore,
  readEncounterSnapshots,
  type CompletedEncounterAttempt,
} from "@/lib/localEncounter";

type ReportCardStatus =
  | "not-started"
  | "in-progress"
  | "generating"
  | "completed"
  | "interrupted";

type ReportCard = {
  patientCase: OdontIQCase;
  status: ReportCardStatus;
  completedAt?: string;
  score?: number;
  attemptId?: string;
};

type DashboardAttempt = {
  caseId: string;
  latestAttemptId: string;
  generationStatus: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "FAILED";
  integrityStatus: "PENDING" | "VALID" | "INVALID";
  percentage: number | null;
  passed: boolean;
  completedAt: string | null;
};

const statusDetails: Record<
  ReportCardStatus,
  { label: string; action: string; rank: number; badgeClassName: string }
> = {
  generating: {
    label: "Generating Report",
    action: "Progress",
    rank: 0,
    badgeClassName:
      "bg-[color-mix(in_srgb,var(--color-retry)_14%,white)] text-[var(--color-retry)]",
  },
  interrupted: {
    label: "Report Interrupted",
    action: "Retry",
    rank: 1,
    badgeClassName:
      "bg-[color-mix(in_srgb,var(--color-emergency)_12%,white)] text-[var(--color-emergency)]",
  },
  "in-progress": {
    label: "In Progress",
    action: "Resume",
    rank: 2,
    badgeClassName:
      "bg-[color-mix(in_srgb,var(--color-brand)_12%,white)] text-[var(--color-brand)]",
  },
  completed: {
    label: "Completed",
    action: "View Report",
    rank: 3,
    badgeClassName:
      "bg-[color-mix(in_srgb,var(--color-action)_12%,white)] text-[var(--color-action)]",
  },
  "not-started": {
    label: "Not Started",
    action: "Start",
    rank: 4,
    badgeClassName:
      "border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)]",
  },
};

export default function ReportsPage() {
  const [cards, setCards] = useState<ReportCard[] | null>(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/reports/dashboard");
        const payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok || !isDashboardAttempts(payload)) throw new Error();
        if (!cancelled) {
          setCards(reportCardsFromDashboard(payload));
          setIsCached(false);
        }
      } catch {
        if (!cancelled) {
          setCards(readCachedReportCards());
          setIsCached(true);
        }
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = cards?.filter((card) => card.status === "completed").length ?? 0;
  const active =
    cards?.filter((card) =>
      ["in-progress", "generating", "interrupted"].includes(card.status),
    ).length ?? 0;
  const remaining = cards?.filter((card) => card.status === "not-started").length ?? 0;

  return (
    <AppShell title="Reports" showSettings className="space-y-5">
      <section>
        <p className="text-base leading-7 text-[var(--color-text-secondary)]">
          Continue where you left off or review previous reports.
        </p>
        {isCached ? (
          <span className="mt-2 inline-flex rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
            Cached
          </span>
        ) : null}
      </section>

      <section
        aria-label="Case report summary"
        className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--elevation-subtle)] sm:grid-cols-4"
      >
        <SummaryMetric label="Cases" value={CASES.length} />
        <SummaryMetric label="Completed" value={completed} />
        <SummaryMetric label="Active" value={active} />
        <SummaryMetric label="Remaining" value={remaining} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {cards === null
          ? CASES.map((patientCase) => (
              <div
                key={patientCase.id}
                className="h-60 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              />
            ))
          : cards.map((card) => <ReportCaseCard key={card.patientCase.id} card={card} />)}
      </section>
    </AppShell>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-3xl font-semibold leading-none text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
    </div>
  );
}

function ReportCaseCard({ card }: { card: ReportCard }) {
  const details = statusDetails[card.status];
  return (
    <article className="flex h-60 min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)]">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-tight text-[var(--color-text-primary)]">
          {card.patientCase.patientName}
        </h2>
        <span className="mt-2 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {formatCaseNumber(card.patientCase.id)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-[var(--color-text-secondary)]">
        {card.patientCase.title}
      </p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3">
        <div className="min-w-0 flex-1 basis-36">
          {card.status === "completed" && card.completedAt ? (
            <p className="mb-1.5 truncate text-xs text-[var(--color-text-secondary)]">
              Completed {formatCompletionDate(card.completedAt)}
            </p>
          ) : null}
          <div
            className={`flex flex-wrap items-center gap-2 ${
              card.status === "completed" ? "justify-between" : ""
            }`}
          >
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${details.badgeClassName}`}
            >
              {card.status === "completed" ? "✓ " : ""}
              {details.label}
            </span>
            {card.status === "completed" && card.score !== undefined ? (
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {formatScore(card.score)}
              </span>
            ) : null}
          </div>
          {card.status !== "completed" && card.completedAt ? (
            <p className="mt-1.5 truncate text-xs text-[var(--color-text-secondary)]">
              Completed {formatCompletionDate(card.completedAt)}
            </p>
          ) : null}
        </div>
        <Link
          href={getActionHref(card)}
          className="inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--color-brand)] px-2.5 text-xs font-semibold text-white"
        >
          {details.action}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function readCachedReportCards(): ReportCard[] {
  const snapshots = readEncounterSnapshots();
  const completedStore = readCompletedEncounterStore();
  return CASES.map((patientCase) => {
    const newestAttempt = completedStore[patientCase.id]?.[0];
    if (newestAttempt) {
      return cardFromCompletedSummary(patientCase, newestAttempt);
    }
    if (snapshots[patientCase.id]) {
      return { patientCase, status: "in-progress" as const };
    }
    return { patientCase, status: "not-started" as const };
  }).sort(compareReportCards);
}

function reportCardsFromDashboard(attempts: DashboardAttempt[]): ReportCard[] {
  const byCase = new Map(attempts.map((attempt) => [attempt.caseId, attempt]));
  return CASES.map((patientCase) => {
    const attempt = byCase.get(patientCase.id);
    if (!attempt) return { patientCase, status: "not-started" as const };
    const completedAt = attempt.completedAt ?? undefined;
    if (
      attempt.generationStatus === "COMPLETE" &&
      attempt.integrityStatus === "VALID"
    ) {
      return {
        patientCase,
        status: "completed" as const,
        completedAt,
        score: attempt.percentage ?? undefined,
        attemptId: attempt.latestAttemptId,
      };
    }
    if (
      attempt.generationStatus === "PENDING" ||
      attempt.generationStatus === "IN_PROGRESS"
    ) {
      return {
        patientCase,
        status: "generating" as const,
        completedAt,
        attemptId: attempt.latestAttemptId,
      };
    }
    return {
      patientCase,
      status: "interrupted" as const,
      completedAt,
      attemptId: attempt.latestAttemptId,
    };
  }).sort(compareReportCards);
}

function isDashboardAttempts(value: unknown): value is DashboardAttempt[] {
  return (
    Array.isArray(value) &&
    value.every(
      (attempt) =>
        Boolean(attempt) &&
        typeof attempt === "object" &&
        typeof (attempt as DashboardAttempt).caseId === "string" &&
        typeof (attempt as DashboardAttempt).latestAttemptId === "string" &&
        typeof (attempt as DashboardAttempt).generationStatus === "string",
    )
  );
}

function cardFromCompletedSummary(
  patientCase: OdontIQCase,
  summary: CompletedEncounterAttempt,
): ReportCard {
  const generationStatus = summary.facultyReportGeneration?.status;
  const hasCompleteCanonicalReport = Boolean(
    generationStatus === "complete" &&
      summary.facultyRubricEvaluation?.status === "complete" &&
      summary.facultyRubricScore?.status === "complete" &&
      summary.facultyReport,
  );
  const completedAt = summary.metadata?.completedAt ?? summary.savedAt;

  if (hasCompleteCanonicalReport) {
    return {
      patientCase,
      status: "completed",
      completedAt,
      score: summary.facultyRubricScore?.percentage ?? undefined,
      attemptId: summary.attemptId,
    };
  }
  if (generationStatus === "pending" || generationStatus === "in-progress") {
    return { patientCase, status: "generating", completedAt, attemptId: summary.attemptId };
  }
  return { patientCase, status: "interrupted", completedAt, attemptId: summary.attemptId };
}

function compareReportCards(left: ReportCard, right: ReportCard) {
  const rankDifference = statusDetails[left.status].rank - statusDetails[right.status].rank;
  if (rankDifference !== 0) return rankDifference;
  if (left.status === "completed" && right.status === "completed") {
    return Date.parse(right.completedAt ?? "") - Date.parse(left.completedAt ?? "");
  }
  return CASES.indexOf(left.patientCase) - CASES.indexOf(right.patientCase);
}

function getActionHref(card: ReportCard) {
  if (card.status === "in-progress") return `/encounter/${card.patientCase.id}`;
  if (card.status === "not-started") return `/encounter/${card.patientCase.id}`;
  const attemptQuery = `?attemptId=${encodeURIComponent(card.attemptId ?? "")}`;
  if (card.status === "generating") {
    return `/mentor/${card.patientCase.id}${attemptQuery}`;
  }
  return `/reports/${card.patientCase.id}${attemptQuery}`;
}

function formatCompletionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatScore(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatCaseNumber(caseId: string) {
  const number = Number(caseId.match(/\d+/)?.[0]);
  return Number.isFinite(number) ? `Case ${number}` : caseId;
}
