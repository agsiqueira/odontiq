export interface AmaraBreathingVideoElement {
  currentTime: number;
  loop: boolean;
  muted: boolean;
  pause(): void;
  play(): Promise<void>;
}

export function startAmaraBreathingAnimation(
  video: AmaraBreathingVideoElement | null,
): () => void {
  if (!video) return () => undefined;

  video.loop = false;
  video.muted = true;
  try {
    video.currentTime = 0;
  } catch {
    // Metadata may not be available yet; audio playback remains authoritative.
  }
  void video.play().catch(() => {
    // Missing media and autoplay rejection must never interrupt breathing audio.
  });

  return () => {
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Returning to the static image is sufficient if seeking is unavailable.
    }
  };
}
