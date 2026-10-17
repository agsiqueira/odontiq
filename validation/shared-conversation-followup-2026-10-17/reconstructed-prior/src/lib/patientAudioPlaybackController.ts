export type PatientAudioPlaybackResult = "playing" | "blocked" | "cancelled" | "failed";
export type PatientAudioCompletionResult = "ended" | "cancelled" | "failed";

type PatientAudioEventName = "playing" | "ended" | "pause" | "error";

export interface PatientAudioElement {
  src: string;
  preload: string;
  error: { code: number } | null;
  addEventListener(type: PatientAudioEventName, listener: () => void): void;
  removeEventListener(type: PatientAudioEventName, listener: () => void): void;
  load(): void;
  pause(): void;
  play(): Promise<void>;
  removeAttribute(name: string): void;
}

export interface PatientAudioPlaybackControllerOptions {
  createAudio: () => PatientAudioElement;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  onPlaybackStarted: () => void;
  onPlaybackStopped: (reason: string) => void;
  onRetryRequired: () => void;
  onRetryCleared: () => void;
  onDiagnostic?: (event: string, details?: Record<string, unknown>) => void;
}

// 44-byte WAV header plus one silent PCM frame. It is intentionally inaudible.
const SILENT_PRIME_SOURCE =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

export class PatientAudioPlaybackController {
  private audio: PatientAudioElement | null = null;
  private objectUrl: string | null = null;
  private retryPending = false;
  private disposed = false;
  private priming = false;
  private operationId = 0;
  private completionResolver: ((result: PatientAudioCompletionResult) => void) | null = null;

  public constructor(private readonly options: PatientAudioPlaybackControllerOptions) {}

  public primeFromGesture(): void {
    if (this.disposed || this.objectUrl || this.retryPending) return;
    const audio = this.ensureAudio();
    const operationId = ++this.operationId;
    this.priming = true;
    audio.src = SILENT_PRIME_SOURCE;
    audio.load();
    this.options.onDiagnostic?.("audio.prime_called", { operationId });
    void audio.play().then(() => {
      this.options.onDiagnostic?.("audio.prime_resolved", { operationId });
      if (this.operationId === operationId && audio.src === SILENT_PRIME_SOURCE) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      this.priming = false;
    }).catch((error: unknown) => {
      this.options.onDiagnostic?.("audio.prime_rejected", {
        operationId,
        errorName: error instanceof Error ? error.name : typeof error,
      });
      if (this.operationId === operationId && audio.src === SILENT_PRIME_SOURCE) {
        audio.removeAttribute("src");
        audio.load();
      }
      this.priming = false;
    });
  }

  public async playGeneratedAudio(
    blob: Blob,
    preserveCompletion = false,
  ): Promise<PatientAudioPlaybackResult> {
    if (this.disposed) return "cancelled";
    this.replaceCurrentPlayback("replacement", preserveCompletion);
    const audio = this.ensureAudio();
    const operationId = ++this.operationId;
    const objectUrl = this.options.createObjectUrl(blob);
    this.objectUrl = objectUrl;
    this.retryPending = false;
    this.priming = false;
    this.options.onRetryCleared();
    audio.src = objectUrl;
    audio.load();
    return this.attemptPlay(operationId, "generated");
  }

  public playToCompletion(blob: Blob): Promise<PatientAudioCompletionResult> {
    return new Promise((resolve) => {
      this.settleCompletion("cancelled");
      this.completionResolver = resolve;
      void this.playGeneratedAudio(blob, true).then((result) => {
        if (result === "failed") this.settleCompletion("failed");
        if (result === "cancelled") this.settleCompletion("cancelled");
      });
    });
  }

  public async retryFromGesture(): Promise<PatientAudioPlaybackResult> {
    if (this.disposed || !this.objectUrl || !this.retryPending) return "cancelled";
    const operationId = ++this.operationId;
    this.retryPending = false;
    this.options.onRetryCleared();
    this.options.onDiagnostic?.("audio.retry_called", { operationId });
    return this.attemptPlay(operationId, "retry");
  }

