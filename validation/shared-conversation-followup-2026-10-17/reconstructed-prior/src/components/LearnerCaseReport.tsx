"use client";

import Link from "next/link";
import { Download, Home, ListRestart } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ConversationMessage } from "@/lib/conversationEngine";
import type { FacultyReport } from "@/lib/facultyRubric/report";
import { formatEncounterTranscriptTimestamp } from "@/lib/facultyRubric/report/displayContent";
import { getLearnerInterfaceText } from "@/lib/interfaceTerminology";
import {
  buildLearnerReportPdfFilename,
  generateLearnerReportPdfBlob,
  type LearnerReportPdfModel,
} from "@/lib/learnerReportPdf";

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
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const downloadInProgressRef = useRef(false);
  const strengths = useMemo(
    () => facultyReport
      ? facultyReport.strengths.slice(0, 3)
          .map((item) => getLearnerInterfaceText(item.title))
      : [],
    [facultyReport],
  );
  const improvements = useMemo(
    () => facultyReport
      ? facultyReport.improvementAreas
          .filter((item) => item.status === "not-met")
          .slice(0, 3)
          .map((item) => getLearnerInterfaceText(item.title))
      : [],
    [facultyReport],
  );

  const downloadPdfReport = useCallback(async () => {
    if (downloadInProgressRef.current || isPreparingPdf) return;
    downloadInProgressRef.current = true;
    setIsPreparingPdf(true);
    setPdfError(false);
    let url: string | undefined;
    try {
      const model: LearnerReportPdfModel = {
        caseId,
        caseLabel: caseLabel ?? caseId,
        patientName,
        complaint: caseTitle,
        completedAt,
        feedback: facultyReport
          ? { status: "available", strengths, improvementAreas: improvements }
          : { status: "unavailable" },
        transcript: transcript.map(({ role, text, timestamp }) => ({
          role,
          text,
          timestamp,
        })),
      };
      const blob = await Promise.resolve(generateLearnerReportPdfBlob(model));
      url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildLearnerReportPdfFilename(caseId);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setPdfError(true);
    } finally {
      if (url) window.URL.revokeObjectURL(url);
      downloadInProgressRef.current = false;
      setIsPreparingPdf(false);
    }
  }, [
    caseId,
    caseLabel,
    caseTitle,
    completedAt,
    facultyReport,
    improvements,
    isPreparingPdf,
    patientName,
    strengths,
    transcript,
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--elevation-subtle)] sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
            Consultation Report
          </h1>
          <p className="mt-3 break-words text-lg font-semibold">{patientName}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[var(--color-text-secondary)]">
            {caseLabel ? `${caseLabel} · ` : ""}{caseTitle}
          </p>
        </div>
      </section>

      {facultyReport ? (
        <>
          <FeedbackSection title="Strengths" items={strengths} />
          <FeedbackSection
            title="Areas for Improvement"
            items={improvements}
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
          <Button
            type="button"
            variant="outline"
            className="h-11"
            aria-label="Download PDF Report"
            disabled={isPreparingPdf}
            onClick={() => void downloadPdfReport()}
          >
            <Download className="size-4" aria-hidden="true" />
            {isPreparingPdf ? "Preparing PDF…" : "Download PDF Report"}
          </Button>
        </div>
        {pdfError ? (
          <p className="mt-3 text-sm text-red-700" role="status">
            The PDF report could not be downloaded. Please try again.
          </p>
        ) : null}
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
              {item}
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
