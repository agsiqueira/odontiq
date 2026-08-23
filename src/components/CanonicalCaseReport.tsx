"use client";

import { useUser } from "@clerk/nextjs";
import { Check, Circle, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LearnerCaseReport } from "@/components/LearnerCaseReport";
import { Button } from "@/components/ui/button";
import { getCaseById } from "@/lib/cases";
import { buildCanonicalFacultyReportPresentation } from "@/lib/facultyRubric/report/presentation";
import { getStudentDisplayName } from "@/lib/facultyRubric/report/displayContent";
import {
  type CompletedEncounterAttempt,
} from "@/lib/localEncounter";
import type { ConversationMessage } from "@/lib/conversationEngine";
import { waitForGenerationCompletion } from "@/lib/facultyRubric/report/generationOwnership";

type Status = "checking" | "generating" | "ready" | "missing" | "error";
type ReportGenerationStage =
  | "saving"
  | "preparing"
  | "evaluating"
  | "building"
  | "finalizing"
  | "complete";

const REPORT_GENERATION_STAGES: Array<{
  id: Exclude<ReportGenerationStage, "complete">;
  title: string;
  description?: string;
}> = [
  { id: "saving", title: "Saving consultation" },
  { id: "preparing", title: "Preparing encounter" },
  {
    id: "evaluating",
    title: "Evaluating clinical performance",
    description: "This usually takes 10–20 seconds.",
  },
  { id: "building", title: "Building faculty report" },
  { id: "finalizing", title: "Finalizing report" },
];

const REPORT_GENERATION_PROGRESS: Record<ReportGenerationStage, number> = {
  saving: 10,
  preparing: 20,
  evaluating: 60,
  building: 90,
  finalizing: 100,
  complete: 100,
};
type ServerReportArtifacts = {
  status: "complete";
  caseId: string;
  evaluation: CompletedEncounterAttempt["facultyRubricEvaluation"] | null;
  score: CompletedEncounterAttempt["facultyRubricScore"] | null;
  report: CompletedEncounterAttempt["facultyReport"] | null;
  transcript: ConversationMessage[];
};
type ServerReportInProgress = {
  status: "in-progress";
  stage: "evaluating";
  retryAfterMs: number;
};
type ServerReportPending = {
  status: "pending" | "failed";
  caseId: string;
  evaluation: CompletedEncounterAttempt["facultyRubricEvaluation"] | null;
  score: CompletedEncounterAttempt["facultyRubricScore"] | null;
  report: CompletedEncounterAttempt["facultyReport"] | null;
  transcript: ConversationMessage[];
};
type ServerReportResponse =
  | ServerReportArtifacts
  | ServerReportInProgress
  | ServerReportPending;

const REPORT_STATUS_POLL_INTERVAL_MS = 2_500;
const REPORT_STATUS_POLL_TIMEOUT_MS = 120_000;

