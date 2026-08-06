export const PATIENT_LANGUAGE_POLICY = {
  responseLanguage: "English",
  rules: [
    "all-patients-speak-english",
    "responses-remain-english-only",
    "do-not-translate-clinical-answers",
    "do-not-imitate-learner-language",
    "recognize-language-change-requests-without-switching",
    "language-policy-responses-disclose-no-clinical-facts",
    "resume-clinical-processing-only-for-english-messages",
    "reject-clearly-non-english-patient-output-before-persistence",
  ],
  detectionLayers: [
    "generic-language-command",
    "conservative-script-and-lexical-identification",
    "final-output-language-backstop",
  ],
} as const;

export const LANGUAGE_POLICY_BEHAVIOR_INTENT_ID = "language-policy:english-only";

export type PatientLanguageIntent =
  | "english-ability"
  | "other-language-ability"
  | "switch-language"
  | "translation-request"
  | "non-english-message";

export type PatientLanguageDetection = {
  intent: PatientLanguageIntent;
  confidence: "exact-pattern" | "canonical-language-target" | "conservative-language-id";
  matchReason: string;
  requestedLanguage?: string;
  bypassClinicalGeneration: true;
};

export type LanguagePolicyRepetitionLevel = "first" | "first-repeat" | "later-repeat";

// Canonical names and common aliases are used to validate the target captured by
// generic command grammar. The command grammar is not duplicated per language.
const LANGUAGE_NAMES = new Set([
  "afrikaans", "albanian", "amharic", "arabic", "armenian", "bengali", "bangla",
  "bosnian", "bulgarian", "burmese", "cantonese", "catalan", "chinese", "croatian",
  "czech", "danish", "dutch", "english", "estonian", "farsi", "persian", "filipino",
  "finnish", "french", "georgian", "german", "greek", "gujarati", "haitian creole",
  "hebrew", "hindi", "hungarian", "icelandic", "indonesian", "italian", "japanese",
  "kannada", "khmer", "korean", "lao", "latvian", "lithuanian", "malay", "malayalam",
  "mandarin", "marathi", "nepali", "norwegian", "pashto", "polish", "portuguese",
  "punjabi", "romanian", "russian", "serbian", "slovak", "slovenian", "somali",
  "spanish", "swahili", "swedish", "tagalog", "tamil", "telugu", "thai", "turkish",
  "ukrainian", "urdu", "vietnamese", "welsh", "yiddish", "yoruba",
]);
const NON_LANGUAGE_COMMAND_TARGETS = new Set([
  "clearly", "slowly", "quickly", "louder", "softly", "up", "honestly", "freely",
  "normally", "now", "the question", "your mind", "to me",
]);