  public cancel(reason = "cancelled"): void {
    if (this.disposed) return;
    ++this.operationId;
    this.audio?.pause();
    this.options.onPlaybackStopped(reason);
    this.releaseCurrentUrl();
    this.retryPending = false;
    this.options.onRetryCleared();
    this.options.onDiagnostic?.("audio.cancelled", { reason });
    this.settleCompletion("cancelled");
  }

  public dismissRetry(): void {
    if (!this.retryPending) return;
    this.cancel("retry-dismissed");
  }

  public hasPendingRetry(): boolean {
    return this.retryPending;
  }

  public getAudioElement(): PatientAudioElement | null {
    return this.audio;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.cancel("cleanup");
    this.disposed = true;
    if (this.audio) {
      this.audio.removeEventListener("playing", this.handlePlaying);
      this.audio.removeEventListener("ended", this.handleEnded);
      this.audio.removeEventListener("pause", this.handlePause);
      this.audio.removeEventListener("error", this.handleError);
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
  }

  private readonly handlePlaying = () => {
    if (this.priming || !this.objectUrl) return;
    this.retryPending = false;
    this.options.onRetryCleared();
    this.options.onPlaybackStarted();
    this.options.onDiagnostic?.("audio.playing");
  };

  private readonly handleEnded = () => {
    if (this.priming || !this.objectUrl) return;
    this.options.onPlaybackStopped("ended");
    this.options.onDiagnostic?.("audio.ended");
    this.releaseCurrentUrl();
    this.settleCompletion("ended");
  };

  private readonly handlePause = () => {
    if (this.priming || !this.objectUrl) return;
    this.options.onPlaybackStopped("pause");
    this.options.onDiagnostic?.("audio.paused");
  };

  private readonly handleError = () => {
    if (this.priming || !this.objectUrl) return;
    this.options.onPlaybackStopped("error");
    this.options.onDiagnostic?.("audio.error", {
      mediaErrorCode: this.audio?.error?.code ?? null,
    });
    this.releaseCurrentUrl();
    this.settleCompletion("failed");
  };

  private ensureAudio(): PatientAudioElement {
    if (this.audio) return this.audio;
    const audio = this.options.createAudio();
    audio.preload = "auto";
    audio.addEventListener("playing", this.handlePlaying);
    audio.addEventListener("ended", this.handleEnded);
    audio.addEventListener("pause", this.handlePause);
    audio.addEventListener("error", this.handleError);
    this.audio = audio;
    this.options.onDiagnostic?.("audio.element_created", { persistent: true });
    return audio;
  }

  private async attemptPlay(
    operationId: number,
    source: "generated" | "retry",
  ): Promise<PatientAudioPlaybackResult> {
    const audio = this.ensureAudio();
    this.options.onDiagnostic?.("audio.play_called", { operationId, source });
    try {
      await audio.play();
      if (this.disposed || operationId !== this.operationId) return "cancelled";
      this.options.onDiagnostic?.("audio.play_resolved", { operationId, source });
      return "playing";
    } catch (error) {
      if (this.disposed || operationId !== this.operationId) return "cancelled";
      const errorName = error instanceof Error ? error.name : typeof error;
      this.options.onPlaybackStopped("rejected");
      this.options.onDiagnostic?.("audio.play_rejected", { operationId, source, errorName });
      if (errorName === "NotAllowedError" && this.objectUrl) {
        this.retryPending = true;
        this.options.onRetryRequired();
        return "blocked";
      }
      this.releaseCurrentUrl();
      this.settleCompletion("failed");
      return "failed";
    }
  }

  private replaceCurrentPlayback(reason: string, preserveCompletion = false): void {
    if (!this.audio && !this.objectUrl) return;
    ++this.operationId;
    this.audio?.pause();
    this.options.onPlaybackStopped(reason);
    this.releaseCurrentUrl();
    this.retryPending = false;
    this.options.onRetryCleared();
    if (!preserveCompletion) this.settleCompletion("cancelled");
  }

  private settleCompletion(result: PatientAudioCompletionResult): void {
    const resolve = this.completionResolver;
    this.completionResolver = null;
    resolve?.(result);
  }

  private releaseCurrentUrl(): void {
    const objectUrl = this.objectUrl;
    this.objectUrl = null;
    if (this.audio && objectUrl && this.audio.src === objectUrl) {
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    if (objectUrl) this.options.revokeObjectUrl(objectUrl);
  }
}
