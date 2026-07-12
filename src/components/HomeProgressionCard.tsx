"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PatientProfileCard } from "@/components/PatientProfileCard";
import { CASES } from "@/lib/cases";
import { getHomeProgression, type HomeProgression } from "@/lib/homeProgression";
import {
  readCompletedEncounterStore,
  readEncounterSnapshots,
} from "@/lib/localEncounter";

export function HomeProgressionCard() {
  const [progression, setProgression] = useState<HomeProgression | null>(null);

  useEffect(() => {
    const refresh = () =>
      setProgression(
        getHomeProgression({
          cases: CASES,
          snapshots: readEncounterSnapshots(),
          completedStore: readCompletedEncounterStore(),
        }),
      );
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  if (!progression) {
    return (
      <div className="h-80 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
    );
  }

  if (progression.kind === "complete") {
    return (
      <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--elevation-subtle)]">
        <p className="text-sm font-semibold text-[var(--color-brand)]">Continue Learning</p>
        <CheckCircle2 className="mt-6 size-12 text-[var(--color-action)]" />
        <h1 className="mt-4 text-2xl font-semibold">All cases completed</h1>
        <p className="mt-3 leading-7 text-[var(--color-text-secondary)]">
          Congratulations! You&apos;ve completed all available cases.
        </p>
        {progression.latestCompletedCase ? (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Latest completion: {progression.latestCompletedCase.title}
          </p>
        ) : null}
        <Button asChild size="lg" className="mt-8 h-12 w-full rounded-xl">
          <Link href="/reports">
            View Reports
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </article>
    );
  }

  const isResume = progression.kind === "resume";
  const patientCase = progression.patientCase;
  const actionLabel = isResume
    ? "Resume Case"
    : progression.action === "retry"
      ? "Retry Case"
      : "Start Case";

  return (
    <PatientProfileCard
      patientCase={patientCase}
      href={`/encounter/${patientCase.id}`}
      compact
      showDetails={false}
      eyebrow="Continue Learning"
      contextLabel={isResume ? "Resume where you left off" : "Recommended next step"}
      caseLabel={formatCaseNumber(patientCase.id)}
      summary={patientCase.title}
      statusLabel={
        isResume
          ? "In Progress"
          : progression.action === "retry"
            ? "Not Passed"
            : "Not Started"
      }
      buttonLabel={actionLabel}
    />
  );
}

function formatCaseNumber(caseId: string) {
  const number = Number(caseId.match(/\d+/)?.[0]);
  return Number.isFinite(number) ? `Case ${number}` : caseId;
}
