import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { MentorLocalSummary } from "@/components/MentorLocalSummary";
import { Button } from "@/components/ui/button";
import { loadCase } from "@/data/cases";
import { getCaseById } from "@/lib/cases";

type MentorPageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function MentorPage({ params }: MentorPageProps) {
  const { caseId } = await params;
  const patientCase = getCaseById(caseId);
  const caseData = loadCase(caseId);

  if (!patientCase || !caseData) {
    notFound();
  }

  const checklistItems = Array.from(
    new Map(
      [
        ...caseData.patientChecklist.map((item) => ({
          ...item,
          section: "patient" as const,
        })),
        ...caseData.clinicalChecklist.map((item) => ({
          ...item,
          section: "clinical" as const,
        })),
      ].map(
        (item) => [
          item.id,
          {
            id: item.id,
            label: item.label,
            section: item.section,
          },
        ],
      ),
    ).values(),
  );

  return (
    <AppShell
      title="Mentor Debrief"
      eyebrow={patientCase.patientName}
      showSettings
      className="flex flex-col justify-center space-y-6"
    >
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--elevation-subtle)]">
        <div className="grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-brand)_12%,white)] text-[var(--color-brand)]">
          <MessageCircle className="size-7" />
        </div>
        <h1 className="mt-8 text-4xl font-semibold leading-tight">
          Debrief for {patientCase.patientName}
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
          Nice work completing the encounter. This mock mentor summary will later
          highlight your questions, reasoning, and communication.
        </p>
        <div className="mt-8 rounded-2xl border border-[color-mix(in_srgb,var(--color-retry)_28%,white)] bg-[color-mix(in_srgb,var(--color-retry)_10%,white)] p-4">
          <p className="text-sm font-semibold text-[var(--color-retry)]">Focus for review</p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
            Clarify the timeline, triggers, and patient concerns before planning.
          </p>
        </div>
        <MentorLocalSummary
          caseId={patientCase.id}
          patientName={patientCase.patientName}
          checklistItems={checklistItems}
        />
      </section>

      <Button
        asChild
        size="lg"
        className="h-14 rounded-xl bg-[var(--color-action)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
      >
        <Link href={`/reports/${patientCase.id}`}>
          View Report
          <ChevronRight className="size-5" />
        </Link>
      </Button>
    </AppShell>
  );
}
