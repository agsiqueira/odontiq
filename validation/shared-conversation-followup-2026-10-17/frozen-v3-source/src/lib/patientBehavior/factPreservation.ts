import type {
  BehavioralViolation,
  GovernedFact,
} from "./types";

const UNCERTAINTY_PATTERN = /\b(?:maybe|perhaps|i think|i guess|not sure|unsure|probably|might|could be)\b/i;
const ALTERNATIVE_VALUE_PATTERN = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+or\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/i;
const NEGATION_PATTERN = /\b(?:no|not|never|cannot|can't|do not|don't|did not|didn't|haven't|have not|without)\b/i;
const LOCATION_PATTERN = /\b(?:lower[- ]left|lower[- ]right|upper[- ]left|upper[- ]right)\b/gi;
const MEDICATION_ALLERGY_PATTERN = /\b(?:metformin|lisinopril|penicillin|ibuprofen|advil|motrin|insulin|drug allergies?)\b/gi;
const CLINICAL_TERM_PATTERN = /\b(?:toothache|pain|swelling|swollen|fever|chills|drooling|choking|short of breath|chest pain|swallow(?:ing)?|muffled|diabetes|hypertension|high blood pressure|metformin|lisinopril|penicillin|ibuprofen|opioids?|narcotics?|alcohol|illicit drugs?|allerg(?:y|ies|ic))\b/gi;

export function validateFactPreservation({
  originalText,
  candidateText,
  governedFacts,
}: {
  originalText: string;
  candidateText: string;
  governedFacts: readonly GovernedFact[];
}) {
  const violations: BehavioralViolation[] = [];
  const preservedFactIds: string[] = [];
  const originalNumbers = extractNumbers(originalText);
  const candidateNumbers = extractNumbers(candidateText);

  if (!sameValues(originalNumbers, candidateNumbers)) {
    violations.push(violation("numeric-value-changed", "Numeric values differ from the authoritative response."));
  }

  const originalLocations = extractMatches(originalText, LOCATION_PATTERN);
  const candidateLocations = extractMatches(candidateText, LOCATION_PATTERN);
  if (!sameValues(originalLocations, candidateLocations)) {
    violations.push(violation("location-changed", "A governed symptom location changed or was removed."));
  }

  const originalMedications = extractMatches(originalText, MEDICATION_ALLERGY_PATTERN);
  const candidateMedications = extractMatches(candidateText, MEDICATION_ALLERGY_PATTERN);
  if (!sameValues(originalMedications, candidateMedications)) {
    violations.push(violation("medication-or-allergy-changed", "Medication or allergy information changed."));
  }

  const originalClinicalTerms = extractMatches(originalText, CLINICAL_TERM_PATTERN);
  const candidateClinicalTerms = extractMatches(candidateText, CLINICAL_TERM_PATTERN);
  const addedClinicalTerms = candidateClinicalTerms.filter(
    (term) => !originalClinicalTerms.includes(term),
  );
  if (addedClinicalTerms.length > 0) {
    violations.push(violation(
      "unsupported-addition",
      `Candidate added unsupported clinical terms: ${addedClinicalTerms.join(", ")}.`,
    ));
  }

  for (const fact of governedFacts) {
    const originalHasFact = factAppearsInText(fact, originalText);
    if (!originalHasFact) continue;

    const factViolations = validateFact(fact, originalText, candidateText);
    violations.push(...factViolations);
    if (factViolations.length === 0) preservedFactIds.push(fact.id);
  }

  if (
    governedFacts.some((fact) => fact.certain && factAppearsInText(fact, originalText)) &&
    !UNCERTAINTY_PATTERN.test(originalText) &&
    (UNCERTAINTY_PATTERN.test(candidateText) || ALTERNATIVE_VALUE_PATTERN.test(candidateText))
  ) {
    violations.push(violation("certainty-weakened", "A certain governed fact was made uncertain."));
  }

  return { valid: violations.length === 0, violations, preservedFactIds };
}

function validateFact(fact: GovernedFact, originalText: string, candidateText: string) {
  const violations: BehavioralViolation[] = [];

  if (fact.exactTextRequired && normalizeText(candidateText) !== normalizeText(originalText)) {
    violations.push(violation("exact-text-changed", "Exact governed wording changed.", fact.id));
    return violations;
  }

  for (const exactValue of fact.exactValues ?? []) {
    if (includesNormalized(originalText, exactValue) && !includesNormalized(candidateText, exactValue)) {
      const code = /(?:day|week|month|year|hour)/i.test(exactValue)
        ? "date-or-duration-changed"
        : /(?:\/\s*10|out of ten)/i.test(exactValue)
          ? "pain-score-changed"
          : "required-value-removed";
      violations.push(violation(code, `Required value "${exactValue}" changed or was removed.`, fact.id));
    }
  }

  for (const term of fact.requiredTerms ?? []) {
    if (includesNormalized(originalText, term) && !includesNormalized(candidateText, term)) {
      const code = /left|right/i.test(term)
        ? "location-changed"
        : /metformin|lisinopril|penicillin|ibuprofen|allerg/i.test(term)
          ? "medication-or-allergy-changed"
          : fact.rubricRelevant
            ? "rubric-disclosure-removed"
            : "required-value-removed";
      violations.push(violation(code, `Required governed term "${term}" changed or was removed.`, fact.id));
    }
  }

  if (fact.polarity && polarityChanged(originalText, candidateText)) {
    violations.push(violation("symptom-polarity-changed", "A governed symptom presence or absence changed.", fact.id));
  }

  if (fact.rubricRelevant && !factAppearsInText(fact, candidateText)) {
    violations.push(violation("rubric-disclosure-removed", "A rubric-relevant disclosure was removed.", fact.id));
  }

  return violations;
}

function factAppearsInText(fact: GovernedFact, text: string) {
  if (fact.exactTextRequired) return normalizeText(text) === normalizeText(fact.canonicalValue);
  const anchors = [...(fact.exactValues ?? []), ...(fact.requiredTerms ?? [])];
  if (anchors.length > 0) return anchors.some((anchor) => includesNormalized(text, anchor));
  return includesNormalized(text, fact.canonicalValue);
}

function polarityChanged(originalText: string, candidateText: string) {
  return NEGATION_PATTERN.test(originalText) !== NEGATION_PATTERN.test(candidateText);
}

function extractNumbers(text: string) {
  return extractMatches(text, /\b\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\b/g);
}

function extractMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).map(normalizeText).sort();
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function includesNormalized(text: string, value: string) {
  return normalizeText(text).includes(normalizeText(value));
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/[-\s]+/g, " ").replace(/[^a-z0-9/' ]/g, "").trim();
}

function violation(
  code: BehavioralViolation["code"],
  message: string,
  factId?: string,
): BehavioralViolation {
  return { code, message, ...(factId ? { factId } : {}) };
}
