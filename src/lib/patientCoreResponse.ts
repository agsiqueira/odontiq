import type { CaseData } from "@/data/cases";

export type PatientCoreIntent = "patient_identity" | "chief_complaint";

export type GovernedPatientCoreResponse = {
  intent: PatientCoreIntent;
  text: string;
};

const IDENTITY_PATTERNS = [
  /\bwhat(?:'s| is) your (?:full )?name\b/i,
  /\btell me your (?:full )?name\b/i,
  /\bcan you tell me your (?:full )?name\b/i,
  /\bmay i (?:please )?(?:have|ask) your (?:full )?name\b/i,
  /\bwho am i speaking (?:with|to)\b/i,
  /\bwho are you\b/i,
  /\b(?:can|could|would) you (?:please )?introduce yourself\b/i,
  /\bwhat should i call you\b/i,
  /\bplease confirm your (?:full )?name\b/i,
];

const CHIEF_COMPLAINT_PATTERNS = [
  /\bwhat brings you (?:in|here)(?: today)?\b/i,
  /\bwhy are you here\b/i,
  /\bwhat brought you here\b/i,
  /\bwhy did you come in\b/i,
  /\btell me what brought you in\b/i,
  /\bwhat seems to be the problem\b/i,
  /\bwhat(?:'s| is) bothering you(?: (?:the )?most)?(?: today)?\b/i,
  /\btell me what(?:'s| is) going on\b/i,
  /\bwhat can i help you with(?: today)?\b/i,
  /\bwhat brought you to (?:the )?(?:emergency department|emergency room|er|hospital|clinic)\b/i,
  /\bwhy did you come to (?:the )?(?:emergency department|emergency room|er|hospital|clinic)\b/i,
  /\bwhat is your main concern(?: today)?\b/i,
  /\bwhat is your chief complaint\b/i,
];

function normalizeMessage(message: string): string {
  return message
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyPatientCoreIntent(message: string): PatientCoreIntent | undefined {
  const normalizedMessage = normalizeMessage(message);
  if (IDENTITY_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) return "patient_identity";
  if (CHIEF_COMPLAINT_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) return "chief_complaint";
  return undefined;
}

export function governedPatientCoreResponse(
  caseData: CaseData,
  message: string,
): GovernedPatientCoreResponse | undefined {
  const intent = classifyPatientCoreIntent(message);
  if (!intent) return undefined;

  if (intent === "patient_identity") {
    return { intent, text: `My name is ${caseData.patient.name}.` };
  }

  const scriptedResponse = caseData.conversation.scripted.find(
    (entry) => entry.intent === "chief_complaint",
  )?.response;
  return {
    intent,
    text: scriptedResponse ?? caseData.metadata.chiefComplaint,
  };
}
