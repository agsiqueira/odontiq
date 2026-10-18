import type { AIProvider } from "../ai/provider";
import type { Case3Explanations } from "./types";

/** Isolated semantic entailment: no case facts, patient draft or prior context.
 * Accepted current-message witnesses provide auditable, durable answered knowledge.
 */
export async function verifyCase3Explanations(provider: Pick<AIProvider, "generateText">, message: string, messageId: string): Promise<Case3Explanations> {
  const result = await provider.generateText({
    systemPrompt: `Verify two independent clinical explanations in the supplied CURRENT provider message.
Use meaning, including ordinary paraphrases and equivalent clinical language. Do not require specific words.
temporary: the provider explains drainage relieves pressure, drains infection, or is temporary/nondefinitive rather than the definitive cure. Merely proposing/naming a procedure does not explain its purpose or limitation.
definitive: the provider explains that root canal, extraction/removing the affected tooth, or equivalent definitive treatment of the underlying dental cause is still required. Merely instructing a dentist visit, keeping an appointment or receiving care does NOT explain definitive treatment.
Keep these explanations distinct. One does not imply the other. Do not infer missing reasons from clinical knowledge.
Questions, hypothetical possibilities, negated requirements and historical treatment are not present explanations of what this patient needs.
Accept genuine explanations even within a mixed message that also asks consent or a background question.
For each true explanation quote the smallest verbatim supporting assertion from the current message. Never invent or alter the quote. For false use an empty quote.
Return ONLY JSON: {"temporary":{"explained":boolean,"quote":string},"definitive":{"explained":boolean,"quote":string},"confidence":number}. Confidence must reflect both decisions. No other fields.`,
    messages: [{ role: "user", content: JSON.stringify({ currentProviderMessage: message }) }],
    temperature: 0, maxTokens: 400,
  });
  const parsed = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, ""));
  if (!parsed || Object.keys(parsed).sort().join() !== "confidence,definitive,temporary"
    || typeof parsed.confidence !== "number" || parsed.confidence < 0.85 || parsed.confidence > 1) throw Error("Invalid Case 3 explanation verification");
  const evidence: Case3Explanations = {};
  for (const kind of ["temporary", "definitive"] as const) {
    const item = parsed[kind];
    if (!item || Object.keys(item).sort().join() !== "explained,quote" || typeof item.explained !== "boolean"
      || typeof item.quote !== "string" || (item.explained ? !item.quote.trim() || !message.includes(item.quote) : item.quote !== "")) throw Error("Unsupported Case 3 explanation witness");
    if (item.explained) evidence[kind] = { messageId, quote: item.quote };
  }
  return evidence;
}

export function currentExplanationWitness(evidence: Case3Explanations | undefined, kind: keyof Case3Explanations, message: string, messageId: string) {
  const witness = evidence?.[kind];
  return witness?.messageId === messageId && typeof witness.quote === "string" && witness.quote.trim()
    && message.includes(witness.quote) ? witness : undefined;
}