export function CanonicalCaseReport({
  caseId,
  attemptId,
}: {
  caseId: string;
  attemptId?: string;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [generationStage, setGenerationStage] =
    useState<ReportGenerationStage>("saving");
  const [summary, setSummary] = useState<CompletedEncounterAttempt | null>(null);
  const [serverTranscript, setServerTranscript] =
    useState<ConversationMessage[] | null>(null);
  const [isAutomaticallyRetrying, setIsAutomaticallyRetrying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const mountedRef = useRef(true);
  const { user } = useUser();
  const patientCase = getCaseById(caseId);
  const presentation =
    summary && patientCase
      ? buildCanonicalFacultyReportPresentation(
          summary,
          patientCase.patientName,
          patientCase.openingStatement,
          {
            studentName: user ? getStudentDisplayName(user) : undefined,
            attemptId: summary.attemptId,
          },
        )
      : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!attemptId) {
        setStatus("missing");
        return;
      }
      let candidate: CompletedEncounterAttempt | null = null;
      let confirmedTranscript: ConversationMessage[] | null = null;
      try {
        let payload = await requestReport(attemptId);
        if (payload.status !== "in-progress") {
          if (payload.caseId !== caseId) {
            throw new Error("server_report_case_mismatch");
          }
          confirmedTranscript = payload.transcript.map((message) => ({ ...message }));
          setServerTranscript(confirmedTranscript);
        }
        if (payload.status === "failed") {
          setSummary(null);
          setStatus("ready");
          return;
        }

        const participatesInInitialGeneration =
          payload.status === "pending" || payload.status === "in-progress";
        let initialGenerationFailed = false;
        if (payload.status === "pending") {
          setGenerationStage("preparing");
          setStatus("generating");
          setGenerationStage("evaluating");
          try {
            payload = await generateOrJoinReport(attemptId, () => cancelled);
          } catch {
            initialGenerationFailed = true;
          }
        } else if (payload.status === "in-progress") {
          setStatus("generating");
          setGenerationStage("evaluating");
          try {
            const joined = await waitForExistingReport(attemptId, () => cancelled);
            if (!joined) return;
            payload = joined;
          } catch {
            initialGenerationFailed = true;
          }
        }
        if (!initialGenerationFailed && payload.status !== "in-progress") {
          if (payload.caseId !== caseId) {
            throw new Error("server_report_case_mismatch");
          }
          confirmedTranscript = payload.transcript.map((message) => ({ ...message }));
          setServerTranscript(confirmedTranscript);
        }

        if (initialGenerationFailed) {
          try {
            const recovered = await requestReport(attemptId);
            if (recovered.status !== "in-progress") {
              if (recovered.caseId !== caseId) {
                throw new Error("server_report_case_mismatch");
              }
              payload = recovered;
              confirmedTranscript = recovered.transcript.map((message) => ({
                ...message,
              }));
              setServerTranscript(confirmedTranscript);
            }
          } catch {
            // The bounded retry can proceed without exposing or substituting data.
          }
        }
        candidate = buildCompletedReportSummaryIfAvailable({
          attemptId,
          caseId,
          payload,
        });
        if (!candidate && participatesInInitialGeneration) {
          setIsAutomaticallyRetrying(true);
          setStatus(confirmedTranscript ? "ready" : "generating");
          try {
            payload = await generateOrJoinReport(attemptId, () => cancelled);
            if (payload.status !== "in-progress") {
              if (payload.caseId !== caseId) {
                throw new Error("server_report_case_mismatch");
              }
              confirmedTranscript = payload.transcript.map((message) => ({ ...message }));
              setServerTranscript(confirmedTranscript);
            }
            candidate = buildCompletedReportSummaryIfAvailable({
              attemptId,
              caseId,
              payload,
            });
          } finally {
            if (!cancelled) setIsAutomaticallyRetrying(false);
          }
        }
        if (candidate) {
          setGenerationStage("building");
          setGenerationStage("finalizing");
        }
      } catch {
        if (!confirmedTranscript) {
          try {
            const recovered = await requestReport(attemptId);
            if (recovered.status !== "in-progress" && recovered.caseId === caseId) {
              confirmedTranscript = recovered.transcript.map((message) => ({ ...message }));
              setServerTranscript(confirmedTranscript);
            }
          } catch {
            // Missing and unauthorized attempts remain indistinguishable.
          }
        }
      }
      if (cancelled) return;
      if (!candidate) {
        if (confirmedTranscript) {
          setSummary(null);
          setStatus("ready");
          return;
        }
        setStatus("missing");
        return;
      }
      try {
        setSummary(candidate);
        const generationStatus = candidate.facultyReportGeneration?.status;
        if (
          candidate.facultyRubricEvaluation?.status === "complete" &&
          candidate.facultyRubricScore &&
          candidate.facultyReport
        ) {
          setGenerationStage("complete");
          setStatus("ready");
        } else if (
          generationStatus === "pending" ||
          generationStatus === "in-progress"
        ) {
          setStatus("error");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [attemptId, caseId]);

  const retry = useCallback(async () => {
    if (!attemptId || !serverTranscript || isRetrying) return;
    setIsRetrying(true);
    try {
      let payload = await requestReport(attemptId, "POST");
      if (payload.status === "in-progress") {
        const joined = await waitForExistingReport(
          attemptId,
          () => !mountedRef.current,
        );
        if (!joined) throw new Error("server_report_generation_timeout");
        payload = joined;
      }
      if (
        payload.status !== "complete" ||
        !payload.evaluation ||
        !payload.score ||
        !payload.report
      ) {
        throw new Error("server_report_retry_failed");
      }
      if (payload.caseId !== caseId) {
        throw new Error("server_report_case_mismatch");
      }
      setServerTranscript(payload.transcript.map((message) => ({ ...message })));
      setSummary(buildCompletedReportSummary({ attemptId, caseId, payload }));
      setStatus("ready");
    } catch {
      setStatus("ready");
    } finally {
      setIsRetrying(false);
    }
  }, [attemptId, caseId, isRetrying, serverTranscript]);

  if (
    status === "ready" &&
    serverTranscript &&
    patientCase
  ) {
    return (
      <LearnerCaseReport
        caseId={caseId}
        caseTitle={patientCase.openingStatement}
        patientName={patientCase.patientName}
        caseLabel={presentation?.caseLabel}
        completedAt={presentation?.completedAt}
        facultyReport={presentation?.report}
        transcript={presentation?.transcript ?? serverTranscript}
        feedbackState={
          isAutomaticallyRetrying
            ? "automatic-retrying"
            : isRetrying
              ? "retrying"
              : presentation
                ? "available"
                : "failed"
        }
        onRetryFeedback={
          presentation || isAutomaticallyRetrying ? undefined : () => void retry()
        }
      />
    );
  }

  if (status === "checking" || status === "generating") {
    return <FacultyReportGenerationProgress stage={generationStage} />;
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <h1 className="text-xl font-semibold">
        {status === "missing"
          ? "No completed encounter"
          : "Report unavailable"}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {status === "missing"
          ? "Finish this consultation before opening its report."
          : "Report generation was interrupted. Please try again."}
      </p>
      {status === "error" ? (
        <Button
          type="button"
          className="mt-4"
          disabled={isRetrying}
          onClick={() => void retry()}
        >
          {isRetrying ? "Retrying…" : "Retry report generation"}
        </Button>
      ) : null}
    </section>
  );
}

function buildCompletedReportSummary({
  attemptId,
  caseId,
  payload,
}: {
  attemptId: string;
  caseId: string;
  payload: ServerReportArtifacts;
}): CompletedEncounterAttempt {
  const generatedAt = payload.report?.reportMetadata.generatedAt ?? new Date().toISOString();
  return {
    attemptId,
    caseId,
    conversationHistory: payload.transcript,
    coveredFacts: [],
    coveredChecklistItems: [],
    encounterEvents: [],
    examinationsViewed: [],
    savedAt: generatedAt,
    lifecycleStatus: "completed",
    persistence: { status: "synced", attempts: 0, updatedAt: generatedAt },
    facultyRubricEvaluation: payload.evaluation ?? undefined,
    facultyRubricScore: payload.score ?? undefined,
    facultyReport: payload.report ?? undefined,
    facultyReportGeneration: {
      status: "complete",
      attemptId,
      startedAt: generatedAt,
      updatedAt: generatedAt,
    },
  };
}

function buildCompletedReportSummaryIfAvailable({
  attemptId,
  caseId,
  payload,
}: {
  attemptId: string;
  caseId: string;
  payload: ServerReportResponse;
}) {
  return payload.status === "complete" &&
    payload.evaluation &&
    payload.score &&
    payload.report
    ? buildCompletedReportSummary({ attemptId, caseId, payload })
    : null;
}

function FacultyReportGenerationProgress({
  stage,
}: {
  stage: ReportGenerationStage;
}) {
  const currentStageIndex =
    stage === "complete"
      ? REPORT_GENERATION_STAGES.length
      : REPORT_GENERATION_STAGES.findIndex((item) => item.id === stage);
  const progress = REPORT_GENERATION_PROGRESS[stage];

  return (
    <section
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm"
      aria-labelledby="faculty-report-progress-title"
      aria-live="polite"
    >
      <div className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-brand)_5%,white)] px-5 py-5 sm:px-7">
        <p className="text-sm font-semibold text-[var(--color-brand)]">
          Faculty feedback
        </p>
        <h1
          id="faculty-report-progress-title"
          className="mt-1 text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl"
        >
          Generating Faculty Report
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          We’re reviewing your consultation and preparing personalized feedback.
        </p>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-7">
        <ol className="space-y-4">
          {REPORT_GENERATION_STAGES.map((item, index) => {
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <li key={item.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                  {isComplete ? (
                    <Check
                      className="size-5 text-emerald-600"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  ) : isCurrent ? (
                    <LoaderCircle
                      className="size-5 animate-spin text-[var(--color-brand)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="size-4 text-[var(--color-text-secondary)] opacity-45"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      isCurrent
                        ? "font-semibold text-[var(--color-text-primary)]"
                        : isComplete
                          ? "font-medium text-[var(--color-text-primary)]"
                          : "font-medium text-[var(--color-text-secondary)] opacity-65"
                    }
                  >
                    {item.title}
                    {isCurrent ? "…" : ""}
                  </p>
                  {isCurrent && item.description ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        <div>
          <div
            className="relative h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-brand)_12%,white)]"
            role="progressbar"
            aria-label="Faculty report generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="relative h-full overflow-hidden rounded-full bg-[var(--color-brand)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              {stage === "evaluating" ? (
                <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">
            {progress}%
          </p>
        </div>
      </div>
    </section>
  );
}

async function requestReport(
  attemptId: string,
  method: "GET" | "POST" = "GET",
): Promise<ServerReportResponse> {
  const response = await fetch(`/api/reports/${encodeURIComponent(attemptId)}`, {
    method,
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok || !isServerReportResponse(payload)) {
    throw new Error("server_report_request_failed");
  }
  return payload;
}

async function waitForExistingReport(
  attemptId: string,
  isCancelled: () => boolean,
) {
  return waitForGenerationCompletion({
    load: () => requestReport(attemptId),
    sleep: () =>
      new Promise((resolve) =>
        window.setTimeout(resolve, REPORT_STATUS_POLL_INTERVAL_MS),
      ),
    isCancelled,
    maxChecks: Math.ceil(
      REPORT_STATUS_POLL_TIMEOUT_MS / REPORT_STATUS_POLL_INTERVAL_MS,
    ),
  });
}

async function generateOrJoinReport(
  attemptId: string,
  isCancelled: () => boolean,
) {
  const payload = await requestReport(attemptId, "POST");
  if (payload.status !== "in-progress") return payload;
  const joined = await waitForExistingReport(attemptId, isCancelled);
  if (!joined) throw new Error("server_report_generation_timeout");
  return joined;
}

function isServerReportResponse(value: unknown): value is ServerReportResponse {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  const status = (value as { status?: unknown }).status;
  if (status === "in-progress") {
    return (
      (value as { stage?: unknown }).stage === "evaluating" &&
      typeof (value as { retryAfterMs?: unknown }).retryAfterMs === "number"
    );
  }
  return Boolean(
    (status === "complete" || status === "pending" || status === "failed") &&
      "evaluation" in value &&
      "transcript" in value &&
      Array.isArray((value as { transcript?: unknown }).transcript),
  );
}
