export type KokoroVoiceGender = "male" | "female";

export type KokoroVoiceCatalogEntry = {
  voiceId: string;
  gender: KokoroVoiceGender;
  notes?: string;
};

export const KOKORO_VOICE_CATALOG = [
  { voiceId: "am_adam", gender: "male", notes: "Previously used for Case 1." },
  { voiceId: "am_echo", gender: "male" },
  { voiceId: "am_eric", gender: "male", notes: "Current Case 1 candidate." },
  { voiceId: "am_liam", gender: "male", notes: "Configured for Case 2." },
  { voiceId: "am_michael", gender: "male", notes: "Configured for Case 4." },
  { voiceId: "am_onyx", gender: "male" },
  { voiceId: "am_puck", gender: "male" },
  { voiceId: "am_santa", gender: "male" },
  { voiceId: "af_alloy", gender: "female" },
  { voiceId: "af_aoede", gender: "female" },
  { voiceId: "af_bella", gender: "female", notes: "Configured for Case 3." },
  { voiceId: "af_heart", gender: "female", notes: "Configured for Case 5." },
  { voiceId: "af_jessica", gender: "female" },
  { voiceId: "af_kore", gender: "female" },
  { voiceId: "af_nicole", gender: "female" },
  { voiceId: "af_nova", gender: "female" },
  { voiceId: "af_river", gender: "female" },
  { voiceId: "af_sarah", gender: "female" },
  { voiceId: "af_sky", gender: "female" },
] as const satisfies readonly KokoroVoiceCatalogEntry[];

export function isKnownKokoroVoiceId(voiceId: string) {
  return KOKORO_VOICE_CATALOG.some((voice) => voice.voiceId === voiceId);
}

export function getKokoroVoicesByGender(gender: KokoroVoiceGender) {
  return KOKORO_VOICE_CATALOG.filter((voice) => voice.gender === gender);
}
