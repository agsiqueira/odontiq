import { isTreatmentConsentRequest } from "./case3ConsentResponse";
/** Separate provider commitments from distinct patient-directed factual requests.
 * Only scopes fact disclosure; the original full message still governs clinical
 * plan classification/consent and patient-question eligibility.
 */
export function patientRequestedText(message: string): string {
  // Consent is referential: its meaning requires the proposed treatment, not just
  // the final acknowledgment question. Reuse the existing consent contract.
  if (isTreatmentConsentRequest(message)) return message;
  const requestStart = /^(?:are|can|could|did|do|does|have|has|how|is|was|were|what|when|where|which|who|why|would|will|should|tell me|describe|rate)\b/i;
  const providerAct = /^(?:(?:for now|today)[, ]+)?(?:(?:i|we)(?:'ll|’ll)\b|(?:i|we)\s+(?:will|am|are|recommend|advise|suggest|propose)\b|(?:the plan|your (?:plan|next step))\s+is\b|(?:please\s+)?(?:take|use|see|visit|follow up|return)\b)/i;
  const parts = message.split(/(?<=[.!?;])\s+|[,;]\s*(?=(?:(?:and|but)\s+)?(?:are|can|could|did|do|does|have|has|how|is|what|when|where|which|who|why|would|will|should)\b)|\s+(?:and|but)\s+(?=(?:are|can|could|do|does|how|is|what|when|where|which|who|why|would|will|should)\b)/i)
    .map(s => s.trim().replace(/^(?:and|but)\s+/i, "")).filter(Boolean);
  if (!parts.some(s => requestStart.test(s)) || !parts.some(s => providerAct.test(s))) return message;
  const requests = parts.filter(s => !providerAct.test(s));
  return requests.length ? requests.join(" ") : message;
}
