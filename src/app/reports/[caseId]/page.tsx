import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { CanonicalCaseReport } from "@/components/CanonicalCaseReport";
import { getCaseById } from "@/lib/cases";

type ReportPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{ attemptId?: string | string[] }>;
};

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const { caseId } = await params;
  const requestedAttemptId = (await searchParams).attemptId;
  const attemptId = Array.isArray(requestedAttemptId)
    ? requestedAttemptId[0]
    : requestedAttemptId;
  const patientCase = getCaseById(caseId);

  if (!patientCase) {
    notFound();
  }

  return (
    <AppShell
      title="Report"
      eyebrow={patientCase.patientName}
      showSettings
      className="space-y-4"
    >
      <CanonicalCaseReport caseId={caseId} attemptId={attemptId} />
    </AppShell>
  );
}
