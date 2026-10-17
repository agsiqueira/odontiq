import type { PatientDisclosureFact } from "./patientDisclosure";

export type CanonicalAssertionContext = { latestStudentMessage?: string };

export function deniesCurrentDentist(text: string): boolean {
  const s = text.toLowerCase().replace(/[’‘]/g, "'");
  return /\b(?:i (?:don't|do not) (?:have|see)|i (?:haven't|have not|never) had) (?:a |an |any |my |own |regular |usual )*(?:dentist|dental provider|dental professional)\b|\bno (?:own |regular |usual )?(?:dentist|dental provider|dental professional)\b/.test(s);
}

export function assertsHouseholdComposition(text: string): boolean {
  const s = text.toLowerCase().replace(/[’‘]/g, "'");
  const person = "(?:(?:my|our|a|an|the|some) )?(?:family|roommates?|housemates?|parents?|partner|daughter|son|wife|husband|sister|brother|mother|father|children|child|friends?|others|someone|people|dentist|doctor)";
  return new RegExp(`\\b(?:live|lived|living|reside|resided|residing)\\b.{0,12}\\b(?:alone|by myself|with ${person})\\b`).test(s)
    || /\bi have (?:a |one |some )?(?:roommates?|housemates?)\b|\b(?:i|we) share\b.{0,25}\b(?:home|house|apartment|flat)\b.{0,20}\bwith\b/.test(s)
    || /\b(?:live|living|reside) with ([A-Z][a-z]+)\b/.test(text) && !/\b(?:pain|diabetes|hypertension|illness|disease|ulcers?)\b/i.test(text);
}

