export type ClinicalPlanWitness = { valid: boolean; clause?: string; reason: string };

/** Independent scope check on the model's quoted evidence, not a question-answer map.
 * Eligibility still requires affirmative semantic classification and catalog state.
 * A clinical object alone cannot turn financial screening or an option into a plan.
 */
export function assessClinicalPlanWitness(message: string, quote: string | undefined): ClinicalPlanWitness {
  if (!quote?.trim() || !message.includes(quote)) return { valid: false, reason: "missing-current-verbatim-evidence" };
  const normalized = quote.toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, "i am").replace(/\bwe're\b/g, "we are")
    .replace(/\bi'll\b/g, "i will").replace(/\bwe'll\b/g, "we will");
  // Evaluate propositions independently: an actual plan can coexist with screening,
  // and a hypothetical antecedent cannot turn an interrogative into a directive.
  const clauses = normalized.split(/[.!?;,]|\b(?:and|but)\b/).map(s => s.trim()).filter(Boolean);
  for (const raw of clauses) {
    const clause = raw.replace(/^(?:for now|for (?:your )?pain|today|please)\s*:?\s*/, "");
    if (/^(?:if|suppose|imagine|hypothetically|perhaps|maybe|would|could|can|should|do|does|did|is|are|have|has|what|which|how|will)\b/.test(clause)) continue;
    let action: string | undefined;
    const provider = clause.match(/^(?:i|we)\s+(?:(?:will|am going to|are going to|am|are)\s+)?(.+)$/);
    const directive = clause.match(/^you\s+(?:should|must|need to|can|could|will need to)\s+(.+)$/);
    const nominal = clause.match(/^(?:the plan|your (?:plan|next step))\s+is\s+(.+)$/);
    if (provider) action = provider[1];
    else if (directive) action = directive[1];
    else if (nominal) action = nominal[1];
    else if (/^(?:take|use|see|visit|follow up|return|go)\b/.test(clause)) action = clause;
    if (!action || /\b(?:might|would|could|consider|looking|searching|exploring)\b/.test(action)) continue;
    const recommendation = /^(?:recommend|advise|suggest|propose)\b/.test(action);
    action = action.replace(/^(?:recommend|advise|suggest|propose)\s+(?:(?:that )?you\s+)?/, "");
    const medicine = /\b(?:ibuprofen|acetaminophen|paracetamol|naproxen|analgesi\w*|pain (?:medicine|medication|relief|control))\b/;
    const medicationAction = /^(?:take|use|give|giving|prescribe|prescribing|start|starting|provide|providing|manage|managing|treat|treating|control|controlling)\b/.test(action)
      && (medicine.test(action) || /\b(?:your |the )?pain\b/.test(action));
    const dentalAction = /^(?:see|visit|follow up|refer|referring|consult|arrange|arranging|book|schedule|send|sending|return|go)\b/.test(action)
      && /\b(?:dentist|dental (?:care|clinic|treatment|follow.?up)|oral surgeon|hospital|emergency (?:department|care))\b/.test(action);
    const directRecommendation = (recommendation || Boolean(nominal)) && (new RegExp(`^(?:an? |the |some )?${medicine.source}`).test(action)
      || /^(?:a |the |your )?(?:dentist|oral surgeon|dental (?:care|treatment|follow.?up))\b/.test(action));
    if (medicationAction || dentalAction || directRecommendation) return { valid: true, clause: raw, reason: "current-clinical-action" };
  }
  return { valid: false, reason: "no-current-clinical-action-in-evidence" };
}
