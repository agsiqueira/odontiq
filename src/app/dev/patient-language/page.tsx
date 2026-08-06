import { notFound } from "next/navigation";

import { buildPatientLanguageFixtures } from "@/lib/patientLanguagePolicy";

export default function DeveloperPatientLanguagePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const fixtures = buildPatientLanguageFixtures();
  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-50 px-6 py-10 text-slate-950">
      <h1 className="text-3xl font-semibold">Patient language governance</h1>
      <p className="mt-2 text-sm text-slate-600">Deterministic English-only detection and exact governed responses.</p>
      <div className="mt-8 space-y-4">
        {fixtures.map((fixture) => (
          <article key={fixture.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{fixture.input}</h2>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <Meta label="Intent" value={fixture.detection?.intent ?? "normal-clinical-processing"} />
              <Meta label="Match" value={fixture.detection ? `${fixture.detection.confidence}: ${fixture.detection.matchReason}` : "No governed language match"} />
              <Meta label="Repetition" value={fixture.repetitionLevel} />
              <Meta label="Patient profile" value={fixture.patientProfile} />
              <Meta label="Clinical generation bypassed" value={fixture.bypassed ? "Yes" : "No"} />
            </dl>
            <p className="mt-4 text-sm"><span className="font-semibold">Response:</span> {fixture.response ?? "Normal clinical pipeline"}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>;
}
