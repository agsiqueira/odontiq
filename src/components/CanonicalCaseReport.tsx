"use client";

import { useCallback, useEffect, useState } from "react";

import { FacultyCaseReport } from "@/components/FacultyCaseReport";
import { Button } from "@/components/ui/button";
import { getCaseById } from "@/lib/cases";
import { ensureCanonicalFacultyArtifacts } from "@/lib/facultyRubric/report/clientGeneration";
import {
  buildCanonicalFacultyPdfFilename,
  generateCanonicalFacultyPdfBlob,
} from "@/lib/facultyRubric/report/pdf";
import { buildCanonicalFacultyReportPresentation } from "@/lib/facultyRubric/report/presentation";
import {
  readCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "@/lib/localEncounter";

type Status = "checking" | "generating" | "ready" | "missing" | "error";

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
  const patientCase = getCaseById(caseId);
  const presentation =
    summary && patientCase
      ? buildCanonicalFacultyReportPresentation(
          summary,
          patientCase.patientName,
          patientCase.openingStatement,
        )
      : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!attemptId) {
        setStatus("missing");
        return;
      }
      const candidate = readCompletedEncounterAttempt(caseId, attemptId);
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
          setStatus("generating");
          void ensureCanonicalFacultyArtifacts({ caseId, attemptId }).then((result) => {
            setSummary(result.summary);
            setStatus(result.status === "complete" ? "ready" : "error");
          }).catch(() => setStatus("error"));
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [attemptId, caseId]);

  const retry = useCallback(async () => {
    if (!summary || isRetrying) return;
    setIsRetrying(true);
    try {
      setStatus("generating");
      const result = await ensureCanonicalFacultyArtifacts({
        caseId,
        attemptId: summary.attemptId,
        forceRetry: true,
      });
      setSummary(result.summary);
      setStatus(result.status === "complete" ? "ready" : "error");
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
        facultyReport={presentation.report}
        onDownloadPdf={() => void downloadPdf()}
        isDownloadingPdf={isDownloadingPdf}
        pdfError={pdfError}
        comparisonSections={presentation.comparisonSections}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <h1 className="text-xl font-semibold">
        {status === "missing"
          ? "No completed encounter"
          : status === "generating"
            ? "Generating report"
            : "Report unavailable"}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {status === "missing"
          ? "Finish this consultation before opening its report."
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