const POLITE_PREFIX = "(?:please\\s+|could you\\s+|can you\\s+|would you\\s+|will you\\s+|could we\\s+|can we\\s+|let'?s\\s+|i want you to\\s+|i need you to\\s+)?";
const ENGLISH_ABILITY = /\b(?:do you|can you)\s+(?:speak|understand|know)\s+english\b|\bis english\s+(?:okay|ok|all right)\b|\bdo you understand me in english\b/i;
const ABILITY_COMMAND = new RegExp(`\\b(?:do you|can you)\\s+(?:speak|understand|know)\\s+([a-z][a-z -]{1,30})`, "i");
const TARGETED_COMMAND = new RegExp(
  `(?:^|[.!?]\\s*)${POLITE_PREFIX}(speak|answer|respond|reply|continue|switch|talk|write|communicate)(?:\\s+(?:to|using))?(?:\\s+in)?\\s+([a-z][a-z -]{1,40}?)(?:\\s+(?:please|from now on|instead))?[.!?]*$`,
  "i",
);
const TRANSLATION_COMMAND = new RegExp(
  `(?:^|[.!?]\\s*)${POLITE_PREFIX}(?:translate(?:\\s+(?:that|this|it|your answer))?|say\\s+(?:that|this|it)(?:\\s+again)?|repeat\\s+(?:that|this|it))(?:\\s+(?:into|in|to)\\s+([a-z][a-z -]{1,30}))?(?:\\s+for me)?[.!?]*$`,
  "i",
);
const GENERIC_NON_ENGLISH_COMMAND = /\b(?:use|speak|answer|respond|reply|continue in|switch to)\s+(?:another|a different|any other)\s+language\b|\bspeak\s+(?:anything|something)\s+(?:but|other than)\s+english\b|\b(?:do not|don'?t|stop)\s+(?:use|using|speak|speaking)\s+english\b/i;

const ENGLISH_MARKERS = new Set([
  "a", "am", "and", "are", "can", "did", "do", "does", "for", "have", "how", "i",
  "in", "is", "it", "long", "medications", "my", "of", "pain", "speak", "the", "this",
  "to", "tooth", "understand", "was", "what", "when", "where", "which", "with", "you", "your",
]);

// High-frequency function and clinical words. Requiring multiple markers keeps
// names, loanwords, and short quotations from becoming language classifications.
const NON_ENGLISH_LATIN_MARKERS = new Set([
  // Spanish / Portuguese / French / Italian
  "cuanto", "donde", "duele", "dolor", "desde", "usted", "tiene", "lleva", "dias", "siento", "hablo", "espanol",
  "quanto", "onde", "esta", "voce", "tempo", "dor", "desculpe", "falo", "nao", "portugues",
  "combien", "depuis", "douleur", "avez", "vous", "parlez", "francais", "suis", "desole", "parle", "pas",
  "quanto", "dolore", "dove", "tempo", "parla", "italiano",
  // German / Dutch / Polish / Turkish / Vietnamese / Swahili
  "wie", "lange", "haben", "schmerzen", "sprechen", "deutsch", "tut", "mir", "leid", "ich", "kein",
  "hoe", "lang", "heeft", "pijn", "spreekt", "nederlands",
  "jak", "dlugo", "boli", "mnie", "mowisz", "polsku",
  "ne", "kadar", "suredir", "agriyor", "turkce", "konusun",
  "bao", "lau", "dau", "noi", "tieng", "viet",
  "una", "maumivu", "kwa", "muda", "zungumza", "kiswahili",
]);

const CLEARLY_NON_LATIN_SCRIPT = /[\p{Script=Arabic}\p{Script=Armenian}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Georgian}\p{Script=Greek}\p{Script=Gujarati}\p{Script=Han}\p{Script=Hangul}\p{Script=Hebrew}\p{Script=Hiragana}\p{Script=Kannada}\p{Script=Katakana}\p{Script=Khmer}\p{Script=Lao}\p{Script=Malayalam}\p{Script=Myanmar}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Thai}]/gu;

export function detectPatientLanguageIntent(message: string): PatientLanguageDetection | undefined {
  const text = normalizeMessage(message);
  if (!text) return undefined;

  if (ENGLISH_ABILITY.test(text)) {
    return detection("english-ability", "exact-pattern", "explicit English-language ability question", "English");
  }

  if (GENERIC_NON_ENGLISH_COMMAND.test(text)) {
    return detection("switch-language", "exact-pattern", "generic request to stop using English", "another language");
  }

  const translation = text.match(TRANSLATION_COMMAND);
  if (translation) {
    const target = cleanTarget(translation[1]);
    if (!target || target !== "english") {
      return detection("translation-request", "exact-pattern", "explicit translation request", displayTarget(target));
    }
  }

  const ability = text.match(ABILITY_COMMAND);
  if (ability) {
    const target = canonicalLanguage(cleanTarget(ability[1]));
    if (target && target !== "english") {
      return detection("other-language-ability", "canonical-language-target", "other-language ability question", displayTarget(target));
    }
  }

  const command = text.match(TARGETED_COMMAND);
  if (command) {
    const target = canonicalLanguage(cleanTarget(command[2]));
    if (target && target !== "english") {
      return detection("switch-language", "canonical-language-target", "generic language command with non-English target", displayTarget(target));
    }
  }

  if (isClearlyNonEnglishText(text)) {
    return detection("non-english-message", "conservative-language-id", "predominantly non-English script or lexical evidence");
  }

  return undefined;
}

