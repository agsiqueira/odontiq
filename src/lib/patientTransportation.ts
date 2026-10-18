import type { PatientDisclosureFact } from "./patientDisclosure";

export function transportationFallback(facts: readonly PatientDisclosureFact[]): string[] {
  return facts.filter(fact => /\.background-transportation(?:-unknown)?$/.test(fact.id))
    .map(fact => fact.id.endsWith("-unknown")
      ? "I'm not sure whether I could arrange transportation or travel out of town for care."
      : fact.text.replace(/^The patient has /, "I have "));
}

/** Require an answer about travel/access, rather than any true background fact. */
export function expressesTransportationFact(response: string, fact: PatientDisclosureFact): boolean | undefined {
  if (!/\.background-transportation(?:-unknown)?$/.test(fact.id)) return undefined;
  const statements = (response.match(/[^.!?]+[.!?]?/g) ?? []).filter(part => !part.trim().endsWith("?")).join(" ");
  const travel = /\b(?:transportation|transport|ride|travel|car|vehicle|out of town|another county|outside.{0,25}county)\b/i;
  if (!travel.test(statements)) return false;
  const uncertain = /\b(?:not sure|unsure|don't know|do not know|haven't figured|have not figured)\b/i;
  if (fact.id.endsWith("-unknown")) {
    // An uncertainty disclaimer cannot license an invented car/ride or travel commitment.
    return uncertain.test(statements)
      && !/\b(?:I have|I've got|I own|I can|I can't|I cannot|I don't have|I do not have|I'm willing|I am willing|I would|I wouldn't|I'd|I will|I'll)\b[^.!?]{0,45}\b(?:car|vehicle|ride|transportation|travel|drive|go)\b/i.test(statements);
  }
  if (/\bunreliable\b/i.test(fact.text)) {
    return /\b(?:unreliable|not reliable|isn't reliable|is not reliable|isn't always reliable|is not always reliable|not always reliable|trouble|difficult|hard|can't count|cannot count)\b/i.test(statements);
  }
  return /\b(?:reliable|dependable)\s+(?:transportation|transport|ride|car|vehicle)\b|\b(?:transportation|transport|ride|car|vehicle)\b[^.!?]{0,25}\b(?:reliable|dependable)\b/i.test(statements)
    && /\b(?:can|could|would|willing|able|happy)\b[^.!?]{0,55}\b(?:travel|go|get|drive)\b/i.test(statements)
    && !/\b(?:can't|cannot|unable|unreliable|not reliable|isn't reliable|not willing|wouldn't|would not|don't have|do not have)\b/i.test(statements)
    // An affirmative sentence cannot license a later unsupported travel limit.
    && !hasTransportationUncertainty(statements);
}

export function hasTransportationUncertainty(response: string): boolean {
  return response.split(/(?<=[.!?])\s+/).some(sentence =>
    !sentence.endsWith('?')
    // Clinical radiation is not a statement about the patient's mobility.
    && !(/\b(?:pain|ache)\b[^.!?]{0,30}\b(?:travels?|radiat\w*|spreads?)\b/i.test(sentence)
      && !/\b(?:transportation|transport|ride|car|vehicle)\b|\bI\s+(?:(?:can|could|would|will|might|may|cannot|can't)\s+)?(?:travel|drive|go|get)\b/i.test(sentence))
    && /\b(?:not sure|unsure|don't know|do not know|uncertain|can't|cannot|unable|unreliable|not reliable|not willing|wouldn't|would not|might not|may not|only|limited|difficult|depends|as long as)\b/i.test(sentence)
    && /\b(?:travel|transportation|transport|ride|drive|get there|getting there)\b|\b(?:go|get)\b[^.!?]{0,35}\b(?:county|town|clinic|there|nearby|far|miles?|blocks?)\b|\bhow far\b[^.!?]{0,25}\bI\s+(?:can|could|would|will)\b/i.test(sentence));
}
