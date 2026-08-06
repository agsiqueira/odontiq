import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  renderPatientBehavior,
  type BehavioralStage,
} from "@/lib/patientBehavior";

const SAMPLE_RESPONSE = "I am trying to answer, but I do not feel well.";

export default async function DeveloperPatientBehaviorPage({ searchParams }: PageProps<"/dev/amara-behavior">) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const selectedProfile = PATIENT_BEHAVIOR_PROFILES.find((profile) => profile.patientId === query.patient)
    ?? PATIENT_BEHAVIOR_PROFILES[0];
  const selectedStage = parseStage(query.stage);
  const contract = behavioralContractForCase(selectedProfile.caseId);
  if (!contract) notFound();
  const result = renderPatientBehavior({
    patientId: selectedProfile.patientId,
    caseId: selectedProfile.caseId,
    originalText: SAMPLE_RESPONSE,
    governedFacts: [],
    contract,
    stage: selectedStage,
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-6 py-10 text-slate-950">
      <h1 className="text-3xl font-semibold">Patient behavioral stages</h1>
      <p className="mt-2 text-sm text-slate-600">Production renderer preview. Selection changes URL parameters only and never modifies encounter state.</p>
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Patient</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {PATIENT_BEHAVIOR_PROFILES.map((profile) => <Selector key={profile.patientId} active={profile.patientId === selectedProfile.patientId} href={`?patient=${profile.patientId}&stage=${selectedStage}`} label={profile.displayName} />)}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stage</h2>
        <div className="mt-2 flex gap-2">
          {([1, 2, 3] as const).map((stage) => <Selector key={stage} active={stage === selectedStage} href={`?patient=${selectedProfile.patientId}&stage=${stage}`} label={`Stage ${stage}`} />)}
        </div>
      </section>
      <article className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{selectedProfile.displayName}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">Stage {selectedStage}</span></div>
        <p className="mt-2 text-sm text-slate-600">{selectedProfile.stages[selectedStage]}</p>
        <Comparison label="Original response" value={SAMPLE_RESPONSE} />
        <Comparison label="Rendered response" value={result.text} />
        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3"><Meta label="Case" value={selectedProfile.caseId} /><Meta label="Validation" value={result.valid ? "Valid" : "Rejected"} /><Meta label="Fallback" value={result.usedFallback ? "Yes" : "No"} /></dl>
      </article>
    </main>
  );
}

function parseStage(value: string | string[] | undefined): BehavioralStage {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "2" ? 2 : raw === "3" ? 3 : 1;
}

function Selector({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link className={`rounded-md border px-3 py-2 text-sm ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`} href={href}>{label}</Link>;
}

function Comparison({ label, value }: { label: string; value: string }) {
  return <section className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value}</p></section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>;
}
