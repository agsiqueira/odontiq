import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PATIENT_BEHAVIOR_PROFILES,
  behavioralContractForCase,
  renderPatientBehavior,
  selectBehavioralStage,
} from "@/lib/patientBehavior";

const PREVIEW_RESPONSES = [
  "I am trying to answer, but I do not feel well today.",
  "Four days.",
  "The discomfort has been getting worse since I first noticed it.",
  "I have been dealing with this problem and I want some help.",
  "It is difficult to describe, but the discomfort has continued.",
  "No, I am not having trouble breathing.",
  "I take metformin and lisinopril.",
  "I have answered as clearly as I can about what happened.",
  "The problem has continued and it has been difficult to manage.",
  "I am doing my best to explain what I have noticed.",
  "This has been bothering me and I would like it addressed.",
  "That is everything I can tell you about the problem right now.",
] as const;

export default async function DeveloperPatientBehaviorPage({ searchParams }: PageProps<"/dev/amara-behavior">) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const selectedProfile = PATIENT_BEHAVIOR_PROFILES.find((profile) => profile.patientId === query.patient)
    ?? PATIENT_BEHAVIOR_PROFILES[0];
  const contract = behavioralContractForCase(selectedProfile.caseId);
  if (!contract) notFound();

  const acceptedResponses: string[] = [];
  const turns = PREVIEW_RESPONSES.map((originalText, index) => {
    const turnNumber = index + 1;
    const result = renderPatientBehavior({
      patientId: selectedProfile.patientId,
      caseId: selectedProfile.caseId,
      originalText,
      governedFacts: [],
      contract,
      stage: selectBehavioralStage(turnNumber),
      finalizedTurnNumber: turnNumber,
      recentPatientResponses: acceptedResponses.slice(-5),
    });
    acceptedResponses.push(result.text);
    return { turnNumber, originalText, result };
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-6 py-10 text-slate-950">
      <h1 className="text-3xl font-semibold">Patient behavioral-stage transcript</h1>
      <p className="mt-2 text-sm text-slate-600">Twelve-turn production-renderer preview. URL selection never modifies encounter state.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {PATIENT_BEHAVIOR_PROFILES.map((profile) => <Selector key={profile.patientId} active={profile.patientId === selectedProfile.patientId} href={`?patient=${profile.patientId}`} label={profile.displayName} />)}
      </div>
      <section className="mt-8 space-y-4">
        {turns.map(({ turnNumber, originalText, result }) => (
          <article key={turnNumber} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{selectedProfile.displayName} · Turn {turnNumber}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">Stage {result.stage}</span></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Comparison label="Original response" value={originalText} /><Comparison label="Accepted response" value={result.text} /></div>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
              <Meta label="Optional phrase" value={result.optionalPhrase ?? "None"} />
              <Meta label="Suppressed" value={result.optionalPhraseSuppressed ? "Yes" : "No"} />
              <Meta label="Suppression reason" value={result.optionalPhraseSuppressionReason ?? "None"} />
              <Meta label="Recent phrase history" value={result.recentPhraseHistory?.filter(Boolean).join(" | ") || "None"} />
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}

function Selector({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link className={`rounded-md border px-3 py-2 text-sm ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`} href={href}>{label}</Link>;
}

function Comparison({ label, value }: { label: string; value: string }) {
  return <section><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value}</p></section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>;
}
