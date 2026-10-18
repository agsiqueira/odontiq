import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { MentorGeneratedDebrief } from "@/components/MentorGeneratedDebrief";
import { Button } from "@/components/ui/button";
import { loadCase } from "@/data/cases";
import { getCaseById } from "@/lib/cases";

type MentorPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{ attemptId?: string | string[] }>;
};

export default async function MentorPage({ params, searchParams }: MentorPageProps) {
  const { caseId } = await params;
  const requestedAttemptId = (await searchParams).attemptId;
  const attemptId = Array.isArray(requestedAttemptId)
    ? requestedAttemptId[0]
    : requestedAttemptId;
  const patientCase = getCaseById(caseId);
  const caseData = loadCase(caseId);

  if (!patientCase || !caseData) {
    notFound();
  }

  return (
    <AppShell
      title="Mentor Debrief"
      eyebrow={patientCase.patientName}
      showSettings
      showBottomNavigation={false}
      className="flex min-h-0 flex-col overflow-hidden pb-4"
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <MentorGeneratedDebrief
            caseId={patientCase.id}
            attemptId={attemptId}
          />
        </div>
      </section>

      <div className="mt-2 flex shrink-0 justify-end">
        <Button
          asChild
          size="lg"
          className="h-12 rounded-xl bg-[var(--color-action)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--color-action)_88%,black)]"
        >
          <Link
            href={`/reports/${patientCase.id}?attemptId=${encodeURIComponent(attemptId ?? "")}`}
          >
            View Report
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
