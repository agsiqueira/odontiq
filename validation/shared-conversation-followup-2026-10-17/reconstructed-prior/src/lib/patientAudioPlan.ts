export type PatientAudioEffectId =
  | "amara-breath-moderate-01"
  | "amara-breath-moderate-02"
  | "amara-breath-heavy-01";

export type PatientAudioPlanSegment =
  | { type: "effect"; effectId: PatientAudioEffectId }
  | { type: "speech"; text: string };

export type PatientAudioPlan = PatientAudioPlanSegment[];
export type AmaraBreathingPlacement =
  | "speech-only"
  | "moderate-before"
  | "moderate-after"
  | "moderate-between"
  | "heavy-before"
  | "heavy-after"
  | "two-breath";

export const AMARA_BREATHING_MODERATE_VIDEO_PATH =
  "/video/amara/amara-breathing-moderate.mp4";
export const AMARA_BREATHING_HEAVY_VIDEO_PATH =
  "/video/amara/amara-breathing-heavy.mp4";

export const AMARA_BREATH_EFFECT_VIDEO_PATHS: Record<PatientAudioEffectId, string> = {
  "amara-breath-moderate-01": AMARA_BREATHING_MODERATE_VIDEO_PATH,
  "amara-breath-moderate-02": AMARA_BREATHING_MODERATE_VIDEO_PATH,
  "amara-breath-heavy-01": AMARA_BREATHING_HEAVY_VIDEO_PATH,
};

export const AMARA_BREATH_EFFECT_PATHS: Record<PatientAudioEffectId, string> = {
  "amara-breath-moderate-01": "/audio/amara/amara-breath-moderate-01.mp3",
  "amara-breath-moderate-02": "/audio/amara/amara-breath-moderate-02.mp3",
  "amara-breath-heavy-01": "/audio/amara/amara-breath-heavy-01.mp3",
};

export function getAmaraBreathingAnimationPath(effectId: string | null | undefined) {
  return effectId && effectId in AMARA_BREATH_EFFECT_VIDEO_PATHS
    ? AMARA_BREATH_EFFECT_VIDEO_PATHS[effectId as PatientAudioEffectId]
    : undefined;
}

const AMARA_CASE_ID = "case-01";
const AMARA_HEAVY_BREATH: PatientAudioEffectId = "amara-breath-heavy-01";
const AMARA_MODERATE_BREATHS = [
  "amara-breath-moderate-01",
  "amara-breath-moderate-02",
] as const satisfies readonly PatientAudioEffectId[];

/**
 * Deterministic diversity rule: FNV-1a hashes `caseId`, the stable patient-turn
 * index, and the exact response. The final two decimal digits select fixed
 * buckets: 0-24 speech only, 25-39 moderate before, 40-59 moderate after,
 * 60-84 moderate between, 85-89 heavy before, 90-94 heavy after, and 95-99
 * two breaths. Unsupported short/mid shapes degrade deterministically without
 * splitting text. The same inputs therefore always produce the same plan.
 */
export function buildPatientAudioPlan(
  caseId: string,
  response: string,
  patientTurnIndex = 0,
): PatientAudioPlan {
  if (!response.trim()) return [];
  if (caseId !== AMARA_CASE_ID) return [{ type: "speech", text: response }];

  const selector = stableSelector(`${caseId}\u0000${patientTurnIndex}\u0000${response}`);
  const placement = selectAmaraBreathingPlacement(selector);
  const moderate = selectModerateBreath(selector);
  const wordCount = countWords(response);
  const boundary = wordCount >= 8 ? findSafeSpeechBoundary(response) : null;

  if (placement === "speech-only") return speechOnly(response);
  if (placement === "moderate-before") return effectBefore(response, moderate);
  if (placement === "moderate-after") return effectAfter(response, moderate);
  if (placement === "heavy-before") return effectBefore(response, AMARA_HEAVY_BREATH);
  if (placement === "heavy-after") return effectAfter(response, AMARA_HEAVY_BREATH);

  if (placement === "moderate-between") {
    if (boundary !== null) return effectBetween(response, boundary, moderate);
    return wordCount < 8 ? speechOnly(response) : effectAfter(response, moderate);
  }

  if (boundary === null || wordCount < 20) {
    return wordCount < 8 ? speechOnly(response) : effectAfter(response, moderate);
  }

  return [
    { type: "effect", effectId: moderate },
    { type: "speech", text: response.slice(0, boundary) },
    { type: "effect", effectId: alternateModerateBreath(moderate) },
    { type: "speech", text: response.slice(boundary) },
  ];
}

export function selectAmaraBreathingPlacement(selector: number): AmaraBreathingPlacement {
  const bucket = selector % 100;
  if (bucket < 25) return "speech-only";
  if (bucket < 40) return "moderate-before";
  if (bucket < 60) return "moderate-after";
  if (bucket < 85) return "moderate-between";
  if (bucket < 90) return "heavy-before";
  if (bucket < 95) return "heavy-after";
  return "two-breath";
}

function stableSelector(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function speechOnly(text: string): PatientAudioPlan {
  return [{ type: "speech", text }];
}

function effectBefore(text: string, effectId: PatientAudioEffectId): PatientAudioPlan {
  return [{ type: "effect", effectId }, { type: "speech", text }];
}

function effectAfter(text: string, effectId: PatientAudioEffectId): PatientAudioPlan {
  return [{ type: "speech", text }, { type: "effect", effectId }];
}

function effectBetween(text: string, boundary: number, effectId: PatientAudioEffectId): PatientAudioPlan {
  return [
    { type: "speech", text: text.slice(0, boundary) },
    { type: "effect", effectId },
    { type: "speech", text: text.slice(boundary) },
  ];
}

function countWords(text: string) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function selectModerateBreath(selector: number): PatientAudioEffectId {
  return AMARA_MODERATE_BREATHS[Math.floor(selector / 100) % AMARA_MODERATE_BREATHS.length];
}

function alternateModerateBreath(effectId: PatientAudioEffectId): PatientAudioEffectId {
  return effectId === AMARA_MODERATE_BREATHS[0]
    ? AMARA_MODERATE_BREATHS[1]
    : AMARA_MODERATE_BREATHS[0];
}

function findSafeSpeechBoundary(text: string): number | null {
  const sentence = /[.!?]["')\]]*(?=\s+\S)/u.exec(text);
  if (sentence) return sentence.index + sentence[0].length;

  const clause = /[,;:—](?=\s+\S)/u.exec(text);
  if (!clause) return null;
  const boundary = clause.index + clause[0].length;
  return countWords(text.slice(0, boundary)) >= 3 && countWords(text.slice(boundary)) >= 3
    ? boundary
    : null;
}
