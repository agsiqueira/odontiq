import { patientRequestedText } from "./providerTurnScopes";
import { isPatientPainLocationQuestion, isPatientPainSeverityQuestion, type PatientDisclosureState } from "./patientDisclosure";

export function requiredFactsForTurn(
  disclosureState: PatientDisclosureState,
  studentMessage: string,
  canonicalFacts: PatientDisclosureState["allowedThisTurn"] = [],
): PatientDisclosureState["allowedThisTurn"] {
  studentMessage = patientRequestedText(studentMessage);
  // The shared contract checks background completeness. Clinical keyword checks
  // must not require tooth location or symptom duration for background questions.
  if (disclosureState.backgroundTurn && !disclosureState.backgroundTurn.clinicalRequested) return disclosureState.allowedThisTurn.filter(fact => fact.id.includes(".background-")
    || disclosureState.backgroundTurn!.requests.some(request => request.sourceId === fact.id && request.concept === "dentist"));
  const visible = [...canonicalFacts, ...disclosureState.alreadyDisclosed, ...disclosureState.allowedThisTurn];
  const backgroundRequiredIds = new Set(disclosureState.allowedThisTurn
    .filter(fact => /\.background-(?:residence|transportation(?:-unknown)?)$/.test(fact.id)).map(fact => fact.id));
  const case1ProtectedIds = new Set([
    "c1.location", "c1.duration", "c1.onset-uncertain", "c1.initial-severity", "c1.severity",
    "c1.airway-duration", "c1.swelling-location", "c1.upright-breathing", "c1.dyspnea-supine",
    "c1.home-temperature", "c1.chest-pain", "c1.diabetes", "c1.hypertension", "c1.metformin",
    "c1.lisinopril", "c1.nkda", "c1.ibuprofen", "c1.opioid", "c1.smoking", "c1.alcohol",
    "c1.illicit-drugs", "c1.prior-antibiotics-unknown", "c1.otc-unknown", "c1.prior-root-canal-unknown", "c1.prior-extraction-unknown",
  ]);
  const requiredCase1Ids = new Set(disclosureState.allowedThisTurn.filter((fact) => case1ProtectedIds.has(fact.id)).map((fact) => fact.id));
  const case2ProtectedIds = new Set([
    "c2.location", "c2.duration", "c2.systemic-timeline", "c2.severity", "c2.swelling",
    "c2.breathing-negative", "c2.liquids-positive", "c2.voice-negative", "c2.drooling-negative",
    "c2.mouth-opening", "c2.healthy", "c2.med", "c2.ibuprofen", "c2.opioid", "c2.nkda",
    "c2.smoking", "c2.alcohol", "c2.illicit-drugs", "c2.access", "c2.prior-antibiotics-unknown",
    "c2.prior-root-canal-unknown", "c2.prior-treatment-unknown", "c2.painful-tooth-not-extracted", "c2.other-extraction-unknown", "c2.temperature-unknown",
    "c2.heart-rate-unknown", "c2.sirs-unknown",
  ]);
  const requiredCase2Ids = new Set(disclosureState.allowedThisTurn.filter((fact) => case2ProtectedIds.has(fact.id)).map((fact) => fact.id));
  const case3ProtectedIds = new Set([
    "c3.location", "c3.duration", "c3.pain-quality", "c3.pain-severity", "c3.radiation", "c3.biting", "c3.percussion", "c3.gum-palpation", "c3.cold",
    "c3.swelling", "c3.oral-swelling", "c3.no-fever", "c3.mouth-opening", "c3.breathing", "c3.swallowing", "c3.voice",
    "c3.chest-pain-negative", "c3.neck-stiffness-negative", "c3.ulcers", "c3.surgery-negative", "c3.pepcid", "c3.ibuprofen", "c3.nkda",
    "c3.opioid-negative", "c3.smoking", "c3.alcohol", "c3.illicit-drugs-negative", "c3.crown", "c3.rct", "c3.dental-work",
    "c3.treated-teeth-unknown", "c3.painful-tooth-not-extracted", "c3.dentist-contact", "c3.appointment", "c3.pepcid-details-unknown",
    "c3.prior-antibiotics-unknown", "c3.prior-acetaminophen-unknown", "c3.temperature-unknown", "c3.heart-rate-unknown", "c3.diagnosis-unknown",
  ]);
  const requiredCase3Ids = new Set(disclosureState.allowedThisTurn.filter((fact) => case3ProtectedIds.has(fact.id)).map((fact) => fact.id));
  const case4ProtectedIds = new Set([
    "c4.location", "c4.duration", "c4.sequence", "c4.filling-present", "c4.filling-break-belief", "c4.hard-object-unknown",
    "c4.constant", "c4.severity", "c4.biting", "c4.cold-prior", "c4.cold-now", "c4.no-swelling", "c4.no-drainage",
    "c4.no-gum-swelling", "c4.no-fever", "c4.swallowing", "c4.drooling", "c4.breathing", "c4.mouth-opening", "c4.voice",
    "c4.penicillin", "c4.hives", "c4.medication", "c4.healthy", "c4.ibuprofen-suitable", "c4.opioid-negative", "c4.smoking",
    "c4.alcohol", "c4.illicit-drugs-negative", "c4.last-dentist", "c4.access", "c4.goal", "c4.surgery-unknown",
    "c4.ibuprofen-frequency-unknown", "c4.prior-acetaminophen-unknown", "c4.prior-antibiotics-unknown", "c4.root-canal-unknown",
    "c4.painful-tooth-not-extracted", "c4.temperature-unknown", "c4.diagnosis-unknown", "c4.tooth-percentage-unknown",
  ]);
  const requiredCase4Ids = new Set(disclosureState.allowedThisTurn.filter((fact) => case4ProtectedIds.has(fact.id)).map((fact) => fact.id));
  const case5ProtectedIds = new Set([
    "c5.location", "c5.duration", "c5.constant", "c5.quality", "c5.severity", "c5.spontaneous", "c5.nocturnal",
    "c5.cold", "c5.lingering", "c5.chewing", "c5.biting", "c5.no-swelling", "c5.no-drainage", "c5.no-fever",
    "c5.swallowing", "c5.voice", "c5.breathing", "c5.med", "c5.ibuprofen-frequency-unknown", "c5.ibuprofen-suitable",
    "c5.prior-acetaminophen-unknown", "c5.prior-antibiotics-current-unknown", "c5.nkda", "c5.healthy", "c5.opioid-negative",
    "c5.surgery-unknown", "c5.smoking", "c5.alcohol", "c5.illicit-drugs-negative", "c5.dental-history",
    "c5.painful-tooth-not-extracted", "c5.root-canal-unknown", "c5.filling-unknown", "c5.temperature-unknown",
    "c5.diagnosis-unknown", "c5.appointment-negative", "c5.access", "c5.goal",
  ]);
  const requiredCase5Ids = new Set(disclosureState.allowedThisTurn.filter((fact) => case5ProtectedIds.has(fact.id)).map((fact) => fact.id));
  const asksDuration = /\b(?:how long|duration|how many days|when.{0,20}(?:start|begin))\b/i.test(studentMessage);
  const asksLocation = isPatientPainLocationQuestion(studentMessage);
  const asksAllergies = /\b(?:allerg|penicillin|reaction)\b/i.test(studentMessage);
  const asksSmoking = /\b(?:smok|tobacco|cigarette)\b/i.test(studentMessage);
  const asksMedicalHistory = /\b(?:medical (?:history|conditions?)|health (?:history|conditions?|problems?)|ulcers?)\b/i.test(studentMessage);
  const asksMedications = /\b(?:medication|medications|medicine|meds|what do you take|taking|pepcid)\b/i.test(studentMessage);
  const asksIbuprofenTolerance = /\b(?:ibuprofen|advil|motrin|nsaid)\b/i.test(studentMessage);
  const asksSwelling = /\b(?:swell|swollen|swelling|puffy|edema)\b/i.test(studentMessage);
  const asksNumericSeverity = isPatientPainSeverityQuestion(studentMessage);
  const asksOpioidHistory = /\b(?:opioids?|opiates?|narcotics?|prescription (?:painkillers?|pain (?:medication|medicine|pills?))|opioid (?:use|misuse|abuse|dependence|addiction))\b/i.test(studentMessage);
  return visible.filter((fact) =>
    backgroundRequiredIds.has(fact.id) ||
    requiredCase1Ids.has(fact.id) || requiredCase2Ids.has(fact.id) || requiredCase3Ids.has(fact.id) || requiredCase4Ids.has(fact.id) || requiredCase5Ids.has(fact.id) ||
    (asksDuration && /\.duration$/.test(fact.id)) ||
    (asksLocation && /\.location$/.test(fact.id)) ||
    (asksAllergies && /\.(?:penicillin|hives|nkda)$/.test(fact.id)) ||
    (asksSmoking && /\.smoking$/.test(fact.id)) ||
    (asksMedicalHistory && fact.id === "c3.ulcers") ||
    (asksMedications && (fact.id === "c3.pepcid" || fact.id === "c3.ibuprofen")) ||
    (asksIbuprofenTolerance && fact.id === "c3.ibuprofen")
    || (asksSwelling && fact.id === "c2.swelling")
    || (asksNumericSeverity && fact.id === "c4.severity")
    || (asksOpioidHistory && fact.id === "c1.opioid")
  );
}


