// Match commentary about producing an answer, not ordinary patient statements
// about a clinician's care instructions or difficulty talking through pain.
const INSTRUCTION_COMMENTARY: ReadonlyArray<[string, RegExp]> = [
  ["spoken response-style direction", /\bi(?:'m| am|'ll| will)?\s+(?:keep(?:ing)?|mak(?:e|ing))\s+(?:it|this|(?:my |the )?(?:answers?|responses?|repl(?:y|ies)))\s+(?:brief|short|concise)\b/i],
  ["spoken response-style direction", /\bi(?:'m| am|'ll| will)?\s+(?:be(?:ing)?\s+(?:brief|concise)|(?:answer|respond|reply)(?:ing)?\s+(?:briefly|concisely|in (?:one|a single) (?:sentence|line)))\b/i],
  ["spoken response-style direction", /\bi(?:'m| am) (?:supposed|instructed|told) to (?:be|stay|remain) (?:brief|concise)\b/i],
  ["instruction compliance commentary", /\b(?:as (?:instructed|directed) by (?:the |my )?(?:prompt|system|developer)|(?:following|obeying|complying with) (?:the |my )?(?:system|developer|prompt|style) (?:instructions?|rules?|directions?)|(?:my|the) (?:prompt|system instructions?|response rules?) (?:says?|requires?|tells?|instructs?)|i (?:must|am instructed to|have been instructed to) (?:answer|respond|reply|stay in character))\b/i],
  ["instruction compliance commentary", /\b(?:per|according to) (?:my |the )?(?:system prompt|prompt|system instructions?|response rules?)\b/i],
  ["AI or simulated-role disclosure", /\b(?:as an? (?:ai|artificial intelligence|virtual patient|simulated patient)|i(?:'m| am) (?:an? )?(?:ai|language model|virtual patient|simulated patient)|(?:i am|i'm) (?:role[- ]?playing|playing the role)|this is (?:a |an )?(?:simulation|role[- ]?play))\b/i],
];

export function patientInstructionLeakage(text: string): string | undefined {
  const normalized = text.normalize("NFKC").replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  return INSTRUCTION_COMMENTARY.find(([, pattern]) => pattern.test(normalized))?.[0];
}

export function guardPatientPresentation(candidate: string, authoritativeText: string): string {
  return patientInstructionLeakage(candidate) ? authoritativeText : candidate;
}
