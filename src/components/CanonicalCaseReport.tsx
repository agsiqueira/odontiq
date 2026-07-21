"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { FacultyCaseReport } from "@/components/FacultyCaseReport";
import { Button } from "@/components/ui/button";
import { getCaseById } from "@/lib/cases";
import {
  buildCanonicalFacultyPdfFilename,
  generateCanonicalFacultyPdfBlob,
} from "@/lib/facultyRubric/report/pdf";
import { buildCanonicalFacultyReportPresentation } from "@/lib/facultyRubric/report/presentation";
import { getStudentDisplayName } from "@/lib/facultyRubric/report/displayContent";
import {
  readCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "@/lib/localEncounter";
import type { ConversationMessage } from "@/lib/conversationEngine";
import { persistCompletedAttemptToServer } from "@/lib/persistence/completedAttemptClient";

type Status = "checking" | "generating" | "ready" | "missing" | "error";
type ServerReportArtifacts = {
  evaluation: CompletedEncounterAttempt["facultyRubricEvaluation"] | null;
  score: CompletedEncounterAttempt["facultyRubricScore"] | null;
  report: CompletedEncounterAttempt["facultyReport"] | null;
  transcript: ConversationMessage[];
};

export function CanonicalCaseReport({
  caseId,
  attemptId,
}: {
  caseId: string;
  attemptId?: string;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [summary, setSummary] = useState<CompletedEncounterAttempt | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
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
    let cancelled = false;
    const load = async () => {
      if (!attemptId) {
        setStatus("missing");
        return;
      }
      let candidate: CompletedEncounterAttempt | null = null;
      try {
        let response = await fetch(
          `/api/reports/${encodeURIComponent(attemptId)}`,
        );
        let payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok || !isServerReportArtifacts(payload)) throw new Error();
        if (!payload.evaluation || !payload.score || !payload.report) {
          const local = readCompletedEncounterAttempt(caseId, attemptId);
          if (local?.persistence.status === "pending-sync") {
            await persistCompletedAttemptToServer(local);
          }
          setStatus("generating");
          response = await fetch(`/api/reports/${encodeURIComponent(attemptId)}`, { method: "POST" });
          payload = await response.json().catch(() => undefined);
          if (!response.ok || !isServerReportArtifacts(payload)) throw new Error("server_report_generation_failed");
        }
        if (payload.evaluation && payload.score && payload.report) {
          candidate = {
            attemptId,
            caseId,
            conversationHistory: payload.transcript,
            coveredFacts: [],
            coveredChecklistItems: [],
            encounterEvents: [],
            examinationsViewed: [],
            savedAt: payload.report.reportMetadata.generatedAt,
            lifecycleStatus: "completed",
            persistence: {
              status: "synced",
              attempts: 0,
              updatedAt: payload.report.reportMetadata.generatedAt,
            },
            facultyRubricEvaluation: payload.evaluation,
            facultyRubricScore: payload.score,
            facultyReport: payload.report,
            facultyReportGeneration: {
              status: "complete",
              attemptId,
              startedAt: payload.report.reportMetadata.generatedAt,
              updatedAt: payload.report.reportMetadata.generatedAt,
            },
          };
        }
      } catch {
        candidate = readCompletedEncounterAttempt(caseId, attemptId);
      }
      if (!candidate) {
        candidate = readCompletedEncounterAttempt(caseId, attemptId);
      }
      if (cancelled) return;
      if (!candidate) {
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
    if (!summary || isRetrying) return;
    setIsRetrying(true);
    try {
      setStatus("generating");
      const response = await fetch(`/api/reports/${encodeURIComponent(summary.attemptId)}`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok || !isServerReportArtifacts(payload) || !payload.evaluation || !payload.score || !payload.report) {
        throw new Error("server_report_retry_failed");
      }
      window.location.reload();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Canonical faculty report retry failed.", {
          caseId,
          error: error instanceof Error ? error.message : "unknown_error",
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      setStatus("error");
    } finally {
      setIsRetrying(false);
    }
  }, [caseId, isRetrying, summary]);

  const downloadPdf = useCallback(async () => {
    if (isDownloadingPdf) return;
    if (!presentation) {
      setPdfError("The report must be successfully generated before it can be downloaded.");
      return;
    }
    setIsDownloadingPdf(true);
    setPdfError("");
    try {
      const blob = await generateCanonicalFacultyPdfBlob(presentation);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildCanonicalFacultyPdfFilename(presentation);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch {
      setPdfError("The PDF could not be generated. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [isDownloadingPdf, presentation]);

  if (
    status === "ready" &&
    summary &&
    presentation &&
    patientCase
  ) {
    return (
      <FacultyCaseReport
        caseId={caseId}
        attemptId={summary.attemptId}
        caseTitle={patientCase.openingStatement}
        patientName={patientCase.patientName}
        studentName={presentation.studentName}
        caseLabel={presentation.caseLabel}
        completedAt={presentation.completedAt}
        facultyReport={presentation.report}
        onDownloadPdf={() => void downloadPdf()}
        isDownloadingPdf={isDownloadingPdf}
        pdfError={pdfError}
        comparisonSections={presentation.comparisonSections}
        transcript={presentation.transcript}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <h1 className="text-xl font-semibold">
        {status === "missing"
          ? "No completed encounter"
          : status === "checking"
            ? "Checking report"
            : status === "generating"
            ? "Generating report"
            : "Report unavailable"}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {status === "missing"
          ? "Finish this consultation before opening its report."
          : status === "checking"
            ? "Loading the latest persisted report state."
            : status === "generating"
            ? "Your canonical faculty report is still being generated."
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

function isServerReportArtifacts(value: unknown): value is ServerReportArtifacts {
  return Boolean(
    value &&
      typeof value === "object" &&
      "evaluation" in value &&
      "transcript" in value &&
      Array.isArray((value as { transcript?: unknown }).transcript),
  );
}
