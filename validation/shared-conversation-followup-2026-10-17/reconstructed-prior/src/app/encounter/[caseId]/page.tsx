import { notFound } from "next/navigation";

import { EncounterExperience } from "@/components/EncounterExperience";
import { getCaseById } from "@/lib/cases";

type EncounterPageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function EncounterPage({ params }: EncounterPageProps) {
  const { caseId } = await params;
  const patientCase = getCaseById(caseId);

  if (!patientCase) {
    notFound();
  }

  return <EncounterExperience patientCase={patientCase} />;
}
