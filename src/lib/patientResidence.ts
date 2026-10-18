import type { PatientDisclosureFact } from "./patientDisclosure";

export function residenceCounty(fact: PatientDisclosureFact): string | undefined {
  if (!fact.id.endsWith(".background-residence")) return undefined;
  return fact.text.match(/\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)* County\b/)?.[0];
}

export function residenceFallback(facts: readonly PatientDisclosureFact[]): string[] {
  return facts.flatMap(fact => {
    const county = residenceCounty(fact);
    if (!county) return [];
    return [`I live in ${county}${/not yet established residency/i.test(fact.text)
      ? ", but I haven't established residency yet" : ""}.`];
  });
}
