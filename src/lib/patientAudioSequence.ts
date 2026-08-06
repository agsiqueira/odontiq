import type { PatientAudioCompletionResult } from "@/lib/patientAudioPlaybackController";

export type RenderedPatientAudioSegment =
  | { type: "effect"; effectId: string; src: string }
  | {
      type: "speech";
      text: string;
      audioBase64: string;
      mimeType: string;
    };

type PatientAudioSequenceOptions = {
  isCancelled: () => boolean;
  loadEffect: (segment: Extract<RenderedPatientAudioSegment, { type: "effect" }>) => Promise<Blob>;
  loadSpeech: (segment: Extract<RenderedPatientAudioSegment, { type: "speech" }>) => Blob;
  play: (blob: Blob) => Promise<PatientAudioCompletionResult>;
  onFailure?: (segment: RenderedPatientAudioSegment, error: unknown, continued: boolean) => void;
};

export async function playPatientAudioSequence(
  segments: RenderedPatientAudioSegment[],
  options: PatientAudioSequenceOptions,
) {
  for (const segment of segments) {
    if (options.isCancelled()) return "cancelled" as const;

    try {
      const blob = segment.type === "effect"
        ? await options.loadEffect(segment)
        : options.loadSpeech(segment);
      if (options.isCancelled()) return "cancelled" as const;
      const result = await options.play(blob);
      if (result === "cancelled") return "cancelled" as const;
      if (result === "failed" && segment.type === "speech") {
        throw new Error("Patient speech playback failed.");
      }
    } catch (error) {
      const continued = segment.type === "effect";
      options.onFailure?.(segment, error, continued);
      if (!continued) throw error;
    }
  }

  return "ended" as const;
}
