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
    "c4.sequence": /\b(?:week|seven days)\b.{0,55}\bstopped\b.{0,55}\b(?:returned|came back|hurting again)\b|\bstopped\b.{0,55}\b(?:returned|came back)\b/i,
    "c4.filling-present": /\b(?:large|old)\b.{0,25}\bfilling\b.{0,45}\b(?:twenty|20)\s+years?\b|\b(?:twenty|20)\s+years?\b.{0,45}\bfilling\b/i,
    "c4.filling-break-belief": /\b(?:think|may|might)\b.{0,35}\bfilling\b.{0,25}\b(?:broke|broken|failed)\b|\bfilling\b.{0,35}\b(?:may|might)\b.{0,20}\b(?:broke|broken|failed)\b/i,
    "c4.hard-object-unknown": /\b(?:not sure|unsure|don't know|do not know|don't remember|do not remember)\b.{0,45}\b(?:hard object|hard food|bit)\b/i,
    "c4.constant": /\bconstant\b/i,
    "c4.biting": /\b(?:bite|biting|chew|chewing|tap|tapping|percussion)\b.{0,35}\b(?:hurt|pain|sharp|tender)\b|\b(?:hurt|pain|sharp|tender)\b.{0,35}\b(?:bite|biting|chew|chewing|tap|tapping|percussion)\b/i,
    "c4.cold-prior": /\bcold\b.{0,35}\b(?:used to|previously|before|earlier)\b.{0,20}\b(?:hurt|pain)|\b(?:used to|previously|before|earlier)\b.{0,35}\bcold\b.{0,20}\b(?:hurt|pain)/i,
    "c4.cold-now": /\bcold\b.{0,35}\b(?:doesn't|does not|not|no longer)\b.{0,20}\b(?:hurt|pain)|\b(?:doesn't|does not|not|no longer)\b.{0,35}\bcold\b/i,
    "c4.no-swelling": /\b(?:no|not|haven't|have not)\b.{0,35}\b(?:face|facial)?\s*(?:swollen|swelling)\b|\bface\b.{0,20}\b(?:is not|isn't)\b.{0,10}\bswollen\b/i,
    "c4.no-drainage": /\b(?:no|not|haven't|have not)\b.{0,35}\b(?:pus|purulence|drainage)\b/i,
    "c4.no-gum-swelling": /\b(?:no|not)\b.{0,35}\b(?:gum|gingival)?\s*(?:swelling|abscess|purulence|fluctuance)\b/i,
    "c4.no-fever": /\b(?:no|not|haven't|have not)\b.{0,35}\b(?:fever|chills)\b/i,
    "c4.swallowing": /\b(?:no|not|don't|do not)\b.{0,35}\b(?:trouble|difficulty)\b.{0,15}\bswallowing\b/i,
    "c4.drooling": /\b(?:no|not|don't|do not|am not)\b.{0,25}\bdrool(?:ing)?\b/i,
    "c4.breathing": /\b(?:no|not|don't|do not|am not)\b.{0,35}\b(?:short of breath|trouble breathing|difficulty breathing)\b/i,
    "c4.mouth-opening": /\b(?:can|able to)\b.{0,25}\bopen\b.{0,15}\bmouth\b.{0,20}\b(?:normally|normal|fine|okay)\b/i,
    "c4.voice": /\bvoice\b.{0,25}\b(?:normal|unchanged|has not changed|hasn't changed)\b/i,
    "c4.medication": /\b(?:ibuprofen|advil|motrin)\b.{0,35}\b400\s*(?:mg|milligrams?)\b.{0,45}\b(?:as needed|pain is still|not relieved|did not relieve|hasn't relieved)\b/i,
    "c4.healthy": /\b(?:excellent health|healthy|no (?:known )?medical problems?)\b/i,
    "c4.ibuprofen-suitable": /\b(?:no (?:known )?(?:contraindication|reason)|can (?:safely )?take)\b.{0,35}\b(?:ibuprofen|advil|motrin)\b/i,
    "c4.opioid-negative": /\b(?:no|not|never|haven't|have not)\b.{0,55}\b(?:opioids?|opiates?|narcotics?|misus(?:e|ed)|abus(?:e|ed))\b/i,
    "c4.smoking": /\b(?:smoke|smoking)\b.{0,35}\b(?:one|1|a)\s+pack\b|\b(?:one|1|a)\s+pack\b.{0,35}\b(?:smoke|cigarettes?)\b/i,
    "c4.alcohol": /\b(?:occasional|occasionally)\b.{0,25}\b(?:alcohol|drink)\b|\b(?:alcohol|drink)\b.{0,25}\b(?:occasional|occasionally)\b/i,
    "c4.illicit-drugs-negative": /\b(?:no|not|don't|do not|never)\b.{0,35}\b(?:illicit|recreational|street) drugs?\b/i,
    "c4.last-dentist": /\b(?:dentist|dental visit)\b.{0,35}\b(?:five|5)\s+years?\b|\b(?:five|5)\s+years?\b.{0,35}\b(?:dentist|dental visit)\b/i,
    "c4.access": /\b(?:no|don't have|do not have|lost)\b.{0,30}\bdental insurance\b|\b(?:arranging|getting)\b.{0,30}\bdental care\b.{0,30}\b(?:take time|a while)\b/i,
    "c4.goal": /\b(?:want|would like|hope)\b.{0,25}\bsave\b.{0,15}\btooth\b/i,
    "c4.surgery-unknown": /\b(?:not sure|unsure|don't know|do not know)\b/i,
    "c4.ibuprofen-frequency-unknown": /\b(?:don't remember|do not remember|not sure|unsure)\b.{0,55}\b(?:schedule|frequency|number of doses|how often)\b/i,
    "c4.prior-acetaminophen-unknown": /\b(?:don't remember|do not remember|not sure|unsure)\b.{0,45}\b(?:tylenol|acetaminophen)\b/i,
    "c4.prior-antibiotics-unknown": /\b(?:don't remember|do not remember|not sure|unsure)\b.{0,45}\bantibiotics?\b/i,
    "c4.root-canal-unknown": /\b(?:not sure|unsure|don't know|do not know)\b.{0,45}\broot canal\b/i,
    "c4.painful-tooth-not-extracted": /\b(?:tooth|it)\b.{0,30}\b(?:still there|has a filling)\b/i,
    "c4.temperature-unknown": /\b(?:haven't|have not)\b.{0,20}\bfever\b.{0,45}\b(?:don't|do not)\b.{0,15}\bknow\b.{0,20}\bexact temperature\b/i,
    "c4.diagnosis-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,25}\b(?:diagnosis|what (?:it|this) is)\b/i,
    "c4.tooth-percentage-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,30}\b(?:percent|percentage)\b/i,
    "c5.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:don't|do not) have (?:any )?(?:known )?(?:drug )?allerg|\bnot allergic\b/i,
    "c5.smoking": /\b(?:smoke|smoking)\b.{0,35}\b(?:half|0\.5|one[- ]half)\b.{0,20}\bpack\b|\bhalf[- ]?(?:a )?pack\b.{0,30}\b(?:smoke|cigarette)/i,
    "c5.ibuprofen-frequency-unknown": /\b(?:don't know|do not know|not sure|unsure)\b.{0,45}\b(?:exact frequency|how often|schedule|number of doses)\b/i,
    "c5.prior-acetaminophen-unknown": /\b(?:don't remember|do not remember|not sure|unsure)\b.{0,45}\b(?:tylenol|acetaminophen)\b/i,
    "c5.prior-antibiotics-current-unknown": /\b(?:don't remember|do not remember|not sure|unsure)\b.{0,55}\bantibiotics?\b/i,
    "c5.ibuprofen-suitable": /\b(?:no (?:known )?(?:contraindication|reason)|can (?:safely )?take)\b.{0,35}\b(?:ibuprofen|advil|motrin)\b/i,
    "c5.opioid-negative": /\b(?:no|not|never|haven't|have not)\b.{0,55}\b(?:opioids?|opiates?|narcotics?|misus(?:e|ed)|abus(?:e|ed))\b/i,
    "c5.surgery-unknown": /\b(?:not sure|unsure|don't know|do not know)\b/i,
    "c5.alcohol": /\b(?:occasional|occasionally)\b.{0,25}\b(?:alcohol|drink)\b|\b(?:alcohol|drink)\b.{0,25}\b(?:occasional|occasionally)\b/i,
    "c5.illicit-drugs-negative": /\b(?:no|not|don't|do not|never)\b.{0,35}\b(?:illicit|recreational|street) drugs?\b/i,
    "c5.painful-tooth-not-extracted": /\bpainful tooth\b.{0,30}\bstill there\b|\bupper tooth\b.{0,40}\b(?:pulled|extracted)\b/i,
    "c5.root-canal-unknown": /\b(?:not sure|unsure|don't know|do not know)\b.{0,45}\broot canal\b/i,
    "c5.filling-unknown": /\b(?:not sure|unsure|don't know|do not know)\b.{0,45}\bfilling\b/i,
    "c5.temperature-unknown": /\b(?:haven't|have not)\b.{0,20}\bfever\b.{0,45}\b(?:don't|do not)\b.{0,15}\bknow\b.{0,20}\bexact temperature\b/i,
    "c5.diagnosis-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,25}\b(?:diagnosis|what (?:it|this) is)\b/i,
    "c5.appointment-negative": /\b(?:no|don't|do not)\b.{0,35}\b(?:dentist|appointment)\b/i,
    "c3.ulcers": /\b(?:have|had|history of|deal(?:ing)? with|known)\b.{0,25}\b(?:stomach|gastric)?\s*ulcers?\b|\b(?:stomach|gastric)\s*ulcers?\b/i,
    "c3.pepcid": /\bpepcid\b.{0,25}\b(?:as needed|when needed|prn|take|use)\b|\b(?:take|use)\b.{0,25}\bpepcid\b/i,
    "c3.ibuprofen": /\b(?:ibuprofen|advil|motrin)\b.{0,40}\b(?:upsets?|bothers?|irritates?|poorly tolerate|avoid|stomach)\b/i,
    "c3.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:don't|do not) have (?:any )?(?:known )?(?:drug )?allerg|\bnot allergic\b/i,
    "c3.pain-quality": /\bconstant\b.{0,30}\bthrobbing\b|\bthrobbing\b.{0,30}\bconstant\b/i,
    "c3.pain-severity": /\b(?:eight|8)\s*(?:\/|out of)\s*(?:ten|10)\b|^\s*(?:eight|8)[.!]?\s*$/i,
    "c3.radiation": /\bright ear\b/i,
    "c3.biting": /\b(?:biting|bite|chewing|chew)\b.{0,35}\b(?:hurt|pain|sharp|tender)\b|\b(?:hurt|pain|sharp|tender)\b.{0,35}\b(?:biting|bite|chewing|chew)\b/i,
    "c3.percussion": /\b(?:tap|tapping|percussion)\b.{0,35}\b(?:hurt|pain|tender)\b|\b(?:hurt|pain|tender)\b.{0,35}\b(?:tap|tapping|percussion)\b/i,
    "c3.gum-palpation": /\b(?:yes\b.{0,20})?(?:hurt|pain|tender)\w*\b.{0,35}\b(?:press|pressure|palpat|touch)\w*\b|\b(?:press|pressure|palpat|touch)\w*\b.{0,35}\b(?:hurt|pain|tender)\w*\b/i,
    "c3.cold": /\b(?:cold|cold drinks?|cold water)\b.{0,35}\b(?:does not|doesn't|not|no)\b.{0,20}\b(?:hurt|painful|pain)\b|\b(?:no|not|doesn't|does not)\b.{0,35}\b(?:hurt|painful|pain)\b.{0,25}\bcold\b/i,
    "c3.swelling": /\b(?:face|lower[- ]right side)\b.{0,30}\b(?:puffy|swollen|swelling)\b|\b(?:puffy|swollen|swelling)\b.{0,30}\b(?:face|lower[- ]right side)\b/i,
    "c3.oral-swelling": /\b(?:gum|inside (?:my|the) mouth)\b.{0,35}\b(?:swollen|swelling|puffy)\b|\b(?:swollen|swelling)\b.{0,35}\b(?:gum|mouth)\b/i,
    "c3.no-fever": /\b(?:no|not|haven't|have not|don't|do not)\b.{0,35}\bfever(?:ish)?\b/i,
    "c3.mouth-opening": /\b(?:can|able to)\b.{0,25}\bopen\b.{0,15}\bmouth\b.{0,20}\b(?:normally|normal|fine|okay)\b/i,
    "c3.breathing": /\b(?:no|not|don't|do not)\b.{0,35}\b(?:trouble|difficulty)\b.{0,15}\bbreathing\b/i,
    "c3.swallowing": /\b(?:no|not|don't|do not)\b.{0,35}\b(?:trouble|difficulty)\b.{0,15}\bswallowing\b/i,
    "c3.voice": /\b(?:no|not|hasn't|has not)\b.{0,35}\bvoice\b.{0,25}\b(?:change|changed)\b|\bvoice\b.{0,20}\bnormal\b/i,
    "c3.chest-pain-negative": /\b(?:no|not|don't|do not)\b.{0,25}\bchest pain\b/i,
    "c3.neck-stiffness-negative": /\bneck\b.{0,20}\b(?:not stiff|isn't stiff|is not stiff|no stiffness)\b|\bno\b.{0,20}\bneck stiffness\b/i,
    "c3.surgery-negative": /\b(?:no|not|never|haven't|have not)\b.{0,35}\b(?:surgery|surgeries|operation)\b/i,
    "c3.opioid-negative": /\b(?:no|not|never|haven't|have not|don't|do not)\b.{0,55}\b(?:opioids?|opiates?|narcotics?|misus(?:e|ed)|abus(?:e|ed))\b/i,
    "c3.smoking": /\b(?:no|not|don't|do not|never)\b.{0,25}\b(?:smoke|smoking|tobacco|cigarettes?)\b/i,
    "c3.alcohol": /\b(?:occasional|occasionally)\b.{0,25}\b(?:alcohol|drink)\b|\b(?:alcohol|drink)\b.{0,25}\b(?:occasional|occasionally)\b/i,
    "c3.illicit-drugs-negative": /\b(?:no|not|don't|do not|never)\b.{0,35}\b(?:illicit|recreational|street) drugs?\b/i,
    "c3.crown": /\b(?:crown|cap)\b/i,
    "c3.rct": /\b(?:not sure|unsure|don't know|do not know|don't remember|do not remember)\b.{0,55}\b(?:root canal|nerve removed)\b|\b(?:root canal|nerve removed)\b.{0,55}\b(?:not sure|unsure|don't know|do not know|don't remember|do not remember)\b/i,
    "c3.dental-work": /\b(?:a lot of|lots of|extensive)\b.{0,25}\bdental work\b/i,
    "c3.treated-teeth-unknown": /\b(?:don't|do not|can't|cannot)\b.{0,20}\bremember\b.{0,35}\bwhich teeth\b/i,
    "c3.painful-tooth-not-extracted": /\b(?:tooth|it)\b.{0,30}\b(?:still there|has a crown|has the crown)\b/i,
    "c3.dentist-contact": /\bcalled\b.{0,20}\bdentist\b.{0,35}\b(?:couple of|two) days? ago\b|\b(?:couple of|two) days? ago\b.{0,35}\bcalled\b.{0,20}\bdentist\b/i,
    "c3.appointment": /\bappointment\b.{0,30}\bnext week\b|\bnext week\b.{0,30}\bappointment\b/i,
    "c3.pepcid-details-unknown": /\bpepcid\b.{0,65}\b(?:don't know|do not know|not sure|unknown)\b.{0,30}\b(?:dose|frequency|how often)\b|\b(?:don't know|do not know|not sure)\b.{0,65}\b(?:dose|frequency)\b/i,
    "c3.prior-antibiotics-unknown": /\b(?:don't|do not|can't|cannot)\b.{0,30}\bremember\b.{0,45}\bantibiotics?\b/i,
    "c3.prior-acetaminophen-unknown": /\b(?:don't|do not|can't|cannot)\b.{0,30}\bremember\b.{0,45}\b(?:tylenol|acetaminophen)\b/i,
    "c3.temperature-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,35}\b(?:exact|measured)\b.{0,15}\btemperature\b/i,
    "c3.heart-rate-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,35}\b(?:exact )?(?:heart rate|pulse)\b/i,
    "c3.diagnosis-unknown": /\b(?:don't|do not)\b.{0,25}\bknow\b.{0,25}\b(?:diagnosis|what (?:it|this) is|what is wrong)\b/i,
    "c2.swelling": /\bright\b.{0,25}\b(?:cheek|face)\b.{0,25}\b(?:swollen|swelling)\b|\b(?:swollen|swelling)\b.{0,25}\bright\b.{0,20}\b(?:cheek|face|side)\b/i,
    "c2.location": /\b(?:upper|top|maxillary)\b.{0,30}\bright\b|\bright\b.{0,30}\b(?:upper|top|maxillary)\b/i,
    "c2.systemic-timeline": /\b(?:about |around |approximately )?(?:twenty[- ]four|24)\s+hours?\b|\b(?:about |around |approximately )?(?:one|a)\s+day\b/i,
    "c2.severity": /\b(?:eight|8)\s*(?:\/|out of)\s*(?:ten|10)\b|^\s*(?:eight|8)[.!]?\s*$/i,
    "c2.breathing-negative": /\b(?:no|not|don't|do not)\b.{0,45}\b(?:trouble breathing|difficulty breathing|short of breath)\b/i,
    "c2.liquids-positive": /\b(?:can|able to)\b.{0,30}\bswallow\b.{0,20}\b(?:liquids?|water|drinks?)\b/i,
    "c2.voice-negative": /\b(?:no|not|hasn't|has not)\b.{0,35}\bvoice\b.{0,25}\b(?:change|changed|muffled)\b|\bvoice\b.{0,25}\b(?:normal|unchanged)\b/i,
    "c2.drooling-negative": /\b(?:no|not|don't|do not|am not)\b.{0,30}\bdrool(?:ing)?\b/i,
    "c2.mouth-opening": /\bcan\b.{0,25}\bopen\b.{0,15}\bmouth\b.{0,35}\b(?:uncomfortable|discomfort|hurts?)\b/i,
    "c2.healthy": /\b(?:healthy|excellent health|no known medical problems?|don't have any medical problems?|do not have any medical problems?)\b/i,
    "c2.med": /\b(?:ibuprofen|motrin|advil)\b.{0,35}\b400\s*(?:mg|milligrams?)\b.{0,45}\b(?:six|6)\s+hours?\b|\b400\s*(?:mg|milligrams?)\b.{0,35}\b(?:ibuprofen|motrin|advil)\b.{0,45}\b(?:six|6)\s+hours?\b/i,
    "c2.ibuprofen": /\b(?:can|able to|no (?:known )?contraindication|no problem)\b.{0,35}\b(?:ibuprofen|motrin|advil)\b|\b(?:ibuprofen|motrin|advil)\b.{0,35}\b(?:can|okay|fine|no problem|no contraindication)\b/i,
    "c2.opioid": /\b(?:no|not|never|haven't|have not|don't|do not)\b.{0,55}\b(?:opioids?|opiates?|narcotics?|misus(?:e|ed)|abus(?:e|ed)|dependen(?:ce|t)|addict(?:ion|ed))\b/i,
    "c2.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:not allergic|don't have|do not have)\b.{0,35}\b(?:allerg|penicillin)\b/i,
    "c2.smoking": /\b(?:smoke|smoking)\b.{0,35}\b(?:half|one[- ]half|0\.5)\b.{0,20}\bpack\b|\bhalf[- ]?(?:a )?pack\b.{0,30}\b(?:smoke|cigarette)/i,
    "c2.alcohol": /\b(?:rare|rarely|occasionally)\b.{0,25}\b(?:alcohol|drink)\b|\b(?:alcohol|drink)\b.{0,25}\b(?:rare|rarely|occasionally)\b/i,
    "c2.illicit-drugs": /\b(?:no|not|don't|do not|never|deny|denies)\b.{0,35}\b(?:illicit|recreational|street) drugs?\b/i,
    "c2.access": /\b(?:haven't|have not|not)\b.{0,35}\b(?:dentist|dental care)\b.{0,55}\b(?:lost|medicaid|last year)\b|\blost\b.{0,25}\bmedicaid\b.{0,35}\b(?:last year|dentist|dental care)\b/i,
    "c2.prior-antibiotics-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\bantibiotics?\b|\bantibiotics?\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c2.prior-root-canal-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\broot canal\b|\broot canal\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c2.prior-treatment-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\b(?:treatment|procedure)\b|\b(?:treatment|procedure)\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c2.painful-tooth-not-extracted": /\b(?:tooth|it)\b.{0,25}\b(?:is|it's)\s+still there\b|\b(?:was not|wasn't|has not been|hasn't been|never was)\b.{0,25}\bextract(?:ed|ion)\b/i,
    "c2.other-extraction-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,75}\b(?:another|other|any)\s+tooth\b.{0,30}\b(?:extract(?:ed|ion)|pulled)\b|\b(?:another|other|any)\s+tooth\b.{0,45}\b(?:extract(?:ed|ion)|pulled)\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c2.temperature-unknown": /\b(?:don't|do not|not sure|unknown)\b.{0,35}\b(?:exact )?temperature\b|\btemperature\b.{0,35}\b(?:don't know|do not know|not sure|unknown)\b/i,
    "c2.heart-rate-unknown": /\b(?:don't|do not|not sure|unknown)\b.{0,35}\b(?:heart rate|pulse)\b|\b(?:heart rate|pulse)\b.{0,35}\b(?:don't know|do not know|not sure|unknown)\b/i,
    "c2.sirs-unknown": /\b(?:don't|do not|not sure|unknown)\b.{0,45}\bSIRS\b|\bSIRS\b.{0,45}\b(?:don't know|do not know|not sure|unknown)\b/i,
    "c4.severity": /(?:^|\b)(?:about |around |approximately )?(?:seven|7)(?:\s*(?:\/|out of)\s*10)?(?:\b|[.!?]?$)/i,
    "c1.opioid": /\b(?:no|not|never|haven't|have not|don't|do not)\b.{0,55}\b(?:opioids?|opiates?|narcotics?|prescription (?:painkillers?|pain (?:medication|medicine|pills?))|misus(?:e|ed)|abus(?:e|ed)|dependen(?:ce|t)|addict(?:ion|ed))\b|\b(?:opioids?|opiates?|narcotics?)\b.{0,35}\b(?:no|not|never|haven't|have not|don't|do not)\b/i,
    "c1.location": /\b(?:lower|bottom|mandibular)\b.{0,25}\bleft\b|\bleft\b.{0,25}\b(?:lower|bottom|mandibular)\b/i,
    "c1.duration": /\b(?:four|4)\s+days?\b/i,
    "c1.onset-uncertain": /\b(?:don't|do not|can't|cannot|not sure|unsure)\b.{0,45}\b(?:exact|exactly|start|started|began|onset|when)\b/i,
    "c1.initial-severity": /\b(?:about |around |approximately )?(?:three|3)(?:\s*(?:\/|out of)\s*10)?\b/i,
    "c1.severity": /\b(?:eight|8)\s*(?:\/|out of)\s*(?:ten|10)\b|^\s*(?:eight|8)[.!]?\s*$/i,
    "c1.airway-duration": /\b(?:about |around |approximately )?(?:twelve|12)\s+hours?\b/i,
    "c1.swelling-location": /\b(?:both|bilateral)\b.{0,35}\b(?:side|jaw|submandibular|swell)/i,
    "c1.upright-breathing": /\b(?:no|not|don't|do not)\b.{0,45}\b(?:short of breath|breath(?:ing)?)\b.{0,35}\b(?:sitting|upright)\b|\b(?:sitting|upright)\b.{0,35}\b(?:no|not|normally|fine|okay)\b/i,
    "c1.dyspnea-supine": /\b(?:short of breath|hard to breathe|trouble breathing|chok(?:e|ing))\b.{0,45}\b(?:lie|lying|flat|back)\b|\b(?:lie|lying|flat|back)\b.{0,45}\b(?:short of breath|hard to breathe|trouble breathing|chok(?:e|ing))\b/i,
    "c1.home-temperature": /\b(?:didn't|did not|haven't|have not|never|no)\b.{0,45}\b(?:measure|measured|check|checked|thermometer|temperature)\b|\b(?:don't|do not) know\b.{0,25}\b(?:exact|number|temperature)\b/i,
    "c1.chest-pain": /\b(?:no|not|don't|do not|haven't|have not)\b.{0,30}\bchest pain\b/i,
    "c1.diabetes": /\b(?:type\s*2\s+)?diabetes\b/i,
    "c1.hypertension": /\b(?:hypertension|high blood pressure)\b/i,
    "c1.metformin": /\bmetformin\b/i,
    "c1.lisinopril": /\blisinopril\b/i,
    "c1.nkda": /\bno known (?:drug|medication)?\s*allerg|\b(?:not|not allergic|don't|do not)\b.{0,35}\b(?:allerg|penicillin)\b/i,
    "c1.ibuprofen": /\b(?:can|able to|no (?:known )?contraindication|no problem)\b.{0,35}\b(?:ibuprofen|motrin|advil)\b|\b(?:ibuprofen|motrin|advil)\b.{0,35}\b(?:can|okay|fine|no problem|no contraindication)\b/i,
    "c1.smoking": /\b(?:smoke|smoking)\b.{0,30}\b(?:one|1|a)\s+pack\b|\b(?:one|1|a)\s+pack\b.{0,30}\b(?:smoke|cigarette)/i,
    "c1.alcohol": /\b(?:no|not|don't|do not|never)\b.{0,30}\b(?:alcohol|drink)\b/i,
    "c1.illicit-drugs": /\b(?:no|not|don't|do not|never)\b.{0,35}\b(?:illicit|recreational|street) drugs?\b/i,
    "c1.prior-antibiotics-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\b(?:antibiotics?|took|taken)\b|\bantibiotics?\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c1.otc-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure)\b.{0,45}\b(?:which|what|name|exact|product|dose)\b|\b(?:over[- ]the[- ]counter|otc|pain (?:medicine|medication))\b.{0,45}\b(?:don't know|not sure|can't remember|cannot remember)\b/i,
    "c1.prior-root-canal-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\broot canal\b|\broot canal\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
    "c1.prior-extraction-unknown": /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b.{0,65}\b(?:extract(?:ion|ed)|pulled)\b|\b(?:extract(?:ion|ed)|pulled)\b.{0,65}\b(?:don't know|do not know|not sure|unsure|don't recall|do not recall|can't remember|cannot remember)\b/i,
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
  const knownPositiveFever = /\b(?:has|have|felt|feels|feeling)\b.{0,25}\bfever(?:ish)?\b/i.test(factText) &&
    !/\b(?:no|not|haven't|have not|hasn't|has not|never)\b.{0,30}\bfever(?:ish)?\b/i.test(factText);
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
  if (facts.some((fact) => fact.id.startsWith("c3."))) {
    const case3Contradiction = findCase3Contradiction(response);
    if (case3Contradiction) return case3Contradiction;
  }
  if (facts.some((fact) => fact.id.startsWith("c4."))) {
    const case4Contradiction = findCase4Contradiction(response);
    if (case4Contradiction) return case4Contradiction;
  }
  if (facts.some((fact) => fact.id === "c2.swelling") && /\b(?:no|not|haven't|have not)\b.{0,25}\b(?:swollen|swelling)\b/i.test(response)) {
    return "contradiction of Case 2 right-cheek swelling";
  }
  if (facts.some((fact) => fact.id.startsWith("c2."))) {
    const case2Contradiction = findCase2Contradiction(response);
    if (case2Contradiction) return case2Contradiction;
  }

  if (facts.some((fact) => fact.id.startsWith("c5."))) {
    const case5Contradiction = findCase5Contradiction(response);
    if (case5Contradiction) return case5Contradiction;
  }

  if (facts.some((fact) => fact.id === "c1.opioid") && affirmsOpioidHistory(response)) {
    return "contradiction of Case 1 no-opioid history";
  }

  if (facts.some((fact) => fact.id.startsWith("c1."))) {
    const case1Contradiction = findCase1Contradiction(response);
    if (case1Contradiction) return case1Contradiction;
  }

  return undefined;
}

function findCase5Contradiction(response: string): string | undefined {
  if (/\b(?:upper[- ]right|upper[- ]left|lower[- ]right|right (?:upper|lower))\b/i.test(response)) return "contradiction of Case 5 lower-left location";
  if (/\b(?:first molar|tooth number|tooth #|number \d+)\b/i.test(response) && !/\b(?:don't|do not|can't|cannot|not sure|unsure)\b/i.test(response)) return "invented Case 5 patient knowledge of exact tooth";
  if (/\b(?:started|began|worsened|worsening|getting worse|hurting)\b.{0,35}\b(?:three|3|five|5|seven|7)\s+days?\b/i.test(response)) return "contradiction of Case 5 four-day duration";
  if (/\bcold\b.{0,35}\b(?:doesn't|does not|no longer|not)\b.{0,20}\b(?:hurt|worse|pain)|\b(?:the )?pain\b.{0,15}\b(?:stops?|goes away)\b.{0,20}\b(?:immediately|right away)\b.{0,25}\bcold\b/i.test(response)) return "contradiction of Case 5 lingering cold pain";
  if (/\b(?:face|gum)\b.{0,20}\b(?:is|feels|looks)?\s*(?:swollen|swelling)\b|\b(?:i have|i've got|there is)\b.{0,25}\b(?:abscess|pus|drainage|fever)\b/i.test(response)) return "contradiction of Case 5 infection negatives";
  if (/\b(?:i(?:'m| am)|yes,? i(?:'m| am))\s+(?!not\b)allergic\b.{0,25}\bpenicillin\b/i.test(response)) return "contradiction of Case 5 no penicillin allergy";
  if (affirmsOpioidHistory(response)) return "contradiction of Case 5 no-opioid history";
  if (/\b(?:smoke|smoking)\b.{0,30}\b(?:one|1)\s+pack\b|\b(?:don't|do not|never)\b.{0,20}\bsmok/i.test(response)) return "contradiction of Case 5 half-pack smoking history";
  if (!/\b(?:not sure|unsure|don't know|do not know)\b/i.test(response) && /\b(?:i have|i've had|already had)\b.{0,30}\broot canal\b|\b(?:no|never|haven't|have not)\b.{0,30}\broot canal\b/i.test(response)) return "invented Case 5 root-canal history";
  if (/\b(?:painful|current|this) tooth\b.{0,30}\b(?:was|has been|already)\b.{0,15}\b(?:pulled|extracted|removed)\b/i.test(response)) return "contradiction of Case 5 painful-tooth presence";
  if (/\b(?:i have|i've got|already have)\b.{0,30}\b(?:dentist|appointment)\b/i.test(response)) return "contradiction of Case 5 dental access";
  if (/\b(?:i know|diagnosis is|i have)\b.{0,30}\birreversible pulpitis\b/i.test(response)) return "invented Case 5 diagnosis knowledge";
  return undefined;
}

function findCase2Contradiction(response: string): string | undefined {
  if (/\b(?:upper[- ]left|lower[- ]right|lower[- ]left|left (?:upper|lower)|right lower)\b/i.test(response)) return "contradiction of Case 2 upper-right location";
  if (/\b(?:pain|toothache|dental pain)\b.{0,45}\b(?:yesterday|one day|24 hours|two days|three days|four days|five days|six days|two weeks)\b/i.test(response)) return "contradiction of Case 2 seven-day dental-pain duration";
  if (/\b(?:cheek|swelling|fever|chills|fatigue)\b.{0,45}\b(?:seven days|one week|full week)\b/i.test(response)) return "contradiction of Case 2 24-hour systemic timeline";
  if (/\b(?:[0-7]|9|10)\s*(?:\/|out of)\s*10\b/i.test(response) && /\b(?:now|current|currently|pain is|rate)\b/i.test(response)) return "contradiction of Case 2 current 8/10 severity";
  if (/\b(?:i(?:'m| am))\s+(?!not\b)(?:drool(?:ing)?|short of breath|having (?:trouble|difficulty) breathing)\b|\bi have\s+(?!no\b|not\b)(?:trouble|difficulty)\b.{0,15}\bbreathing\b|\bmy voice\b.{0,15}\bmuffled\b|\b(?:cannot|can't|unable to)\b.{0,20}\bswallow\b.{0,15}\bliquids?\b/i.test(response)) return "contradiction of Case 2 airway negatives";
  if (/\b(?:cannot|can't|unable to)\b.{0,20}\bopen\b.{0,15}\bmouth\b|\b(?:have|has)\b.{0,15}\btrismus\b/i.test(response)) return "contradiction of Case 2 mouth-opening ability";
  if (/\b(?:i have|i've got|diagnosed with)\b.{0,25}\b(?:diabetes|hypertension|heart disease|kidney disease|immune suppression)\b/i.test(response)) return "invented Case 2 medical history";
  if (/\b(?:i take|i use|i'm on)\b.{0,25}\b(?:insulin|acetaminophen|tylenol|chronic prescription)\b/i.test(response)) return "invented Case 2 medication history";
  if (affirmsOpioidHistory(response)) return "contradiction of Case 2 no-opioid history";
  if (/\b(?:i(?:'m| am)|yes,? i(?:'m| am))\s+(?!not\b)allergic\b.{0,25}\bpenicillin\b/i.test(response)) return "contradiction of Case 2 no penicillin allergy";
  if (/\b(?:smoke|smoking)\b.{0,30}\b(?:one|1)\s+pack\b|\b(?:don't|do not|never)\b.{0,20}\bsmok/i.test(response)) return "contradiction of Case 2 half-pack smoking history";
  if (/\b(?:don't|do not|never)\b.{0,25}\b(?:drink|alcohol)\b|\b(?:daily|every day|frequently|heavily)\b.{0,25}\b(?:drink|alcohol)\b|\b(?:drink|alcohol)\b.{0,25}\b(?:daily|every day|frequently|heavily)\b/i.test(response)) return "contradiction of Case 2 rare alcohol use";
  const uncertainty = /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b/i.test(response);
  if (!uncertainty && /\bantibiotics?\b/i.test(response) && /\b(?:already|before|previously|ever|prior|took|taken|didn't|did not|haven't|have not|never)\b/i.test(response)) return "invented Case 2 prior antibiotic history";
  if (!uncertainty && /\broot canal\b/i.test(response) && /\b(?:already|before|previously|ever|prior|had|didn't|did not|haven't|have not|never|no)\b/i.test(response)) return "invented Case 2 root-canal history";
  if (!uncertainty && /\b(?:treatment|procedure)\b/i.test(response) && /\b(?:already|before|previously|ever|prior|had|didn't|did not|haven't|have not|never|no)\b/i.test(response)) return "invented Case 2 treatment history";
  if (/\b(?:already\s+had\s+)?(?:this|that|same|painful|upper[- ]right)(?:\s+painful)?\s+(?:tooth|molar)\b.{0,45}\b(?:was|has been|had been|already)?\s*extract(?:ed|ion)\b|\bextract(?:ed|ion)\b.{0,45}\b(?:this|that|same|painful|upper[- ]right)\s+(?:tooth|molar)\b/i.test(response)) return "contradiction of Case 2 present painful tooth";
  if (!uncertainty && /\b(?:another|other|any)\s+tooth\b.{0,40}\b(?:extract(?:ed|ion)|pulled)\b/i.test(response)) return "invented Case 2 other-tooth extraction history";
  if (/\b(?:temperature|fever)\b.{0,20}\b103\b|\b103\s*(?:degrees?|°)/i.test(response)) return "invented Case 2 exact home temperature";
  if (!uncertainty && /\b(?:i meet|i have|yes)\b.{0,15}\bSIRS\b/i.test(response)) return "invented Case 2 SIRS knowledge";
  return undefined;
}

function findCase3Contradiction(response: string): string | undefined {
  if (/\b(?:no|don't have|do not have)\b.{0,30}\b(?:medical history|medical problems?|health conditions?)\b/i.test(response)) return "contradiction of Case 3 stomach-ulcer history";
  if (/\b(?:upper[- ]right|upper[- ]left|lower[- ]left|left (?:upper|lower)|right upper)\b/i.test(response)) return "contradiction of Case 3 lower-right location";
  if (/\b(?:pain|toothache|dental pain|it)\b.{0,25}\b(?:hurt|hurting|started|began|worsening|has hurt)\b.{0,35}\b(?:today|one day|two days|four days|five days|six days|seven days|one week|two weeks)\b|\b(?:hurt|hurting|started|began|worsening)\b.{0,35}\b(?:today|one day|two days|four days|five days|six days|seven days|one week|two weeks)\b/i.test(response)) return "contradiction of Case 3 three-day duration";
  if (/\b(?:[0-7]|9|10)\s*(?:\/|out of)\s*10\b/i.test(response) && /\b(?:now|current|currently|pain is|rate)\b/i.test(response)) return "contradiction of Case 3 current 8/10 severity";
  if (/\bleft ear\b/i.test(response)) return "contradiction of Case 3 right-ear radiation";
  if (/\bcold\b.{0,30}\b(?:hurt|hurts|painful|worse|sensitive|lingers?)\b/i.test(response) && !/\b(?:no|not|doesn't|does not)\b/i.test(response)) return "contradiction of Case 3 no cold pain";
  if (/\b(?:no|not|doesn't|does not)\b.{0,30}\b(?:bite|biting|chew|chewing|tap|tapping|percussion)\b.{0,30}\b(?:hurt|pain|tender)\b/i.test(response)) return "contradiction of Case 3 biting or percussion pain";
  if (/\b(?:i(?:'ve| have| am|'m)|feeling)\b.{0,20}\bfever(?:ish)?\b/i.test(response) && !/\b(?:no|not|haven't|have not|don't|do not)\b.{0,30}\bfever(?:ish)?\b/i.test(response)) return "contradiction of Case 3 no-fever history";
  if (/\b(?:i have|i'm having|i am having)\b\s+(?!no\b|not\b).{0,25}\b(?:trouble|difficulty)\b.{0,15}\b(?:breathing|swallowing)\b|\bmy voice\b.{0,20}\b(?:muffled|changed)\b|\b(?:cannot|can't|unable to)\b.{0,20}\bopen\b.{0,15}\bmouth\b/i.test(response)) return "contradiction of Case 3 airway or mouth-opening negatives";
  if (/\b(?:i have|my)\b.{0,20}\b(?:chest pain|stiff neck|neck stiffness|neck is stiff)\b/i.test(response)) return "contradiction of Case 3 chest or neck negatives";
  if (/\b(?:i have|diagnosed with)\b.{0,25}\b(?:diabetes|hypertension|kidney disease|liver disease|heart disease|bleeding disorder|gerd)\b/i.test(response)) return "invented Case 3 medical history";
  if (/\b(?:daily|every day|once a day|twice a day)\b.{0,30}\bpepcid\b|\bpepcid\b.{0,30}\b(?:daily|every day|once a day|twice a day|\d+\s*mg)\b/i.test(response)) return "invented Case 3 Pepcid details";
  if (/\b(?:i(?:'m| am))\s+(?!not\b)allergic\b.{0,30}\b(?:ibuprofen|advil|motrin|penicillin)\b/i.test(response)) return "contradiction of Case 3 allergy history";
  if (/\b(?:ibuprofen|advil|motrin)\b.{0,30}\b(?:doesn't bother|does not bother|safe|fine|tolerate well|no problem)\b/i.test(response)) return "contradiction of Case 3 ibuprofen intolerance";
  if (affirmsOpioidHistory(response)) return "contradiction of Case 3 no-opioid history";
  if (/\b(?:smoke|smoking)\b.{0,30}\b(?:half|one|1)\b.{0,15}\bpack\b|\bi smoke\b/i.test(response)) return "contradiction of Case 3 non-smoking history";
  if (/\b(?:never|don't|do not)\b.{0,20}\b(?:drink|alcohol)\b|\b(?:daily|every day|heavily)\b.{0,20}\b(?:drink|alcohol)\b|\b(?:drink|alcohol)\b.{0,20}\b(?:daily|every day|heavily)\b/i.test(response)) return "contradiction of Case 3 occasional alcohol use";
  if (/\b(?:i use|yes)\b.{0,25}\b(?:illicit|recreational|street) drugs?\b/i.test(response)) return "contradiction of Case 3 no illicit-drug use";
  const uncertainty = /\b(?:don't|do not|can't|cannot|not sure|unsure|don't remember|do not remember)\b/i.test(response);
  if (!uncertainty && /\broot canal\b/i.test(response) && /\b(?:definitely|already|had|never|didn't|did not|yes|no)\b/i.test(response)) return "invented Case 3 root-canal history";
  if (/\b(?:never|no)\b.{0,30}\bdental work\b/i.test(response)) return "contradiction of Case 3 extensive dental work";
  if (/\b(?:this|that|painful)\b.{0,20}\b(?:tooth|molar)\b.{0,30}\b(?:was|already|had been)?\s*extract(?:ed|ion)\b/i.test(response)) return "contradiction of Case 3 present crowned tooth";
  if (!uncertainty && /\b(?:antibiotics?|tylenol|acetaminophen)\b/i.test(response) && /\b(?:already|before|took|taken|never|didn't|did not)\b/i.test(response)) return "invented Case 3 pre-arrival medication history";
  if (/\b(?:measured|temperature was|fever of)\b.{0,25}\b103\b|\b103\s*(?:degrees?|°)/i.test(response)) return "invented Case 3 measured temperature";
  if (/\b(?:i have|i currently have|i know|it is|diagnosis is)\b.{0,30}\b(?:periapical abscess|systemic infection|facial cellulitis|cellulitis)\b/i.test(response)) return "invented Case 3 diagnosis knowledge";
  return undefined;
}

function findCase4Contradiction(response: string): string | undefined {
  if (/\b(?:lower[- ]right|upper[- ]left|upper[- ]right|right (?:lower|upper)|left upper)\b/i.test(response)) return "contradiction of Case 4 lower-left location";
  if (/\b(?:returned pain|current pain|pain)\b.{0,40}\b(?:three|3|seven|7)\s+days?\b/i.test(response)) return "contradiction of Case 4 five-day worsening course";
  if (/\b(?:sharp|severe)?\s*(?:biting|bite) pain\b.{0,30}\bstarted\b.{0,20}\b(?:five|5)\s+days? ago\b.{0,25}\b(?:no change|unchanged)\b/i.test(response)) return "contradiction of Case 4 48-hour biting-pain intensification";
  if (/\b(?:eight|8)\s*(?:\/|out of)\s*(?:ten|10)\b/i.test(response)) return "contradiction of Case 4 current 7/10 severity";
  if (/\bcold\b.{0,30}\b(?:still|currently|now)\b.{0,20}\b(?:hurts?|painful|worse)\b/i.test(response)) return "contradiction of Case 4 no current cold pain";
  if (/\bcold\b.{0,30}\b(?:never|did not|didn't)\b.{0,20}\b(?:hurt|pain)\b|\b(?:never|did not|didn't)\b.{0,30}\bcold\b.{0,20}\b(?:hurt|pain)\b/i.test(response)) return "contradiction of Case 4 historical cold pain";
  if (/\b(?:definitely|certainly)\b.{0,30}\b(?:filling|restoration)\b.{0,20}\b(?:broke|broken|failed)\b|\bfilling\b.{0,30}\bdefinitely\b.{0,20}\b(?:broke|broken|failed)\b/i.test(response)) return "invented Case 4 confirmed filling fracture";
  if (/\bi have\b\s+(?!no\b|not\b).{0,25}\b(?:facial swelling|swelling|pus|purulence|drainage|abscess)\b|\bmy face is\b\s+(?!not\b).{0,15}\bswollen\b|\bthere is\b\s+(?!no\b|not\b).{0,20}\b(?:pus|purulence|drainage|abscess)\b/i.test(response)) return "contradiction of Case 4 no infection signs";
  if (/\b(?:i have|i'm having|i am having|i am|i'm)\b\s+(?!no\b|not\b).{0,20}\b(?:fever|chills|drooling|short of breath|trouble swallowing|difficulty swallowing)\b|\b(?:cannot|can't|unable to)\b.{0,20}\b(?:swallow|open\b.{0,15}\bmouth)\b|\bmy voice\b.{0,20}\b(?:muffled|changed)\b/i.test(response)) return "contradiction of Case 4 systemic or airway negatives";
  if (/\b(?:i have|diagnosed with)\b.{0,25}\b(?:diabetes|hypertension|stomach ulcers|kidney disease|heart disease|immune suppression)\b/i.test(response)) return "invented Case 4 medical history";
  if (/\b(?:cannot|can't|shouldn't|should not)\b.{0,25}\b(?:take|use)\b.{0,15}\b(?:ibuprofen|advil|motrin)\b/i.test(response)) return "contradiction of Case 4 ibuprofen suitability";
  if (/\b(?:not allergic|no allergy|don't have|do not have)\b.{0,30}\bpenicillin\b|\bpenicillin\b.{0,25}\b(?:stomach upset|anaphylaxis|angioedema)\b/i.test(response)) return "contradiction of Case 4 penicillin-hives history";
  if (affirmsOpioidHistory(response)) return "contradiction of Case 4 no-opioid history";
  if (/\b(?:smoke|smoking)\b.{0,30}\b(?:half|0\.5)\b.{0,15}\bpack\b/i.test(response)) return "contradiction of Case 4 one-pack smoking history";
  if (/\b(?:never|don't|do not)\b.{0,20}\b(?:drink|alcohol)\b|\b(?:drink|alcohol)\b.{0,20}\b(?:daily|every day|heavily)\b/i.test(response)) return "contradiction of Case 4 occasional alcohol use";
  if (/\b(?:i use|yes)\b.{0,25}\b(?:illicit|recreational|street) drugs?\b/i.test(response)) return "contradiction of Case 4 no illicit-drug use";
  if (/\b(?:recently|last week|last month)\b.{0,25}\b(?:dentist|dental visit)\b|\b(?:dentist|dental visit)\b.{0,25}\b(?:recently|last week|last month)\b|\bappointment\b.{0,25}\bnext week\b/i.test(response)) return "contradiction of Case 4 dental access history";
  if (/\b(?:want|prefer|would like)\b.{0,20}(?:\b(?:extract|remove|pull)\b.{0,15}\btooth\b|\btooth\b.{0,15}\b(?:extracted|removed|pulled)\b)/i.test(response)) return "contradiction of Case 4 tooth-saving goal";
  const uncertainty = /\b(?:not sure|unsure|don't know|do not know|don't remember|do not remember)\b/i.test(response);
  if (!uncertainty && /\b(?:surgery|root canal|tylenol|acetaminophen|antibiotics?)\b/i.test(response) && /\b(?:yes|no|never|already|had|took|taken|didn't|did not)\b/i.test(response)) return "invented Case 4 unknown history";
  if (/\b(?:this|that|painful)\b.{0,20}\b(?:tooth|molar)\b.{0,30}\b(?:was|already|had been)?\s*extract(?:ed|ion)\b/i.test(response)) return "contradiction of Case 4 present filled tooth";
  if (/\b(?:measured|temperature was|fever of)\b.{0,25}\b103\b|\b103\s*(?:degrees?|°)/i.test(response)) return "invented Case 4 measured temperature";
  if (/\b(?:i know|diagnosis is|i have)\b.{0,35}\b(?:necrotic pulp|acute apical periodontitis|periapical abscess)\b/i.test(response)) return "invented Case 4 diagnosis knowledge";
  if (/\b(?:i know|only|about)\b.{0,25}\b70\s*%.{0,25}\b(?:tooth|crown)\b/i.test(response)) return "invented Case 4 tooth-structure percentage knowledge";
  return undefined;
}

function findCase1Contradiction(response: string): string | undefined {
  if (/\b(?:no|not|don't|do not|never)\b.{0,30}\b(?:type\s*2\s+)?diabetes\b/i.test(response)) return "contradiction of Case 1 diabetes history";
  if (/\b(?:no|not|don't|do not|never)\b.{0,30}\b(?:hypertension|high blood pressure)\b/i.test(response)) return "contradiction of Case 1 hypertension history";
  if (/\b(?:upper|top|maxillary|right)\b.{0,25}\b(?:tooth|molar|jaw|side)\b|\b(?:tooth|molar|jaw|side)\b.{0,25}\bright\b/i.test(response)) return "contradiction of Case 1 lower-left dental source";
  if (/\b(?:pain|toothache|it)\b.{0,35}\b(?:two weeks?|14 days?|one week|seven days?|two days?|yesterday)\b/i.test(response)) return "contradiction of Case 1 four-day dental-pain duration";
  if (/\b(?:short of breath|trouble breathing|hard to breathe)\b.{0,35}\b(?:while )?(?:sitting|upright)\b/i.test(response) && !/\b(?:no|not|don't|do not)\b/i.test(response)) return "contradiction of Case 1 upright breathing status";
  if (/\b(?:measured|checked|temperature was|fever of)\b.{0,25}\b103\b|\b103\s*(?:degrees?|°)/i.test(response)) return "invented Case 1 home temperature";
  if (/\b(?:i(?:'m| am)|yes,? i(?:'m| am))\s+(?!not\b)allergic\b.{0,25}\bpenicillin\b/i.test(response)) return "contradiction of Case 1 no penicillin allergy";
  if (/\b(?:i\s+(?:use|take|am on)|yes,? i\s+(?:use|take))\b.{0,25}\binsulin\b/i.test(response)) return "invented Case 1 insulin use";
  if (/\b(?:i\s+(?:drink|use)|yes,? i\s+(?:drink|use))\b.{0,30}\b(?:alcohol|beer|wine|liquor)\b/i.test(response)) return "contradiction of Case 1 no alcohol use";
  if (/\b(?:i\s+(?:use|take)|yes,? i\s+(?:use|take))\b.{0,30}\b(?:illicit|recreational|street) drugs?\b/i.test(response)) return "contradiction of Case 1 no illicit-drug use";
  const uncertainty = /\b(?:don't|do not|can't|cannot|not sure|unsure|do not recall|don't recall|can't remember|cannot remember)\b/i.test(response);
  if (!uncertainty && /\bantibiotics?\b/i.test(response) && /\b(?:already|before|previously|ever|prior|took|taken|didn't|did not|haven't|have not|never)\b/i.test(response)) return "invented Case 1 prior antibiotic history";
  if (!uncertainty && /\broot canal\b/i.test(response) && /\b(?:already|before|previously|ever|prior|had|didn't|did not|haven't|have not|never|no)\b/i.test(response)) return "invented Case 1 root-canal history";
  if (!uncertainty && /\b(?:extraction|extracted|tooth pulled)\b/i.test(response) && /\b(?:already|before|previously|ever|prior|had|didn't|did not|haven't|have not|never|no)\b/i.test(response)) return "invented Case 1 extraction history";
  if (/\bi\s+(?:took|used|tried)\b.{0,25}\b(?:ibuprofen|advil|motrin|acetaminophen|tylenol|aspirin)\b/i.test(response)) return "invented Case 1 exact over-the-counter analgesic";
  if (/\b(?:[0-7]|9|10)\s*(?:\/|out of)\s*10\b/i.test(response) && /\b(?:now|current|currently|pain is|rate)\b/i.test(response)) return "contradiction of Case 1 current 8/10 severity";
  return undefined;
}

function affirmsOpioidHistory(response: string): boolean {
  const opioid = /\b(?:opioids?|opiates?|narcotics?|prescription (?:painkillers?|pain (?:medication|medicine|pills?)))\b/i;
  const misuse = /\b(?:opioid\s+)?(?:misus(?:e|ed)|abus(?:e|ed)|dependen(?:ce|t)|addict(?:ion|ed))\b/i;
  if (!opioid.test(response) && !misuse.test(response)) return false;
  const denial = /\b(?:no|not|never|haven't|have not|hadn't|didn't|did not|don't|do not|without)\b[^.!?]{0,65}\b(?:opioids?|opiates?|narcotics?|prescription (?:painkillers?|pain (?:medication|medicine|pills?))|misus(?:e|ed)|abus(?:e|ed)|dependen(?:ce|t)|addict(?:ion|ed))\b/i;
  if (denial.test(response)) return false;
  return /\b(?:yes|i(?:'ve| have| had| used| took| was| am)|history of|used to)\b/i.test(response);
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
