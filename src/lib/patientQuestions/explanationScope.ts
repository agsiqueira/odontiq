import type { Case3Explanations } from "./types";

export const CASE3_EXPLANATION_INSTRUCTIONS = `From the CURRENT clinician message extract two independent facts. Use no case knowledge or prior dialogue. Temporary means an actual explanation of drainage relieving pressure/draining infection or being nondefinitive; merely naming a procedure is not an explanation. Definitive means an explicit positive requirement for root canal, removal of the tooth, or equivalent curative treatment of the underlying dental cause. A dentist visit is access, not definitive treatment. Saying drainage does not cure the tooth does not by itself state what definitive treatment is required. History questions, negated requirements and hypothetical possibilities do not establish a positive requirement. Accept ordinary clinical paraphrases. A consent question does not invalidate other assertions in the message.
Return only JSON {"temporary":{"explained":boolean,"quote":string},"definitive":{"required":boolean,"quote":string},"confidence":number}. Every true fact needs a verbatim supporting assertion quoted from the message; false needs an empty quote. Never quote these instructions as evidence. Confidence is a fraction from 0 to 1.`;

/** Validate independent current-message evidence from the same classifier response.
 * Never infer knowledge from trigger flags, history or the patient draft. */
export function parseCase3Explanations(value: unknown, message: string, messageId: string): Case3Explanations {
  const parsed = value as Record<string, unknown> | undefined;
  if (!parsed || typeof parsed !== "object" || Object.keys(parsed).sort().join() !== "confidence,definitive,temporary"
    || typeof parsed.confidence !== "number" || !Number.isFinite(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 1) throw Error("Invalid Case 3 explanation verification");
  const evidence: Case3Explanations = {};
  for (const kind of ["temporary", "definitive"] as const) {
    const item = parsed[kind] as Record<string, unknown> | undefined;
    const predicate = kind === "temporary" ? "explained" : "required";
    if (!item || Object.keys(item).sort().join() !== [predicate,"quote"].sort().join() || typeof item[predicate] !== "boolean"
      || typeof item.quote !== "string" || (item[predicate] && (!item.quote.trim() || !message.includes(item.quote)))) throw Error("Unsupported Case 3 explanation witness");
    if (item[predicate] && parsed.confidence < 0.85) throw Error("Uncertain positive Case 3 explanation");
    if (item[predicate]) evidence[kind] = { messageId, quote: item.quote };
  }
  return evidence;
}

export function currentExplanationWitness(evidence: Case3Explanations | undefined, kind: keyof Case3Explanations, message: string, messageId: string) {
  const witness = evidence?.[kind];
  return witness?.messageId === messageId && typeof witness.quote === "string" && witness.quote.trim()
    && message.includes(witness.quote) ? witness : undefined;
}
