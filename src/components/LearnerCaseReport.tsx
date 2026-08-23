"use client";

import Link from "next/link";
import { Download, Home, ListRestart } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import type { ConversationMessage } from "@/lib/conversationEngine";
import type { FacultyReport } from "@/lib/facultyRubric/report";
import {
  formatEncounterTranscriptTimestamp,
  formatFacultyReportPercent,
} from "@/lib/facultyRubric/report/displayContent";
import { getLearnerInterfaceText } from "@/lib/interfaceTerminology";
import {
  buildLearnerTranscriptFilename,
  buildLearnerTranscriptText,
} from "@/lib/learnerTranscriptDownload";

type LearnerCaseReportProps = {
  caseId: string;
  caseTitle: string;
  patientName: string;
  caseLabel?: string;
  completedAt?: string;
  facultyReport?: FacultyReport;
  transcript: ConversationMessage[];
  feedbackState?: "available" | "failed" | "automatic-retrying" | "retrying";
  onRetryFeedback?: () => void;
};

export function LearnerCaseReport({
  caseId,
  caseTitle,
  patientName,
  caseLabel,
  completedAt,
  facultyReport,
  transcript,
  feedbackState = facultyReport ? "available" : "failed",
  onRetryFeedback,
}: LearnerCaseReportProps) {
  const strengths = facultyReport ? facultyReport.strengths.slice(0, 3) : [];
  const improvements = facultyReport
    ? facultyReport.improvementAreas
        .filter((item) => item.status === "not-met")
        .slice(0, 3)
    : [];

  const downloadTranscript = useCallback(() => {
    const text = buildLearnerTranscriptText(
      { patientName, caseTitle, caseLabel, completedAt },
      transcript,
    );
    const url = window.URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = buildLearnerTranscriptFilename(caseId);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }, [caseId, caseLabel, caseTitle, completedAt, patientName, transcript]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Consultation Report
            </h1>
            <p className="mt-3 break-words text-lg font-semibold">{patientName}</p>
            <p className="mt-1 break-words text-sm leading-6 text-[var(--color-text-secondary)]">
              {caseLabel ? `${caseLabel} · ` : ""}{caseTitle}
            </p>
          </div>
          {facultyReport ? (
            <div className="w-full shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] px-5 py-4 sm:w-auto sm:min-w-40">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
                Overall score
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatFacultyReportPercent(facultyReport.overallScore.percentage)}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {facultyReport ? (
        <>
          <FeedbackSection title="Strengths" items={strengths.map((item) => item.title)} />
          <FeedbackSection
            title="Areas for Improvement"
            items={improvements.map((item) => item.title)}
          />
        </>
      ) : (
        <FeedbackUnavailableSection
          feedbackState={feedbackState}
          onRetry={onRetryFeedback}
        />
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Consultation Transcript</h2>
          <Button type="button" variant="outline" className="h-11" onClick={downloadTranscript}>
            <Download className="size-4" aria-hidden="true" />
            Download Transcript
          </Button>
        </div>
        <div className="mt-4 max-h-[36rem] overflow-y-auto overscroll-contain pr-1">
          <EncounterTranscript messages={transcript} />
        </div>
      </section>

      <nav aria-label="Report actions" className="grid gap-3 pb-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-11 rounded-xl bg-[var(--color-surface)]">
          <Link href="/cases">
            <ListRestart className="size-4" aria-hidden="true" />
            Try Another Case
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl bg-[var(--color-surface)]">
          <Link href="/home">
            <Home className="size-4" aria-hidden="true" />
            Return Home
          </Link>
        </Button>
      </nav>
    </div>
  );
}

function FeedbackUnavailableSection({
  feedbackState,
  onRetry,
}: {
  feedbackState: "available" | "failed" | "automatic-retrying" | "retrying";
  onRetry?: () => void;
}) {
  const isRetrying = feedbackState === "retrying";
  const isAutomaticallyRetrying = feedbackState === "automatic-retrying";

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)] sm:p-6">
      <h2 className="text-lg font-semibold">Personalized feedback</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]" role="status">
        {isAutomaticallyRetrying
          ? "The first attempt was interrupted. OdontIQ is retrying your personalized feedback. Please keep this page open."
          : isRetrying
            ? "OdontIQ is retrying your personalized feedback. Please keep this page open."
            : "Personalized feedback was not generated. Your encounter and transcript were saved. Select ‘Retry personalized feedback’ below to try again without repeating the encounter."}
      </p>
      {onRetry ? (
        <Button
          type="button"
          className="mt-4 h-11"
          disabled={isRetrying}
          onClick={onRetry}
        >
          {isRetrying ? "Retrying personalized feedback…" : "Retry personalized feedback"}
        </Button>
      ) : null}
    </section>
  );
}

function FeedbackSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)] sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="break-words rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm font-medium leading-6">
              {getLearnerInterfaceText(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No items were identified for this consultation.
        </p>
      )}
    </section>
  );
}

function EncounterTranscript({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No transcript was recorded.</p>;
  }

  return (
    <ol className="divide-y divide-[var(--color-border)]">
      {messages.map((message) => (
        <li key={message.id} className="py-4 first:pt-0 last:pb-0">
          <p className="text-sm font-semibold">
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
