export type PatientAudioEffectId =
  | "amara-breath-moderate-01"
  | "amara-breath-moderate-02"
  | "amara-breath-heavy-01";

export type PatientAudioPlanSegment =
  | { type: "effect"; effectId: PatientAudioEffectId }
  | { type: "speech"; text: string };

export type PatientAudioPlan = PatientAudioPlanSegment[];

export const AMARA_BREATH_EFFECT_PATHS: Record<PatientAudioEffectId, string> = {
  "amara-breath-moderate-01": "/audio/amara/amara-breath-moderate-01.mp3",
  "amara-breath-moderate-02": "/audio/amara/amara-breath-moderate-02.mp3",
  "amara-breath-heavy-01": "/audio/amara/amara-breath-heavy-01.mp3",
};

const AMARA_CASE_ID = "case-01";
const AMARA_HEAVY_BREATH: PatientAudioEffectId = "amara-breath-heavy-01";
const AMARA_MODERATE_BREATHS = [
  "amara-breath-moderate-01",
  "amara-breath-moderate-02",
] as const satisfies readonly PatientAudioEffectId[];

/**
 * Builds the exact, deterministic playback sequence for a patient response.
 * Speech text is never normalized here: concatenating all speech segments always
 * reproduces the supplied response byte-for-byte.
 */
export function buildPatientAudioPlan(
  caseId: string,
  response: string,
): PatientAudioPlan {
  if (!response.trim()) return [];
  if (caseId !== AMARA_CASE_ID) return [{ type: "speech", text: response }];

  const wordCount = countWords(response);

  if (wordCount < 8) {
    return [
      { type: "effect", effectId: selectModerateBreath(wordCount) },
      { type: "speech", text: response },
    ];
  }

  if (wordCount < 20) {
    return [
      { type: "effect", effectId: AMARA_HEAVY_BREATH },
      { type: "speech", text: response },
    ];
  }

  const boundary = findSafeFirstSentenceBoundary(response);
  if (boundary === null) {
    return [
      { type: "effect", effectId: AMARA_HEAVY_BREATH },
      { type: "speech", text: response },
    ];
  }

  return [
    { type: "effect", effectId: AMARA_HEAVY_BREATH },
    { type: "speech", text: response.slice(0, boundary) },
    { type: "effect", effectId: selectModerateBreath(wordCount) },
    { type: "speech", text: response.slice(boundary) },
  ];
}

function countWords(text: string) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function selectModerateBreath(wordCount: number): PatientAudioEffectId {
  return AMARA_MODERATE_BREATHS[wordCount % AMARA_MODERATE_BREATHS.length];
}

function findSafeFirstSentenceBoundary(text: string): number | null {
  // Require terminal sentence punctuation followed by whitespace and substantive
  // text on both sides. Keeping that whitespace with the remainder preserves the
  // response exactly and avoids inventing pauses inside abbreviations such as 8.5.
  const match = /[.!?]["')\]]*(?=\s+\S)/u.exec(text);
  if (!match) return null;

  const boundary = match.index + match[0].length;
  return countWords(text.slice(0, boundary)) > 0 &&
    countWords(text.slice(boundary)) > 0
    ? boundary
    : null;
}
