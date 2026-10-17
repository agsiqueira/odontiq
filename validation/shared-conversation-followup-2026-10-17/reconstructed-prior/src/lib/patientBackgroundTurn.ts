import type { PatientDisclosureFact } from "./patientDisclosure";
import type { ConversationMessage } from "./conversationEngine";

export type BackgroundConcept = "residence" | "residency" | "insurance" | "coverage_timing" | "dentist" | "child" | "shared_clinic" | "travel_capability" | "travel_willingness" | "payment_ability" | "payment_preference";
export type BackgroundRequest = { concept: BackgroundConcept; subject: "patient" | "daughter"; sourceId?: string; value: string; answer: string };
export type BackgroundTurn = { requests: BackgroundRequest[]; clinicalRequested: boolean };

const normalize = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[-–]/g, " ");

/** A turn contract, not a question/answer table. Values come only from canonical facts. */
export function interpretBackgroundTurn(message: string, conversation: readonly ConversationMessage[], facts: readonly PatientDisclosureFact[]): BackgroundTurn | undefined {
  const q = normalize(message);
  const context = normalize(conversation.slice(-6).map(turn => turn.text).join(" "));
  const daughter = /\b(?:daughter'?s?|child|children)\b/.test(q) || (/\b(?:she|her|both|you two|same clinic|together)\b/.test(q) && /\b(?:daughter|child)\b/.test(context));
  const travel = !/\b(?:pain|ache|hurts?|does it)\b.{0,30}\b(?:travel|spread|radiat)/.test(q)
    && (/\b(?:transportation|transport|ride|travel\w*|drive|driving)\b/.test(q)
      || /\b(?:outside|another|neighboring|neighbouring|out of)\b.{0,35}\b(?:county|town)\b/.test(q)
      || /\b(?:leave|reach|get|go|goes|getting|attend)\b.{0,65}\b(?:county|town|clinic|appointment)\b/.test(q) && /\b(?:county|town|reliab\w*|depend\w*|way|means)\b/.test(q));
  const shared = daughter && /\b(?:same|one|both|together|shared|separate|different|you two|also|where|you and your daughter)\b/.test(q)
    && /\b(?:clinic|care|dentist|treated|treat|place|somewhere|together)\b/.test(q)
    && /\b(?:prefer\w*|want\w*|would|rather|better|hoping|important|like|favor)\b/.test(q);
  const residence = !travel && (/\b(?:live\w*|living|reside\w*|home|residence)\b/.test(q)
    || /\b(?:which|what)\b.{0,25}\bcounty\b/.test(q));
  const residency = /\b(?:residency|establish(?:ed|ing)?)\b.{0,25}\b(?:resident|residency)\b|\bresidency\b|\bresident\w*.{0,25}established?\b/.test(q);
  const coverage = /\b(?:insurance|insured|uninsured|coverage|medicaid|dental plan|covered|insurance policy)\b/.test(q);
  const timing = (coverage || /\bthat coverage\b/.test(q) && /\bmedicaid\b/.test(context))
    && /\b(?:when|how long|recent\w*|ago|since|past|last|months?|year|ended|stop\w*|happened|ever)\b/.test(q);
  const dentist = !travel && !shared && !/\b(?:ever|last|how long|years? ago)\b/.test(q) && (/\b(?:your own|regular|usual|established|own) dentist\b/.test(q)
    || /\b(?:have|has|got|any)\b.{0,20}\b(?:a |your |an? )?dentist\b/.test(q)
    || /\bdentist\b.{0,30}\b(?:normally|usually|already|go to|see)\b/.test(q)
    || /\b(?:who handles|see someone|see a regular|established care with)\b/.test(q));
  const financial = !travel && /\b(?:afford\w*|pay\w*|fees?|charg\w*|cost\w*|copay\w*|money|contribute|income|sliding scale|free)\b/.test(q)
    && (!coverage || /\b(?:can you pay|could you pay|able to pay|afford|prefer|free|sliding|income|pay anything)\b/.test(q));
  const preference = financial && /\b(?:prefer\w*|free|no cost|sliding|income|focus|need)\b/.test(q);
  const requests: BackgroundRequest[] = [];
  const add = (concept: BackgroundConcept, subject: BackgroundRequest["subject"], source: PatientDisclosureFact | undefined, value: string, answer: string) => {
    if (!requests.some(r => r.concept === concept && r.subject === subject)) requests.push({ concept, subject, sourceId: source?.id, value, answer });
  };
  const find = (suffix: string) => facts.find(f => f.id.endsWith(`.background-${suffix}`));
  const home = find("residence");
  const county = home?.text.match(/\b([A-Z][a-z]+) County\b/)?.[1];
  if (residence && !residency || residence && /\b(?:where|live\w*|living|home)\b/.test(q)) add("residence", "patient", home, county ?? "unknown", county ? `I live in ${county} County.` : "I'm not sure which county.");
  if (residency) add("residency", "patient", home, /not.{0,15}established residency/i.test(home?.text ?? "") ? "not_established" : "unknown", /not.{0,15}established residency/i.test(home?.text ?? "") ? `I live in ${county} County, but I haven't established residency yet.` : "I'm not sure about my established residency status.");
  const insurance = find("insurance");
  const family = find("family_care");
  const adultCoverageRequested = /\b(?:are you (?:currently )?(?:insured|uninsured)|do you (?:have|has|got) (?:dental )?(?:insurance|coverage)|your insurance)\b/.test(q);
  if (coverage && (!shared || adultCoverageRequested)) {
    if (daughter && !shared && (/\b(?:daughter'?s?|she|her|child)\b/.test(q))) add("insurance", "daughter", family, /daughter on Medicaid/i.test(family?.text ?? "") ? "medicaid" : "unknown", family ? "My daughter has Medicaid." : "I'm not sure about her coverage.");
    if (daughter && adultCoverageRequested) add("insurance", "patient", insurance, /uninsured/i.test(insurance?.text ?? "") ? "uninsured" : "unknown", insurance ? "I don't have insurance." : "I'm not sure about my coverage.");
    if (!daughter && timing) add("coverage_timing", "patient", insurance, /lost Medicaid within the past year/i.test(insurance?.text ?? "") ? "past_year" : "unknown", /lost Medicaid within the past year/i.test(insurance?.text ?? "") ? "I lost Medicaid within the past year." : "I'm not sure about that coverage history.");
    else if (!daughter && !/\beven if\b/.test(q)) add("insurance", "patient", insurance, /uninsured/i.test(insurance?.text ?? "") ? "uninsured" : "unknown", insurance ? "I don't have insurance." : "I'm not sure about my coverage.");
  }
  if (dentist) {
    const own = find("regular_dentist");
    const access = facts.find(f => /\.(?:access|appointment-negative)$/.test(f.id) && /(?:\bno\b.{0,60}\bdentist|not have.*dentist)/i.test(f.text));
    add("dentist", "patient", own ?? access, own ? "has_dentist" : access ? "no_dentist" : "unknown", own ? "I have my own dentist and an appointment next week." : access ? "I don't have a dentist I can see now." : "I'm not sure about a regular dentist.");
  }
  if (daughter && /\b(?:have|has|got)\b.{0,20}\b(?:young daughter|daughter|children|child)\b/.test(q) && (!coverage || /\band\b/.test(q))) add("child", "patient", family, family ? "daughter" : "unknown", family ? "I have a young daughter." : "I'm not sure about that.");
  if (shared || /\bwhere\b.{0,20}\bprefer\b.{0,25}\b(?:care|clinic)\b/.test(q) && family) add("shared_clinic", "patient", family, family ? "same_clinic" : "unknown", family ? "I'd prefer the same clinic for my daughter and me." : "I'm not sure about that preference.");
  const transport = find("transportation");
  if (travel) {
    const reliable = /has reliable transportation/i.test(transport?.text ?? "");
    const unreliable = /unreliable transportation/i.test(transport?.text ?? "");
    const willing = /\b(?:would|willing|option|work for|farther)\b/.test(q);
    add(willing ? "travel_willingness" : "travel_capability", "patient", transport, reliable ? "reliable" : unreliable ? "unreliable" : "unknown", reliable ? `I have reliable transportation and can travel outside ${county ?? "my"} County if needed for free or low-cost care.` : unreliable ? "My transportation out of town is unreliable." : "I'm not sure about transportation or traveling for care.");
    if (willing && /\b(?:able|reliable|dependable|can)\b/.test(q)) add("travel_capability", "patient", transport, reliable ? "reliable" : unreliable ? "unreliable" : "unknown", requests.at(-1)!.answer);
  }
  const cost = find("care_cost");
  if (financial) {
    const extraction = facts.find(f => /\.access$/.test(f.id) && /cannot afford.*extraction/i.test(f.text));
    const zero = /cannot pay anything/i.test(cost?.text ?? "");
    const sliding = /open to paying.*sliding/i.test(cost?.text ?? "");
    if (!sliding || !preference || /\b(?:able|afford|anything|even|money|can you|could you|pay anything)\b/.test(q)) add("payment_ability", "patient", cost ?? extraction, zero ? "zero" : sliding ? "sliding" : extraction && /\bextraction\b/.test(q) ? "extraction_unaffordable" : "unknown", zero ? "I can't pay anything for dental care." : sliding ? "I'm open to paying a sliding-scale fee." : extraction && /\bextraction\b/.test(q) ? "I can't afford the extraction." : "I'm not sure what I can afford.");
    if (preference) add("payment_preference", "patient", cost, zero ? "free" : sliding ? "sliding" : "unknown", zero ? "I'd prefer a free clinic." : sliding ? "I'm open to paying a sliding-scale fee." : "I'm not sure about that payment option.");
  }
  if (!requests.length) return undefined;
  // Background nouns such as 'dental' do not create clinical requests.
  return { requests, clinicalRequested: /\b(?:pain|hurts?|swelling|fever|symptoms?|medicines?|medications?|allerg\w*|toothache)\b/.test(q) && !travel };
}

export function backgroundFallback(turn: BackgroundTurn): string {
  return [...new Set(turn.requests.map(request => request.answer))].join(" ");
}

export function backgroundPrompt(turn: BackgroundTurn): string {
  return `Answer each requested concept about the indicated person, and only these background details: ${turn.requests.map(r => `${r.subject}: ${r.concept.replaceAll("_", " ")} — ${r.answer}`).join(" ")} Do not add names, towns, dates, transport modes, family arrangements, reasons for coverage loss, financial limits, or unrelated histories. Known facts must not become uncertainty. Unspecified details must remain unknown. Prefer a short natural answer; preserve the polarity of each part, including combined questions.`;
}

/** Conservative semantic checks. Ambiguous generations are retried, then use sourced fallback. */
export function assessBackgroundAnswer(text: string, turn: BackgroundTurn): { valid: boolean; reason?: string } {
  const s = normalize(text);
  const missing = turn.requests.find(r => !expressesRequest(s, r));
  if (missing) return { valid: false, reason: `background ${missing.subject} ${missing.concept}: missing or contradictory ${missing.value}` };
  const known = turn.requests.some(r => r.value !== "unknown");
  if (known && /\b(?:not sure|don't know|do not know|never considered|depends on|have to think|hope so|haven't checked)\b/.test(s)) return { valid: false, reason: "uncertainty about known background facts" };
  // Personal specifics require explicit provenance, not mere plausibility.
  if (/\b(?:car|vehicle|bus|taxi|uber|sister|brother|parents|husband|wife|dr\.|doctor smith|paperwork|eligibility|just moved|recently moved|\d+ months|six months|already go there|usually go|already see)\b/.test(s)
    || /\b(?:live|living|reside) in (?!\w+ county\b|the county\b)[a-z]+\b/.test(s)
    || /\b(?:dr\.|doctor)\s+[A-Z][a-z]+\b/.test(text)
    || /\$\d|\b\d{4}\b|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b/.test(s)) return { valid: false, reason: "unsupported background detail" };
  if (turn.requests.some(r => r.value === "sliding") && /\b(?:can't afford|cannot afford|no money|unemployed|income is|earn|dollars)\b/.test(s)) return { valid: false, reason: "unsupported finances beyond sliding-scale willingness" };
  if (/\b(?:my (?:last |current )?job|my employer|work at|work for|i earn|my income)\b/.test(s)) return { valid: false, reason: "unsupported employment or income assertion" };
  if (turn.requests.some(r => r.sourceId?.includes("family_care")) && /\b(?:no children|no kids|don't have (?:any )?(?:kids|children|daughter)|i (?:have|am on) medicaid)\b/.test(s)) return { valid: false, reason: "contradictory family identity or coverage ownership" };
  const counties = [...s.matchAll(/\b([a-z]+) county\b/g)].map(m => m[1]).filter(c => !["my", "the", "another", "your", "neighboring"].includes(c));
  const permitted = turn.requests.flatMap(r => [...normalize(r.answer).matchAll(/\b([a-z]+) county\b/g)].map(m => m[1]));
  if (counties.some(c => !permitted.includes(c))) return { valid: false, reason: "unsupported county" };
  if (!turn.clinicalRequested && /\b(?:molar|upper|lower|root canal|crown|filling|smok\w*|alcohol|illicit|metformin|lisinopril|days|out of ten)\b/.test(s.replace(/[^.!?]*\?[^.!?]*/g, ""))) return { valid: false, reason: "unrequested clinical or social history" };
  if (/\b(?:can't|cannot|unable|not able|not willing|won't|wouldn't|let alone)\b.{0,45}\b(?:travel|go|transportation)\b/.test(s) && turn.requests.some(r => r.value === "reliable")) return { valid: false, reason: "contradictory travel limitation" };
  return { valid: true };
}

function expressesRequest(s: string, r: BackgroundRequest): boolean {
  if (r.value === "unknown") return /\b(?:not sure|unsure|don't know|do not know|don't remember)\b/.test(s)
    && !/\b(?:i have|i can|i can't|i cannot|i will|i won't|i would|my)\b.{0,25}\b(?:car|reliable|ride|travel)\b/.test(s);
  switch (r.concept) {
    case "residence": return s.includes(r.value.toLowerCase()) && !/\b(?:not|don't|do not)\b.{0,20}\blive\b/.test(s);
    case "residency": return /\b(?:not|haven't|have not)\b.{0,25}\bestablished?\b/.test(s) && !/\b(?:completed|already) established\b/.test(s);
    case "insurance": return r.subject === "daughter" ? /\b(?:daughter|she|her)\b.{0,35}\bmedicaid\b|\bmedicaid\b.{0,25}\b(?:daughter|her)\b/.test(s) && !/\b(?:she|daughter)\b.{0,20}\b(?:not|no|doesn't)\b/.test(s) : /\buninsured\b|\b(?:don't|do not|no|without)\b.{0,20}\b(?:dental )?(?:insurance|coverage)\b/.test(s) && !/\bi (?:have|am on|am covered by) (?:dental )?(?:insurance|medicaid)\b/.test(s);
    case "coverage_timing": return /\b(?:past|last|within|about)\b.{0,20}\b(?:year|twelve months|12 months)\b/.test(s) && !/\b(?:more than|over|two|2|six|6)\b.{0,10}\b(?:years|months)\b/.test(s);
    case "dentist": return r.value === "has_dentist" ? /\b(?:have|see|got)\b.{0,20}\b(?:own |regular |usual |a |my )*dentist\b/.test(s) && !/\b(?:no|don't|do not|haven't)\b.{0,25}\b(?:dentist|found)\b/.test(s) : /\b(?:no|don't|do not)\b.{0,25}\bdentist\b/.test(s);
    case "child": return /\b(?:have|my)\b.{0,15}\b(?:young )?daughter\b/.test(s) && !/\b(?:no|don't|do not)\b.{0,20}\b(?:kids|children|daughter)\b/.test(s);
    case "shared_clinic": return /\b(?:same|one|together|both|shared)\b/.test(s) && /\b(?:prefer|like|want|better|easier|convenient|yes)\b/.test(s) && !/\b(?:separate clinics|different clinics|don't want)\b/.test(s);
    case "travel_capability": case "travel_willingness": return r.value === "reliable" ? (r.concept === "travel_capability" && /\breliable transportation\b/.test(s) || /\b(?:can|could|would|willing|able)\b.{0,25}\b(?:travel|go|get|leave)\b/.test(s)) && !/\bunreliable\b/.test(s) : /\b(?:unreliable|not reliable|can't rely|cannot rely|not dependable)\b/.test(s) && !/\b(?:cannot|can't|never) travel\b/.test(s);
    case "payment_ability": return r.value === "extraction_unaffordable" ? /\b(?:can't|cannot) afford\b.{0,20}\bextraction\b/.test(s) : r.value === "zero" ? /\b(?:can't|cannot|not able|unable)\b.{0,25}\b(?:pay|afford)\b.{0,20}\b(?:anything|any|even|fee|care)\b|\bno money\b|\bdon't have any money\b/.test(s) && !/\b(?:could pay|can pay|low cost would help|can't afford much)\b/.test(s) : /\b(?:open|willing|consider|can pay)\b/.test(s) && /\b(?:sliding|income)\b/.test(s);
    case "payment_preference": return r.value === "free" ? /\b(?:prefer|need|looking|hoping|want)\b.{0,25}\bfree\b/.test(s) : /\b(?:open|willing|consider|can pay)\b/.test(s) && /\b(?:sliding|income)\b/.test(s);
  }
}
