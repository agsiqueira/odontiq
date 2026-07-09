import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getCaseById } from "@/lib/cases";

type ReportPageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { caseId } = await params;
  const patientCase = getCaseById(caseId);

  if (!patientCase) {
    notFound();
  }

  return (
      <AppShell
      title="Report"
      eyebrow={patientCase.patientName}
      showSettings
      className="space-y-6"
    >
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--elevation-subtle)]">
        <p className="text-sm font-semibold text-[var(--color-brand)]">Mock Report</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          {patientCase.patientName}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
          This report is placeholder content for the MVP. Later it can summarize
          learner choices, mentor feedback, and case-specific improvement areas.
        </p>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Communication</p>
          <p className="mt-2 text-lg font-semibold">Clear and patient-centered</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Clinical Reasoning</p>
          <p className="mt-2 text-lg font-semibold">Good initial hypothesis</p>
        </div>
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-retry)_28%,white)] bg-[color-mix(in_srgb,var(--color-retry)_10%,white)] p-4">
          <p className="text-sm font-semibold text-[var(--color-retry)]">Next Step</p>
          <p className="mt-2 text-lg font-semibold">
            Ask one more clarifying question before closing.
          </p>
        </div>
      </section>

      <Button
        asChild
        variant="outline"
        className="h-12 rounded-xl border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_8%,white)]"
      >
        <Link href="/reports">Back to Reports</Link>
      </Button>
    </AppShell>
  );
}
