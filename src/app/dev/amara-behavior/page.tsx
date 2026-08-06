import { notFound } from "next/navigation";

import { buildAmaraBehaviorFixtures, buildAmaraRepetitionFixtures } from "@/lib/patientBehavior";

export default function DeveloperAmaraBehaviorPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const fixtures = [...buildAmaraRepetitionFixtures(), ...buildAmaraBehaviorFixtures()];
  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-6 py-10 text-slate-950">
      <h1 className="text-3xl font-semibold">Amara behavioral rendering</h1>
      <p className="mt-2 text-sm text-slate-600">
        Deterministic Phase 2 comparison. This development-only route uses the production renderer and validator.
      </p>
      <div className="mt-8 space-y-5">
        {fixtures.map((fixture) => (
          <article key={fixture.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{fixture.label}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                {fixture.result.toneMode ?? fixture.result.bypassReason ?? "unchanged"}
              </span>
            </div>
            <Comparison label="Original clinical text" value={fixture.originalText} />
            <Comparison label="Rendered candidate" value={fixture.result.candidateText} />
            <Comparison label="Final accepted text" value={fixture.result.text} />
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <Meta label="Governed facts" value={fixture.governedFacts.map((fact) => fact.id).join(", ") || "None"} />
              <Meta label="Validation" value={fixture.result.valid ? "Valid" : "Rejected"} />
              <Meta label="Fallback" value={fixture.result.usedFallback ? "Yes" : "No"} />
              <Meta label="Repetition" value={fixture.result.repetition ? `${fixture.result.repetition.level} (${fixture.result.repetition.reason})` : "Not supplied"} />
            </dl>
            <Comparison label="Validation violations" value={fixture.result.violations.map((item) => `${item.code}: ${item.message}`).join("\n") || "None"} />
          </article>
        ))}
      </div>
    </main>
  );
}

function Comparison({ label, value }: { label: string; value: string }) {
  return <section className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value || "(empty)"}</p></section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>;
}
