import type { PatientDisclosureFact } from "./patientDisclosure";

/** Validation-only access to canonical facts: never returns text to disclose. */
export function assessCanonicalAssertions(text: string, facts: readonly PatientDisclosureFact[]): { valid: boolean; reason?: string } {
  const s = text.toLowerCase().replace(/[’‘]/g, "'");
  const corpus = facts.map(f => f.text).join(" ").toLowerCase();
  const reject = (reason: string) => ({ valid: false, reason });
  // Questions (including approved questions) are not assertions about the patient.
  const assertions = s.split(/(?<=[.!?])\s+/).filter(clause => !clause.endsWith("?")).join(" ");
  if (facts.some(f => /background-insurance$/.test(f.id) && /uninsured/i.test(f.text))
    && /\b(?:i (?:have|carry|am on|am covered by)|my (?:dental |health )?(?:care|visit|treatment) is covered by)\b.{0,50}\b(?:insurance|medicaid|plan)\b/.test(assertions)
    && !/\bi (?:have|carry) no\b/.test(assertions)) return reject("canonical contradiction: adult insurance");
  if (facts.some(f => /background-regular_dentist$/.test(f.id))
    && /\b(?:don't|do not|no|never had)\b.{0,30}\b(?:dentist|dental provider|dental professional)\b/.test(assertions)) return reject("canonical contradiction: existing dentist");
  const concrete = [
    { pattern: /\b(?:my employer|my (?:last |current )?job|i work (?:at|for)|i (?:lost|quit) my job|employer's (?:insurance|plan))\b/, source: /\b(?:employer|employment|job|works?)\b/ },
    { pattern: /\b(?:tough|hard|difficult|trouble)\b.{0,25}\b(?:finding time|schedul\w*)\b|\b(?:my|our) (?:work )?schedule\b/, source: /\b(?:schedule|finding time)\b/ },
    { pattern: /\b(?:my (?:daughter|son|wife|husband|sister|brother|parents?).{0,30}(?:drives?|rides?|takes? me)|(?:live|living) with my|my (?:car|vehicle|bus pass))\b/, source: /\b(?:drives?|vehicle|car|lives? with)\b/ },
    { pattern: /\b(?:my income|i earn|i make \$|insurance paperwork|medicaid paperwork|waiting for (?:insurance|medicaid))\b/, source: /\b(?:income|earns?|paperwork|waiting for)\b/ },
  ];
  if (concrete.some(rule => rule.pattern.test(assertions) && !rule.source.test(corpus))) return reject("unsupported concrete personal circumstance");
  return { valid: true };
}