export function isClearlyNonEnglishText(text: string): boolean {
  const normalized = normalizeMessage(text);
  if (!normalized) return false;
  const letters = normalized.match(/\p{Letter}/gu) ?? [];
  const nonLatin = normalized.match(CLEARLY_NON_LATIN_SCRIPT) ?? [];
  if (nonLatin.length >= 2 && nonLatin.length / Math.max(letters.length, 1) >= 0.25) return true;

  const tokens = tokenize(normalized);
  if (tokens.length < 3) return false;
  const englishScore = score(tokens, ENGLISH_MARKERS);
  const foreignScore = score(tokens, NON_ENGLISH_LATIN_MARKERS);
  return foreignScore >= 2 && foreignScore >= englishScore + 1;
}

export function languagePolicyRepetitionLevel(priorCount: number): LanguagePolicyRepetitionLevel {
  if (priorCount <= 0) return "first";
  if (priorCount === 1) return "first-repeat";
  return "later-repeat";
}

export function governedPatientLanguageResponse({
  detection: languageDetection,
  repetitionLevel,
  isAmara,
}: {
  detection: PatientLanguageDetection;
  repetitionLevel: LanguagePolicyRepetitionLevel;
  isAmara: boolean;
}) {
  if (languageDetection.intent === "english-ability") {
    return isAmara ? "Yeah. I speak English." : "Yes. I speak English.";
  }
  if (!isAmara) {
    return languageDetection.intent === "non-english-message"
      ? "I only speak English. Ask me in English."
      : "I speak English. Ask me in English.";
  }
  if (repetitionLevel === "first-repeat") return "I said English. I’m tired—ask me what you need.";
  if (repetitionLevel === "later-repeat") return "English. Just ask me what you need.";
  return "No. English. Ask me what you need.";
}

export function nonEnglishOutputDetection(): PatientLanguageDetection {
  return detection("non-english-message", "conservative-language-id", "final patient output is clearly non-English");
}

export function buildPatientLanguageFixtures() {
  const scenarios = [
    "Do you speak English?", "speak portuguese", "Answer Japanese", "Continue in Arabic",
    "Translate that for me", "¿Cuánto tiempo lleva con dolor?", "どのくらい痛みがありますか？",
    "How long have you had this dolor?", "What medications do you take?",
  ];
  return scenarios.map((input, index) => {
    const languageDetection = detectPatientLanguageIntent(input);
    return {
      id: `${index}-amara-first`, input, detection: languageDetection, repetitionLevel: "first" as const,
      patientProfile: "Amara", response: languageDetection ? governedPatientLanguageResponse({ detection: languageDetection, repetitionLevel: "first", isAmara: true }) : undefined,
      bypassed: Boolean(languageDetection),
    };
  });
}

function detection(intent: PatientLanguageIntent, confidence: PatientLanguageDetection["confidence"], matchReason: string, requestedLanguage?: string): PatientLanguageDetection {
  return { intent, confidence, matchReason, ...(requestedLanguage ? { requestedLanguage } : {}), bypassClinicalGeneration: true };
}

function normalizeMessage(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function cleanTarget(value?: string) {
  return value?.toLowerCase().replace(/[^a-z -]/g, "").replace(/\s+/g, " ").trim();
}

function canonicalLanguage(target?: string) {
  if (!target) return undefined;
  const words = target.split(" ");
  for (let length = Math.min(words.length, 3); length >= 1; length -= 1) {
    const candidate = words.slice(0, length).join(" ");
    if (LANGUAGE_NAMES.has(candidate)) return candidate;
  }
  // A bare target in explicit language-command grammar is treated as a
  // language unless it is a common manner/object phrase. This safely covers
  // valid names and aliases not yet represented in the canonical-name set.
  return words.length <= 2 && !NON_LANGUAGE_COMMAND_TARGETS.has(target)
    ? target
    : undefined;
}

function displayTarget(target?: string) {
  if (!target) return "another language";
  return target.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tokenize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]+/g) ?? [];
}

function score(tokens: readonly string[], markers: ReadonlySet<string>) {
  return tokens.reduce((total, token) => total + (markers.has(token) ? 1 : 0), 0);
}
