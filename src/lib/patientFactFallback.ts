import type { PatientDisclosureState } from "./patientDisclosure";
import { requiredFactsForTurn } from "./patientTurnFacts";
import { backgroundFallback } from "./patientBackgroundTurn";
import { residenceFallback } from "./patientResidence";
import { transportationFallback } from "./patientTransportation";

/** Render only turn-required source facts; never fall back to a whole history. */
export function patientFactSentence(source: string): string {
  let text = source.replace(/the patient['’]s/gi, "my");
  text = text.replace(/(^|[.!?;]\s*|\b(?:and|but)\s+)the patient ((?:(?:last|currently|usually|normally|previously|already|never|always|often)\s+)*)(\w+)/gi, (_all, prefix: string, adverbs: string, verb: string) => {
    const irregular: Record<string,string> = {is:"am",has:"have",does:"do",was:"was",were:"was"};
    const base = irregular[verb.toLowerCase()] ?? (/ies$/.test(verb) ? verb.slice(0,-3)+"y" : /(?:ches|shes|sses|xes|zes|oes)$/.test(verb) ? verb.slice(0,-2) : /s$/.test(verb) ? verb.slice(0,-1) : verb);
    return `${prefix}I ${adverbs}${base}`;
  }).replace(/\bthe patient\b/gi, "me").replace(/\btheir\b/gi,"my").replace(/\bpercussion\b/gi,"tapping").replace(/\bspontaneously\b/gi,"on its own");
  if (/^I\b/.test(text) && !/\b(?:who|which)\b/.test(text)) text = text.replace(/\band has\b/g,"and have").replace(/\band does\b/g,"and do").replace(/\band is\b/g,"and am");
  const discomfort = /^There is (slight|some) (.+) discomfort[.]?$/i.exec(text);
  return discomfort ? `I feel ${discomfort[1].toLowerCase()} discomfort with ${discomfort[2]}.` : text;
}

export function patientFactFallback(
  disclosureState: PatientDisclosureState,
  studentMessage: string,
  canonicalFacts: PatientDisclosureState["allowedThisTurn"],
): string | undefined {
  if (disclosureState.backgroundTurn) {
    const clinical = disclosureState.backgroundTurn.clinicalRequested
      ? patientFactFallback({ ...disclosureState, backgroundTurn: undefined, allowedThisTurn: disclosureState.allowedThisTurn.filter(fact => !fact.id.includes(".background-")) }, studentMessage, canonicalFacts)
      : undefined;
    return [backgroundFallback(disclosureState.backgroundTurn), clinical].filter(Boolean).join(" ");
  }
  const requiredIds = new Set(requiredFactsForTurn(disclosureState, studentMessage, canonicalFacts).map((fact) => fact.id));
  const fallbacks: Readonly<Record<string, string>> = {
    "c2.duration": "It has been getting worse for seven days.",
    "c3.duration": "It has been getting worse for three days.",
    "c4.duration": "The returned pain has been getting worse for five days.",
    "c5.duration": "It has been getting worse for four days.",
    "c3.location": "The pain is in my lower-right back tooth.",
    "c3.pain-quality": "The pain is constant and throbbing.",
    "c3.pain-severity": "The pain is eight out of ten.",
    "c3.radiation": "It travels toward my right ear.",
    "c3.biting": "Yes, biting or chewing on that tooth causes sharp pain.",
    "c3.swelling": "The lower-right side of my face feels a little puffy.",
    "c3.no-fever": "No, I have not had a fever.",
    "c3.mouth-opening": "I can open my mouth normally.",
    "c3.breathing": "No, I have no trouble breathing.",
    "c3.swallowing": "No, I have no trouble swallowing.",
    "c3.voice": "No, my voice has not changed; it is normal.",
    "c3.ulcers": "I have a history of stomach ulcers.",
    "c3.pepcid": "I take Pepcid as needed.",
    "c3.ibuprofen": "Ibuprofen upsets my stomach, so I avoid it.",
    "c3.nkda": "I have no known drug allergies.",
    "c3.crown": "That lower-right back tooth has a crown or cap.",
    "c3.rct": "I'm not sure whether that tooth had a root canal or its nerve removed.",
    "c3.smoking": "No, I do not smoke.",
    "c3.appointment": "I have an appointment with my dentist next week, and I still plan to go.",
    "c3.percussion": "Yes, tapping that tooth really hurts.",
    "c3.gum-palpation": "Yes, it hurts when you press there.",
    "c3.cold": "No, drinking something cold is not painful.",
    "c3.oral-swelling": "Yes, my gum is swollen and painful inside my mouth.",
    "c3.chest-pain-negative": "No, I do not have chest pain.",
    "c3.neck-stiffness-negative": "No, my neck is not stiff.",
    "c3.surgery-negative": "No, I have not had any surgery.",
    "c3.opioid-negative": "No, I have no history of opioid use, misuse, or abuse.",
    "c3.alcohol": "I drink alcohol occasionally.",
    "c3.illicit-drugs-negative": "No, I do not use illicit drugs.",
    "c3.dental-work": "Yes, I have had a lot of dental work in the past.",
    "c3.treated-teeth-unknown": "I don't remember exactly which teeth were treated.",
    "c3.painful-tooth-not-extracted": "No, that tooth is still there and has a crown on it.",
    "c3.dentist-contact": "I called my dentist a couple of days ago.",
    "c3.pepcid-details-unknown": "I take Pepcid as needed, but I don't know the exact dose or frequency.",
    "c3.prior-antibiotics-unknown": "I don't remember whether I took antibiotics before coming in.",
    "c3.prior-acetaminophen-unknown": "I don't remember whether I took Tylenol before coming in.",
    "c3.temperature-unknown": "I have not had a fever, but I don't know an exact measured temperature.",
    "c3.heart-rate-unknown": "I don't know my exact heart rate.",
    "c3.diagnosis-unknown": "I don't know the diagnosis; I just know the tooth hurts and my gum is swollen.",
    "c2.swelling": "My right cheek is swollen and has been getting worse over about the last day.",
    "c4.severity": "I would rate the pain a seven out of ten.",
    "c1.opioid": /\b(?:misus|abus|dependen|addict)\b/i.test(studentMessage)
      ? "No, I have no history of opioid misuse or dependence."
      : "No, I have never used opioids or narcotics.",
    "c1.location": "The painful tooth is my lower-left molar.",
    "c1.duration": "The dental pain has been worsening for four days.",
    "c1.onset-uncertain": "I do not know the exact original start time, but it has been worsening for four days.",
    "c1.initial-severity": "At first, the pain was about three out of ten.",
    "c1.severity": "The pain is eight out of ten now.",
    "c1.airway-duration": "The swallowing trouble and shortness of breath when lying down started about twelve hours ago.",
    "c1.swelling-location": "The swelling is on both sides under my jaw.",
    "c1.upright-breathing": "No, I am not short of breath while sitting upright.",
    "c1.dyspnea-supine": "Yes, I become short of breath and feel like I am choking when I lie flat.",
    "c1.home-temperature": "No, I did not measure my temperature at home, so I do not know an exact number.",
    "c1.chest-pain": "No, I do not have chest pain.",
    "c1.diabetes": "Yes, I have type 2 diabetes.",
    "c1.hypertension": "Yes, I have high blood pressure.",
    "c1.metformin": "I take metformin.",
    "c1.lisinopril": "I take lisinopril.",
    "c1.nkda": "I have no known drug allergies, including no penicillin allergy.",
    "c1.ibuprofen": "Yes, I can take ibuprofen and have no known contraindication to it.",
    "c1.smoking": "I smoke about one pack per day.",
    "c1.alcohol": "No, I do not use alcohol.",
    "c1.illicit-drugs": "No, I do not use illicit drugs.",
    "c1.prior-antibiotics-unknown": "I do not know or recall whether I took antibiotics for this problem before.",
    "c1.otc-unknown": "I took an over-the-counter pain medicine, but I do not know the exact product or dose.",
    "c1.prior-root-canal-unknown": "I do not know or recall whether this tooth had a root canal before.",
    "c1.prior-extraction-unknown": "I do not know or recall whether I have had an extraction before.",
    "c2.location": "The painful tooth is the back upper-right molar.",
    "c2.systemic-timeline": "The fever, chills, tiredness, and increasing right-cheek swelling started about twenty-four hours ago.",
    "c2.severity": "The pain is eight out of ten now.",
    "c2.breathing-negative": "No, I am not having trouble breathing.",
    "c2.liquids-positive": "Yes, I can swallow liquids.",
    "c2.voice-negative": "No, my voice has not changed; it sounds normal.",
    "c2.drooling-negative": "No, I am not drooling.",
    "c2.mouth-opening": "I can open my mouth, but it is uncomfortable.",
    "c2.healthy": "My health is generally excellent, and I do not have any known medical problems.",
    "c2.med": "I take Motrin or Advil, 400 milligrams as needed, about every six hours.",
    "c2.ibuprofen": "I can take ibuprofen and have no known contraindication to it.",
    "c2.opioid": "No, I have no history of opioid use, misuse, or abuse.",
    "c2.nkda": "I have no known drug allergies, and I am not allergic to penicillin.",
    "c2.smoking": "I smoke about half a pack of cigarettes per day.",
    "c2.alcohol": "I drink alcohol rarely.",
    "c2.illicit-drugs": "No, I do not use illicit drugs.",
    "c2.access": "I have not seen a dentist since I lost Medicaid last year.",
    "c2.prior-antibiotics-unknown": "I do not know or recall whether I took antibiotics for this before.",
    "c2.prior-root-canal-unknown": "I'm not sure whether that tooth ever had a root canal.",
    "c2.prior-treatment-unknown": "I don't remember having treatment done on that tooth.",
    "c2.painful-tooth-not-extracted": "No, the tooth is still there.",
    "c2.other-extraction-unknown": "I'm not sure whether I've had another tooth extracted.",
    "c2.temperature-unknown": "I feel feverish, but I do not know my exact temperature.",
    "c2.heart-rate-unknown": "I do not know my exact heart rate.",
    "c2.sirs-unknown": "I do not know whether I meet SIRS criteria.",
    "c4.location": "The pain is in a molar on my lower-left side.",
    "c4.sequence": "The tooth hurt badly about a week ago, then stopped and returned; the biting pain became sharper over the past forty-eight hours.",
    "c4.filling-present": "That tooth has a large filling placed about twenty years ago.",
    "c4.filling-break-belief": "I think the old filling may have broken, but I'm not certain.",
    "c4.hard-object-unknown": "I'm not sure whether I bit down on anything hard.",
    "c4.constant": "The pain is constant now.",
    "c4.biting": "Biting, chewing, or tapping that tooth causes sharp pain.",
    "c4.cold-prior": "Cold used to hurt that tooth a while ago.",
    "c4.cold-now": "Cold is not painful now, although it used to hurt.",
    "c4.no-swelling": "No, my face is not swollen.",
    "c4.no-drainage": "No, I have not noticed pus or drainage.",
    "c4.no-gum-swelling": "No, my gum is not swollen and there is no abscess in my mouth.",
    "c4.no-fever": "No, I have not had fever or chills.",
    "c4.swallowing": "No, I have no difficulty swallowing.",
    "c4.drooling": "No, I am not drooling.",
    "c4.breathing": "No, I am not short of breath.",
    "c4.mouth-opening": "I can open my mouth normally.",
    "c4.voice": "My voice is normal and has not changed.",
    "c5.location": "It hurts in the lower-left side of my jaw, but I can't tell which tooth is causing it.",
    "c5.cold": "Cold drinks make the pain worse.",
    "c5.lingering": "The pain does not stop immediately after the cold is removed; it keeps hurting for a little while afterward.",
    "c4.penicillin": "Penicillin gives me hives.",
    "c4.hives": "Penicillin gives me hives.",
    "c4.medication": "I have taken ibuprofen, 400 milligrams as needed, but the pain is still there.",
    "c4.healthy": "My general health is excellent, and I have no known medical problems.",
    "c4.ibuprofen-suitable": "I have no known reason that I cannot take ibuprofen.",
    "c4.opioid-negative": "No, I have no history of opioid use, misuse, or abuse.",
    "c4.smoking": "I smoke about one pack per day.",
    "c4.alcohol": "I drink alcohol occasionally.",
    "c4.illicit-drugs-negative": "No, I do not use illicit drugs.",
    "c4.last-dentist": "The last time I saw a dentist was about five years ago.",
    "c4.access": "I do not have dental insurance or a dentist I can see now, so arranging care will take time.",
    "c4.goal": "Yes, I want to save the tooth if possible.",
    "c4.surgery-unknown": "I'm not sure.",
    "c4.ibuprofen-frequency-unknown": "I took 400 milligrams as needed, but I don't remember an exact schedule or number of doses.",
    "c4.prior-acetaminophen-unknown": "I don't remember whether I took Tylenol before coming in.",
    "c4.prior-antibiotics-unknown": "I don't remember whether I took antibiotics before coming in.",
    "c4.root-canal-unknown": "I'm not sure whether that tooth ever had a root canal.",
    "c4.painful-tooth-not-extracted": "No, the painful tooth is still there and has a filling in it.",
    "c4.temperature-unknown": "I haven't had a fever, but I don't know an exact temperature.",
    "c4.diagnosis-unknown": "I don't know the diagnosis; I just know the tooth hurts badly when I bite.",
    "c4.tooth-percentage-unknown": "I don't know what percentage of the tooth remains.",
    "c5.nkda": "I have no known drug allergies.",
    "c5.smoking": "I smoke about half a pack of cigarettes per day.",
    "c5.ibuprofen-frequency-unknown": "I take 400 milligrams as needed, but I don't know an exact frequency.",
    "c5.prior-acetaminophen-unknown": "I don't remember whether I took Tylenol before coming in.",
    "c5.prior-antibiotics-current-unknown": "I don't remember taking an antibiotic for this episode before coming in.",
    "c5.ibuprofen-suitable": "I have no known reason that I cannot take ibuprofen.",
    "c5.opioid-negative": "No, I have no history of opioid use, misuse, or abuse.",
    "c5.surgery-unknown": "I'm not sure.",
    "c5.alcohol": "I drink alcohol occasionally.",
    "c5.illicit-drugs-negative": "No, I do not use illicit drugs.",
    "c5.painful-tooth-not-extracted": "No, the painful tooth is still there; the tooth pulled five years ago was an upper tooth.",
    "c5.root-canal-unknown": "I'm not sure whether I have had a root canal.",
    "c5.filling-unknown": "I'm not sure whether the painful tooth has a filling.",
    "c5.temperature-unknown": "I haven't had a fever, but I don't know an exact temperature.",
    "c5.diagnosis-unknown": "I don't know the diagnosis; I just know the pain won't go away.",
    "c5.appointment-negative": "No, I don't have a dentist or an appointment right now.",
  };
  const selected = [...new Set(Object.entries(fallbacks).filter(([id]) => requiredIds.has(id)).map(([, text]) => text))];
  const mappedIds = new Set(Object.keys(fallbacks));
  const sources = [...canonicalFacts, ...disclosureState.allowedThisTurn, ...disclosureState.alreadyDisclosed];
  for (const id of requiredIds) {
    if (mappedIds.has(id) || id.includes(".background-")) continue;
    const fact = sources.find(f => f.id === id);
    if (fact) selected.push(patientFactSentence(fact.text));
  }
  selected.push(...residenceFallback(disclosureState.allowedThisTurn));
  selected.push(...transportationFallback(disclosureState.allowedThisTurn));
  return selected.length ? selected.join(" ") : undefined;
}

