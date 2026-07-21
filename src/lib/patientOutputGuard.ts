import type { PatientDisclosureFact } from "./patientDisclosure";

export type PatientOutputAssessment = {
  valid: boolean;
  reason?: string;
};

const LEAKAGE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["simulation-control text", /\b(?:end|conclusion) of simulation\b/i],
  ["legal disclaimer", /\blegal disclaimer\b|\bfictional representation for educational purposes\b/i],
  ["turn-policy metadata", /\bturnPolicy\b|\bproviderMessageIntent\b|\blatestTopics\b|\basksRestrictedClinicalInterpretation\b/i],
  ["visible-fact metadata", /\bvisibleFacts\b|\balreadyDisclosed\b|\ballowedThisTurn\b/i],
  ["prompt section", /\b(?:new information permitted for this answer|previously spoken information|patient identity|communication style)\b/i],
  ["prompt instruction", /\binstruction\s+\d+\b|\bremember,? you are not to\b/i],
  ["structured fact payload", /\{\s*["']?(?:id|topic|text)["']?\s*:/i],
];

export function assessPatientOutputIntegrity(
  text: string,
  visibleFacts: readonly PatientDisclosureFact[],
  priorPatientDialogue: readonly string[] = [],
  requiredFacts: readonly PatientDisclosureFact[] = [],
): PatientOutputAssessment {
  const spokenText = text.trim();
  for (const [reason, pattern] of LEAKAGE_PATTERNS) {
    if (pattern.test(spokenText)) return { valid: false, reason };
  }

  if (hasRepeatedLongBlock(spokenText)) {
    return { valid: false, reason: "repeated response block" };
  }

  const missingRequiredFact = requiredFacts.find((fact) => !expressesRequiredFact(spokenText, fact));
  if (missingRequiredFact) return { valid: false, reason: `missing required fact ${missingRequiredFact.id}` };

  const contradiction = findStableFactContradiction(
    spokenText,
    visibleFacts,
    priorPatientDialogue,
  );
  return contradiction ? { valid: false, reason: contradiction } : { valid: true };
}

function expressesRequiredFact(response: string, fact: PatientDisclosureFact): boolean {
  const rules: Readonly<Record<string, RegExp>> = {
    "c2.duration": /\b(?:seven|7)\s+days?\b|\b(?:about |around |approximately |roughly )?(?:a|one)\s+week\b/i,
    "c3.duration": /\b(?:three|3)\s+days?\b/i,
    "c4.duration": /\b(?:five|5)\s+days?\b/i,
    "c5.duration": /\b(?:four|4)\s+days?\b/i,
    "c3.location": /\b(?:lower|bottom|mandibular)\b.{0,30}\bright\b|\bright\b.{0,30}\b(?:lower|bottom|mandibular)\b/i,
    "c4.location": /\b(?:lower|bottom|mandibular)\b.{0,30}\bleft\b|\bleft\b.{0,30}\b(?:lower|bottom|mandibular)\b/i,
    "c5.location": /\b(?:lower|bottom|mandibular)\b.{0,30}\bleft\b|\bleft\b.{0,30}\b(?:lower|bottom|mandibular)\b/i,
    "c4.penicillin": /\bpenicillin\b.{0,35}\b(?:allerg|hives)\b|\b(?:allerg|hives)\b.{0,35}\bpenicillin\b/i,
    "c4.hives": /\bpenicillin\b.{0,35}\bhives\b|\bhives\b.{0,35}\bpenicillin\b/i,
    "c5.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:don't|do not) have (?:any )?(?:known )?(?:drug )?allerg|\bnot allergic\b/i,
    "c5.smoking": /\b(?:smoke|smoking)\b.{0,35}\b(?:half|0\.5|one[- ]half)\b.{0,20}\bpack\b|\bhalf[- ]?(?:a )?pack\b.{0,30}\b(?:smoke|cigarette)/i,
    "c3.ulcers": /\b(?:have|had|history of|deal(?:ing)? with|known)\b.{0,25}\b(?:stomach|gastric)?\s*ulcers?\b|\b(?:stomach|gastric)\s*ulcers?\b/i,
    "c3.pepcid": /\bpepcid\b.{0,25}\b(?:as needed|when needed|prn|take|use)\b|\b(?:take|use)\b.{0,25}\bpepcid\b/i,
    "c3.ibuprofen": /\b(?:ibuprofen|advil|motrin)\b.{0,40}\b(?:upsets?|bothers?|irritates?|poorly tolerate|avoid|stomach)\b/i,
    "c3.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:don't|do not) have (?:any )?(?:known )?(?:drug )?allerg|\bnot allergic\b/i,
    "c2.swelling": /\bright\b.{0,25}\b(?:cheek|face)\b.{0,25}\b(?:swollen|swelling)\b|\b(?:swollen|swelling)\b.{0,25}\bright\b.{0,20}\b(?:cheek|face|side)\b/i,
    "c4.severity": /(?:^|\b)(?:about |around |approximately )?(?:seven|7)(?:\s*(?:\/|out of)\s*10)?(?:\b|[.!?]?$)/i,
  };
  return rules[fact.id]?.test(response) ?? true;
}

function findStableFactContradiction(
  response: string,
  facts: readonly PatientDisclosureFact[],
  priorPatientDialogue: readonly string[],
): string | undefined {
  const factText = [
    ...facts.map((fact) => fact.text),
    ...priorPatientDialogue,
  ].join(" ");
  const knownPositiveFever = /\b(?:has|have|felt|feels|feeling)\b.{0,25}\bfever(?:ish)?\b/i.test(factText);
  const deniesFever = /\b(?:no|not|haven't|have not|never)\b.{0,25}\bfever(?:ish)?\b/i.test(response);
  if (knownPositiveFever && deniesFever) return "contradiction of disclosed fever";

  const hasCanonicalSevenDayDuration = facts.some((fact) =>
    fact.id === "c2.duration" && /\bseven\s+days?\b/i.test(fact.text)
  );
  if (hasCanonicalSevenDayDuration && contradictsSevenDayDuration(response)) {
    return "contradiction of disclosed seven-day duration";
  }

  const locationContradiction = findCanonicalLocationContradiction(response, facts);
  if (locationContradiction) return locationContradiction;

  if (facts.some((fact) => fact.id === "c3.ulcers") && /\b(?:no|don't have|do not have|never had|without)\b.{0,25}\b(?:stomach|gastric)?\s*ulcers?\b/i.test(response)) {
    return "contradiction of Case 3 stomach-ulcer history";
  }
  if (facts.some((fact) => fact.id === "c2.swelling") && /\b(?:no|not|haven't|have not)\b.{0,25}\b(?:swollen|swelling)\b/i.test(response)) {
    return "contradiction of Case 2 right-cheek swelling";
  }

  if (facts.some((fact) => fact.id === "c5.smoking") && /\b(?:don't|do not|never|not)\b.{0,20}\bsmok|\bnon[- ]?smoker\b/i.test(response)) {
    return "contradiction of Case 5 smoking history";
  }

  return undefined;
}

function findCanonicalLocationContradiction(response: string, facts: readonly PatientDisclosureFact[]): string | undefined {
  const lowerRight = /\b(?:lower|bottom|mandibular)\b.{0,30}\bright\b|\bright\b.{0,30}\b(?:lower|bottom|mandibular)\b/i;
  const lowerLeft = /\b(?:lower|bottom|mandibular)\b.{0,30}\bleft\b|\bleft\b.{0,30}\b(?:lower|bottom|mandibular)\b/i;
  const upperRight = /\b(?:upper|top|maxillary)\b.{0,30}\bright\b|\bright\b.{0,30}\b(?:upper|top|maxillary)\b/i;
  const upperLeft = /\b(?:upper|top|maxillary)\b.{0,30}\bleft\b|\bleft\b.{0,30}\b(?:upper|top|maxillary)\b/i;
  const expressedLocation = lowerRight.test(response)
    ? "lower-right"
    : lowerLeft.test(response)
      ? "lower-left"
      : upperRight.test(response)
        ? "upper-right"
        : upperLeft.test(response)
          ? "upper-left"
          : undefined;
  if (facts.some((fact) => fact.id === "c3.location") && expressedLocation && expressedLocation !== "lower-right") return "contradiction of Case 3 tooth location";
  if (facts.some((fact) => fact.id === "c4.location") && expressedLocation && expressedLocation !== "lower-left") return "contradiction of Case 4 tooth location";
  if (facts.some((fact) => fact.id === "c5.location") && expressedLocation && expressedLocation !== "lower-left") return "contradiction of Case 5 tooth location";
  return undefined;
}

function contradictsSevenDayDuration(response: string): boolean {
  return /\b(?:started|began|lasted|going on|hurting|worsening|getting worse)\b.{0,30}\b(?:today|yesterday|(?:one|two|three|four|five|six|1|2|3|4|5|6|couple of|few)\s+days?|(?:two|three|four|2|3|4)\s+weeks?|months?|years?)\b/i.test(response) ||
    /\b(?:pain|ache|symptoms?)\b.{0,30}\bfor\b.{0,20}\b(?:one|two|three|four|five|six|1|2|3|4|5|6|couple of|few)\s+days?\b/i.test(response);
}

function hasRepeatedLongBlock(text: string): boolean {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.toLowerCase().replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 60);
  return new Set(sentences).size !== sentences.length;
}
