import type { AIProvider } from "../ai/provider";
import type { Case3Explanations } from "./types";

/** Isolated semantic entailment: no case facts, patient draft or prior context.
 * Accepted current-message witnesses provide auditable, durable answered knowledge.
 */
export async function verifyCase3Explanations(provider: Pick<AIProvider, "generateText" | "name">, message: string, messageId: string): Promise<Case3Explanations> {
  const result = await provider.generateText({
    model: provider.name === "navigator" ? process.env.NAVIGATOR_EXPLANATION_MODEL ?? "llama-3.3-70b-instruct" : undefined,
    systemPrompt: `Decide whether the CURRENT clinician message explicitly provides each of two different explanations. Use only this message, not clinical knowledge or prior dialogue.
TEMPORARY: drainage relieves pressure, drains infection/pus, or is temporary/nondefinitive. An explicit purpose/limitation within a consent message counts. Merely naming/proposing I&D without its effect does not count.
DEFINITIVE: the patient still requires a root canal, removal of the affected tooth, or equivalent curative treatment of the underlying dental cause. Accept natural clinical paraphrases. Access instructions (seeing a dentist, keeping/arranging an appointment, contacting a clinic) NEVER count. Drainage alone is not definitive care.
These are independent facts. Do not infer one from the other. Hypotheticals, negations, historical questions and mere possibilities do not establish a present requirement. A message may ask consent while actually providing explanations in other clauses.
For TEMPORARY return explained true only if a limited effect is actually explained. For DEFINITIVE return required true ONLY when a positive obligation for definitive treatment is explicitly stated; discussing it, saying it is unnecessary, or saying it might be needed is required false. For each fact return its boolean and a short supporting verbatim quote. Use empty quote for false. Never alter the words or invent a quote.
Output ONLY one JSON object: {"temporary":{"explained":boolean,"quote":string},"definitive":{"required":boolean,"quote":string},"confidence":number}.
Confidence is a decimal fraction from 0 to 1 (never a percentage).`,
    messages: [{ role: "user", content: JSON.stringify({ currentProviderMessage: message }) }],
    temperature: 0, maxTokens: 400,
  });
  const parsed = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, ""));
  if (!parsed || Object.keys(parsed).sort().join() !== "confidence,definitive,temporary"
    || typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) throw Error("Invalid Case 3 explanation verification");
  const evidence: Case3Explanations = {};
  for (const kind of ["temporary", "definitive"] as const) {
    const item = parsed[kind];
    const predicate = kind === "temporary" ? "explained" : "required";
    if (!item || Object.keys(item).sort().join() !== [predicate,"quote"].sort().join() || typeof item[predicate] !== "boolean"
      || typeof item.quote !== "string" || (item[predicate] ? !item.quote.trim() || !message.includes(item.quote) : item.quote !== "")) throw Error("Unsupported Case 3 explanation witness");
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
