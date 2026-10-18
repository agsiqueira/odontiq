/** A speech act, not a case/question answer table. Mixed clinical requests stay on their normal path. */
export function isPatientConversationClosure(message: string): boolean {
  return /^(?:(?:okay|ok|alright)[,.!]?\s*)?(?:thank you(?: very much| so much)?(?: for (?:explaining(?: that)?|your help|the information|sharing(?: that)?))?|thanks(?: for (?:explaining(?: that)?|your help|sharing(?: that)?))?|that(?:'s| is) all(?: for now)?|goodbye|bye)[.!\s]*$/i.test(message.trim());
}

export function assessPatientClosure(text: string, message?: string) {
  if (!message || !isPatientConversationClosure(message)) return { valid: true };
  return /^(?:you(?:'re| are) welcome|of course|okay(?:,? i understand)?|alright(?:,? i understand)?|thank you|thanks|take care|goodbye|bye)[.!\s]*$/i.test(text.trim())
    ? { valid: true } : { valid: false, reason: "closure must acknowledge without restarting history or adding a patient question" };
}
