import { loadCase, type CaseData } from "@/data/cases";

export type ConversationRole = "student" | "patient";

export type ConversationMessage = {
  id: string;
  role: ConversationRole;
  text: string;
  timestamp: string;
};

export type ConversationEngineResponse = {
  patientMessage: string;
  delay: number;
  emotion?: string;
  matchedConversationId?: string;
  matchedIntent?: string;
  requiredFactsCovered?: string[];
  checklistItemId?: string;
};

type MatchedScriptedResponse = {
  response: string;
  id?: string;
  intent?: string;
  requiredFactsCovered?: string[];
  checklistItemId?: string;
};

const fallbackPatientMessage =
  "I'm not sure. Can you ask me a more specific question about my symptoms?";

const directDiagnosisTriggers = [
  "diagnosis",
  "diagnose",
  "what is it",
  "what do you think it is",
  "differential",
  "impression",
];

const intentSynonyms: Record<string, string[]> = {
  greeting: ["hello", "hi", "hey", "good morning", "good afternoon"],
  chief_complaint: [
    "what brings",
    "why are you here",
    "main problem",
    "chief complaint",
    "bothering you",
  ],
  duration: [
    "how long",
    "duration",
    "how many days",
    "how many weeks",
    "for how long",
  ],
  onset: ["when did it start", "when started", "onset", "begin", "first notice"],
  pain_character: ["pain", "hurt", "ache", "severity", "scale", "rate"],
  medications: [
    "medication",
    "medicine",
    "ibuprofen",
    "acetaminophen",
    "painkiller",
    "antibiotic",
    "taken",
  ],
  allergies: ["allerg", "allergy", "allergies", "penicillin"],
  systemic_symptoms: ["fever", "chills", "temperature", "systemic", "feel sick"],
  examination: [
    "examination",
    "exam",
    "look",
    "see",
    "image",
    "xray",
    "x ray",
    "radiograph",
    "clinical findings",
    "findings",
  ],
  airway: [
    "breathing",
    "swallowing",
    "swallow",
    "lying flat",
    "airway",
    "trouble breathing",
    "trouble swallowing",
  ],
  swelling: ["swelling", "swollen", "cheek", "face", "jaw swelling"],
  thermal_sensitivity: [
    "cold",
    "hot",
    "temperature",
    "sensitive",
    "sensitivity",
    "thermal",
  ],
  biting_pain: ["bite", "biting", "chew", "chewing", "pressure"],
  diagnosis: directDiagnosisTriggers,
};

export function sendMessage(
  caseId: string,
  studentMessage: string,
  history: ConversationMessage[],
): ConversationEngineResponse {
  const caseData = loadCase(caseId);
  const normalizedMessage = normalize(studentMessage);
  const scriptedResponse = caseData
    ? findBestScriptedResponse(caseData, normalizedMessage, history)
    : undefined;
  const patientMessage =
    scriptedResponse?.response ??
    getOpeningResponse(
      caseData?.conversation.openingGreeting,
      history,
      normalizedMessage,
    ) ??
    fallbackPatientMessage;

  return {
    patientMessage,
    delay: Math.min(2200, Math.max(900, patientMessage.length * 35)),
    matchedConversationId: scriptedResponse?.id,
    matchedIntent: scriptedResponse?.intent,
    requiredFactsCovered: scriptedResponse?.requiredFactsCovered,
    checklistItemId: scriptedResponse?.checklistItemId,
  };
}

function findBestScriptedResponse(
  caseData: CaseData,
  normalizedMessage: string,
  history: ConversationMessage[],
): MatchedScriptedResponse | undefined {
  const isDiagnosisRequest = directDiagnosisTriggers.some((trigger) =>
    normalizedMessage.includes(normalize(trigger)),
  );
  const studentTurnCount = history.filter(
    (message) => message.role === "student",
  ).length;

  if (isDiagnosisRequest && studentTurnCount < 6) {
    return {
      response:
        "I can tell you what I'm feeling, but I need you to ask more about my symptoms first.",
    };
  }

  const scoredScripts = caseData.conversation.scripted
    .filter((script) => script.intent !== "diagnosis" || isDiagnosisRequest)
    .map((script) => ({
      script,
      score: getScriptScore(script, normalizedMessage),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredScripts[0]?.script;
}

function getScriptScore(
  script: CaseData["conversation"]["scripted"][number],
  normalizedMessage: string,
) {
  const triggers = [
    ...script.triggers,
    ...(intentSynonyms[script.intent] ?? []),
  ].map(normalize);

  return triggers.reduce((bestScore, trigger) => {
    const triggerWords = trigger.split(" ").filter(Boolean);

    if (!trigger) {
      return bestScore;
    }

    if (normalizedMessage === trigger) {
      return Math.max(bestScore, 100);
    }

    if (includesPhrase(normalizedMessage, trigger)) {
      return Math.max(bestScore, 80 + triggerWords.length);
    }

    const messageWords = normalizedMessage.split(" ").filter(Boolean);
    const matchedWords = triggerWords.filter((word) =>
      messageWords.includes(word),
    );
    const wordScore =
      triggerWords.length > 1 && matchedWords.length === triggerWords.length
        ? 60 + matchedWords.length
        : matchedWords.length > 0 && trigger.length > 4
          ? 25
          : 0;

    return Math.max(bestScore, wordScore);
  }, 0);
}

function includesPhrase(normalizedMessage: string, normalizedTrigger: string) {
  const messageWords = normalizedMessage.split(" ").filter(Boolean);
  const triggerWords = normalizedTrigger.split(" ").filter(Boolean);

  if (triggerWords.length === 0 || triggerWords.length > messageWords.length) {
    return false;
  }

  return messageWords.some((_, index) =>
    triggerWords.every((word, offset) => messageWords[index + offset] === word),
  );
}

function getOpeningResponse(
  openingGreeting: string | undefined,
  history: ConversationMessage[],
  normalizedMessage: string,
) {
  const hasConversationStarted = history.some(
    (message) => message.role === "student",
  );
  const isGreeting =
    normalizedMessage === "hello" ||
    normalizedMessage === "hello." ||
    normalizedMessage === "hi" ||
    normalizedMessage === "hi.";

  if (!hasConversationStarted && isGreeting) {
    return openingGreeting;
  }

  return undefined;
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
