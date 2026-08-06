import { AMARA_PATIENT_ID } from "./amaraContract";
import type { AmaraToneMode, BehavioralRenderInput } from "./types";

const AMARA_CASE_ID = "case-01";

// These templates are deliberately limited to authoritative Case 1 response
// text. Each changes cadence while retaining every clinical assertion.
const CASE_1_TEMPLATES: Readonly<Record<string, string>> = {
  "The dental pain has been worsening for four days.":
    "Four days. The dental pain has been worsening.",
  "The tooth pain has been getting worse for four days.":
    "Four days. The tooth pain has been getting worse.",
  "The pain is eight out of ten now.": "Eight out of ten. That's the pain now.",
  "The painful tooth is my lower-left molar.": "Lower-left molar. That's the painful tooth.",
  "It started gradually as a dull toothache, then got worse quickly.":
    "Gradually, a dull toothache. Then it got worse quickly.",
  "Yes. It is very hard to swallow.": "Yeah. It's very hard to swallow.",
  "No, I cannot swallow liquids normally.": "No. I can't swallow liquids normally.",
  "Yes. I feel short of breath.": "Yeah. I feel short of breath.",
  "The swelling is on both sides under my jaw.": "Both sides under my jaw. That's where the swelling is.",
  "Yes. I have felt very hot, but I did not have a thermometer at home.":
    "Yeah. I've felt very hot... but I didn't have a thermometer at home.",
  "I take metformin and lisinopril.": "Metformin and lisinopril. I take both.",
  "I do not have any drug allergies that I know of, including penicillin.":
    "I don't have any drug allergies that I know of, including penicillin.",
  "I have no known drug allergies, including no penicillin allergy.":
    "No known drug allergies. No penicillin allergy.",
  "No, I do not have chest pain.": "No. I don't have chest pain.",
  "I have a bad toothache and swelling, and swallowing is hard. I feel short of breath if I lie down.":
    "Bad toothache and swelling. Swallowing is hard. I feel short of breath if I lie down.",
  "It began as a dull ache and is now eight out of ten despite pain medicine from the store.":
    "It began as a dull ache. Now it's eight out of ten, despite pain medicine from the store.",
  "Hello... please help me.": "Hello... help me.",
};

export function selectAmaraToneMode(
  input: Pick<BehavioralRenderInput, "patientId" | "caseId" | "originalText">,
): AmaraToneMode {
  const modes: readonly AmaraToneMode[] = [
    "brief", "exhausted", "mildly_impatient", "cooperative_terse",
  ];
  const key = `${input.patientId}\u0000${input.caseId}\u0000${input.originalText}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return modes[(hash >>> 0) % modes.length];
}

export function renderAmaraCandidate(
  input: Readonly<BehavioralRenderInput>,
  mode: AmaraToneMode = selectAmaraToneMode(input),
): string {
  if (input.patientId !== AMARA_PATIENT_ID || input.caseId !== AMARA_CASE_ID) {
    return input.originalText;
  }

  const template = CASE_1_TEMPLATES[input.originalText];
  if (template) return template;

  // Unknown free text gets only presentation-safe edits. If none applies, it
  // remains unchanged rather than entering a broad paraphrasing path.
  let candidate = input.originalText
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bI do not\b/g, "I don't")
    .replace(/\bI did not\b/g, "I didn't")
    .replace(/\bI cannot\b/g, "I can't")
    .replace(/\bIt is\b/g, "It's")
    .replace(/\bI have not\b/g, "I haven't");

  if (mode === "mildly_impatient") {
    candidate = candidate.replace(/^(?:Thank you(?: very much)?[,.!]\s*|Please,?\s+)/i, "");
  }

  return candidate;
}
