const LEARNER_INTERFACE_REPLACEMENTS = new Map<string, string>([
  [
    "Recognized Emergency-Level Urgency",
    "Recognized Need for Hospital Assessment",
  ],
  [
    "Recognized the case as an emergency-level deep space infection risk.",
    "Recognized the deep-space infection risk and need for immediate hospital assessment.",
  ],
  [
    "Recognized the case as emergency-level urgency.",
    "Recognized the systemic infection as requiring immediate hospital assessment.",
  ],
  [
    "Considered hospital admission in the emergency systemic-infection context.",
    "Considered hospital admission for the acute systemic-infection presentation.",
  ],
]);

export function getCaseUrgencyDisplayLabel(urgency: string): string {
  return urgency === "Emergency" ? "Hospital Assessment" : urgency;
}

export function getLearnerInterfaceText(value: string): string {
  return LEARNER_INTERFACE_REPLACEMENTS.get(value) ?? value;
}
