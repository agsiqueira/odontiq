import type { PatientDisclosureFact } from "@/lib/patientDisclosure";
import type { GovernedFact } from "./types";

export function attachGovernedFacts(
  facts: readonly PatientDisclosureFact[],
  rubricRelevantFactIds: ReadonlySet<string> = new Set(),
): GovernedFact[] {
  const seen = new Set<string>();
  return facts.flatMap((fact) => {
    if (seen.has(fact.id)) return [];
    seen.add(fact.id);
    return [{
      id: fact.id,
      canonicalValue: fact.text,
      source: "disclosure-state" as const,
      exactValues: extractExactValues(fact.text),
      requiredTerms: extractProtectedTerms(fact.text),
      polarity: inferPolarity(fact.text),
      certain: !expressesUncertainty(fact.text),
      rubricRelevant: rubricRelevantFactIds.has(fact.id),
    }];
  });
}

function extractExactValues(text: string) {
  const values = text.match(
    /\b(?:\d+(?:\.\d+)?(?:\s*\/\s*10|\s*(?:mg|milligrams?|hours?|days?|weeks?|months?|years?|packs?))|(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty[- ]four|forty[- ]eight)\s+(?:out of ten|milligrams?|hours?|days?|weeks?|months?|years?|packs?))\b/gi,
  );
  return values?.map(normalize) ?? [];
}

function extractProtectedTerms(text: string) {
  const terms = text.match(
    /\b(?:lower[- ]left|lower[- ]right|upper[- ]left|upper[- ]right|metformin|lisinopril|penicillin|diabetes|hypertension|high blood pressure|drug allergies?|short of breath|chest pain|swallow(?:ing)?|drool(?:ing)?|muffled|ibuprofen|alcohol|illicit drugs?)\b/gi,
  );
  return [...new Set((terms ?? []).map(normalize))];
}

function inferPolarity(text: string): GovernedFact["polarity"] {
  if (/\b(?:no|not|never|cannot|can't|do not|don't|without)\b/i.test(text)) return "negative";
  if (/\b(?:yes|has|have|feels?|is|cannot|can't)\b/i.test(text)) return "positive";
  return undefined;
}

function expressesUncertainty(text: string) {
  return /\b(?:maybe|perhaps|i think|not sure|unsure|do not know|don't know|do not recall|don't recall|cannot remember|can't remember)\b/i.test(text);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