/** Validation-only access to canonical facts: never returns text to disclose. */
export function assessCanonicalAssertions(text: string, facts: readonly PatientDisclosureFact[], context: CanonicalAssertionContext = {}): { valid: boolean; reason?: string } {
  const corpus = facts.map(f => f.text).join(" ").toLowerCase();
  const reject = (reason: string) => ({ valid: false, reason });
  // Questions (including approved questions) are not assertions about the patient.
  const originalClauses = text.replace(/[’‘]/g, "'").replace(/\b([Dd]r)\.\s+/g, "$1 ")
    .split(/(?<=[.!?])\s+/).filter(clause => !clause.endsWith("?"));
  const assertions = originalClauses.join(" ").toLowerCase();
  if (facts.some(f => /background-insurance$/.test(f.id) && /uninsured/i.test(f.text))) {
    const positive = /\bi (?:have|carry)\b(?:(?!\b(?:no|not|don't|daughter|child|dentist|appointment|tooth|pain|lost|questions?|concerns?|worries|doubts|information)\b)[^.!?]){0,45}\b(?:insurance|medicaid)\b|\bi (?:am|'m) (?:on|covered by) (?:a |an |my |dental |health )*(?:medicaid|insurance|insurance plan)\b|\bmy (?:dental |health )?(?:care|visit|treatment) is covered by\b/;
    if (positive.test(assertions)) return reject("canonical contradiction: adult insurance");
    const hasPastCoverage = /\b(?:lost|losing|had) medicaid\b/.test(corpus);
    for (const clause of originalClauses.map(c => c.toLowerCase())) {
      if (/\bmy (?:dental |health )?insurance\b/.test(clause)
        && !/\bif i (?:get|got|had|were to get)\b/.test(clause)
        && !(hasPastCoverage && /\b(?:lost|ended|lapsed|expired|used to|previous|old|before)\b/.test(clause))) return reject("canonical contradiction: presupposed insurance arrangement");
    }
  }
  if (facts.some(f => /background-regular_dentist$/.test(f.id))
    && deniesCurrentDentist(assertions)) return reject("canonical contradiction: existing dentist");
  if (!facts.some(f => /household/.test(f.id))
    && assertsHouseholdComposition(originalClauses.join(" "))) return reject("unsupported household composition");
  const hasDaughter = facts.some(f => /\bdaughter\b/i.test(f.text));
  if (!hasDaughter && /\bmy daughter\b|\bi have (?:a |one |a young )?(?:daughter|child)\b/.test(assertions)) return reject("unsupported family composition");
  const dentalContext = /\b(?:dentist|dental provider|dental professional|dental care)\b/i.test(`${context.latestStudentMessage ?? ""} ${assertions}`);
  const attendanceGap = /\b(?:it's|it has|has) been (?:a |quite a |a long )?while\b.{0,55}\b(?:dentist|dental)\b/.test(assertions)
    || /\b(?:haven't|have not|hadn't|had not)\b.{0,35}\b(?:in|for) (?:a |quite a |a long )?while\b/.test(assertions);
  const attendanceSource = /\b(?:last (?:saw|seen|visited)|not (?:seen|visited)|hasn't (?:seen|visited)|had not (?:seen|visited))\b.{0,55}\b(?:dentist|dental)\b/.test(corpus);
  if (dentalContext && attendanceGap && !attendanceSource) return reject("unsupported dental attendance interval");
  const attendanceFrequency = /\bi (?:regularly|routinely|often) (?:see|visit|go to)\b.{0,30}\bdentist\b|\bi (?:see|visit|go to)\b.{0,30}\bdentist\b.{0,20}\b(?:regularly|routinely|every (?:year|six months))\b/.test(assertions);
  if (attendanceFrequency && !/\b(?:regularly|routinely|every (?:year|six months))\b/.test(corpus)) return reject("unsupported dental attendance frequency");
  const asksFrequency = /\b(?:regularly|routinely|how often|every (?:year|six months))\b/i.test(context.latestStudentMessage ?? "") && /\b(?:dentist|dental|visits?)\b/i.test(context.latestStudentMessage ?? "");
  if (asksFrequency && /^\s*(?:yes|yeah|yep|i do|of course|certainly)\b/i.test(assertions)
    && !/\b(?:regularly|routinely|every (?:year|six months))\b/.test(corpus)) return reject("unsupported implied dental attendance frequency");
  const paymentClaim = /\b(?:costs?|bills?|fees?|care|treatment)\b.{0,30}\b(?:will|would|must|have to|going to)\b.{0,25}\b(?:out of pocket|self pay|pay myself)\b|\bi(?:'ll| will| must| have to| am going to) pay\b.{0,30}\b(?:out of pocket|myself)\b/.test(assertions);
  if (paymentClaim && !/\b(?:out of pocket|self pay|pays? .*self)\b/.test(corpus)) return reject("unsupported prospective payment arrangement");
  if (/\b(?:i(?:'m| am)? (?:currently )?(?:pay|paid|paying)|and (?:i'm )?paying) out of pocket\b/.test(assertions)
    && !/\b(?:paid|pays?|paying) (?:out of pocket|for .* (?:himself|herself|themselves))\b/.test(corpus)) return reject("unsupported actual payment arrangement");
  if (/\blost medicaid within the past year\b/.test(corpus)
    && /\b(?:medicaid|coverage)\b/i.test(`${context.latestStudentMessage ?? ""} ${assertions}`)
    && /\b(?:about|around|approximately) (?:a|one|1|twelve|12) (?:year|months?)\b/.test(assertions)) return reject("unsupported precise coverage-loss interval");
  const daughterHasProvider = facts.some(f => /\bdaughter\b.{0,50}\b(?:has (?:her own |a regular )?dentist|sees? (?:her |a )?dentist|attends? (?:a |the )?clinic)\b/i.test(f.text));
  if (!daughterHasProvider && /\b(?:clinic|office|practice|provider|dentist)\b.{0,15}\bas (?:my )?daughter's\b|\b(?:stick|stay|continue|keep)\b.{0,20}\b(?:with|using|seeing)\b.{0,20}\b(?:same|our)\b.{0,15}\b(?:clinic|provider|dentist)\b/.test(assertions)) return reject("unsupported presupposed shared or child provider");
  const childCondition = /\b(?:my daughter|her teeth|my daughter's teeth|she)\b.{0,30}\b(?:needs? (?:more attention|treatment|a filling|dental work)|has (?:a toothache|cavities|dental problems)|hurts?|pain)\b/.test(assertions);
  if (childCondition && !/\bdaughter\b.{0,70}\b(?:toothache|cavities|dental problems|needs? (?:treatment|more attention|dental work))\b/.test(corpus)) return reject("unsupported child dental condition");
  if (!daughterHasProvider && (/\b(?:my daughter|she)\b[^.!?]{0,80}\b(?:sees?|attends?|go(?:es)? to|receives? care at|gets? care at)\b[^.!?]{0,35}\b(?:dentist|dental provider|clinic|office|practice)\b/.test(assertions)
    || /\b(?:my daughter|she)\b[^.!?]{0,35}\bhas (?:a |her |her own |a regular |an appointment (?:with|at) (?:a |the )?)(?:dentist|clinic|dental provider|dental office)\b/.test(assertions)
    || /\bmy daughter's (?:dentist|clinic|dental provider|dental office)\b/.test(assertions))) return reject("unsupported child provider or clinic history");
  for (const clause of originalClauses) {
    const names = [...clause.matchAll(/\b(?:[Dd]r\.?|[Dd]octor)\s*([A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)?)/g)];
    if (names.some(m => !corpus.includes(m[1].toLowerCase()))
      && /\b(?:i (?:usually |normally |regularly )?(?:see|go|visit)|my (?:own |regular )?(?:dentist|doctor) is|is my (?:dentist|doctor))\b/i.test(clause)) return reject("unsupported named provider");
  }
  if (/\b(?:i'm|i am) not your (?:daughter|son|child|sister|brother|wife|husband|mother|father)\b/.test(assertions)
    && /\byou and your (?:daughter|son|child|sister|brother|wife|husband|mother|father)\b/i.test(context.latestStudentMessage ?? "")) return reject("misread coordinated care participants as patient identity");
  const concrete = [
    { pattern: /\b(?:my employer|my (?:last |current )?job|i work (?:at|for)|i (?:lost|quit) my job|employer's (?:insurance|plan))\b/, source: /\b(?:employer|employment|job|works?)\b/ },
    { pattern: /\b(?:time|days?) off (?:work|my job)\b|\b(?:leave|absence) from work\b/, source: /\b(?:employment|employer|job|work schedule|time off work)\b/ },
    { pattern: /\b(?:tough|hard|difficult|trouble|struggle|struggling)\b.{0,45}\b(?:finding time|coordinat\w*|schedul\w*|appointments?)\b|\b(?:my|our) (?:work )?schedules?\b/, source: /\b(?:schedule|finding time|coordinat\w*)\b/ },
    { pattern: /\b(?:my (?:daughter|son|wife|husband|sister|brother|parents?|mother|father|mom|dad|friend|partner|neighbor|relative|caregiver).{0,30}(?:drives?|rides?|takes? me|gives? me a ride)|my (?:car|vehicle|bus pass))\b/, source: /\b(?:drives?|vehicle|car|lives? with)\b/ },
    { pattern: /\bi (?:can |could |will |usually |normally |always |am able to )?(?:drive|take (?:a |the )?(?:bus|train|taxi|uber)|ride (?:a |my )?(?:bike|bicycle|scooter))\b|\bmy (?:bike|bicycle|scooter)\b/, source: /\b(?:drive|drives|bus|train|taxi|bike|bicycle|scooter)\b/ },
    { pattern: /\b(?:my income|i earn|i make \$|insurance paperwork|medicaid paperwork|waiting for (?:insurance|medicaid))\b/, source: /\b(?:income|earns?|paperwork|waiting for)\b/ },
  ];
  if (concrete.some(rule => rule.pattern.test(assertions) && !rule.source.test(corpus))) return reject("unsupported concrete personal circumstance");
  return { valid: true };
}
