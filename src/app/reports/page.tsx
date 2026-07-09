import Link from "next/link";
import { FileText } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CASES } from "@/lib/cases";

export default function ReportsPage() {
  return (
    <AppShell title="Reports" eyebrow="Review" showSettings className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">Case reports</h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-text-secondary)]">
          Mock summaries for completed patient simulations.
        </p>
      </section>

      <section className="space-y-4">
        {CASES.map((patientCase) => (
          <Link
            key={patientCase.id}
            href={`/reports/${patientCase.id}`}
            className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--elevation-subtle)]"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-brand)_12%,white)] text-[var(--color-brand)]">
              <FileText className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-semibold text-[var(--color-text-primary)]">
                {patientCase.openingStatement}
              </span>
              <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                {patientCase.patientName} · Mentor debrief ready
              </span>
            </span>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
