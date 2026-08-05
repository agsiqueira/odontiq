"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentAudioContextState, emitAudioDiagnostic } from "@/lib/audioDiagnostics";
import { PatientAudioPlaybackController } from "@/lib/patientAudioPlaybackController";

type SpeechSynthesisStatus =
  | "unsupported"
  | "idle"
  | "preparing"
  | "speaking"
  | "error";

type UseSpeechSynthesisPlaybackOptions = {
  caseId: string;
};

type VoiceSpeakResponse =
  | {
      success: true;
      audioBase64: string;
      mimeType: string;
    }
  | {
      success: false;
      error?: string;
      reason?: string;
    };

export function useSpeechSynthesisPlayback({
  caseId,
}: UseSpeechSynthesisPlaybackOptions) {
  const audioControllerRef = useRef<PatientAudioPlaybackController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackIdRef = useRef(0);
  const lastTextRef = useRef("");
  const [status, setStatus] =
    useState<SpeechSynthesisStatus>("unsupported");
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);

  const isSupported = status !== "unsupported";
  const isPreparingSpeech = status === "preparing";
  const isSpeaking = status === "speaking";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
        setStatus("idle");
      } else {
        setStatus("unsupported");
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const getAudioController = useCallback(() => {
    if (!audioControllerRef.current) {
      audioControllerRef.current = new PatientAudioPlaybackController({
        createAudio: () => new Audio(),
        createObjectUrl: (blob) => URL.createObjectURL(blob),
        revokeObjectUrl: (url) => URL.revokeObjectURL(url),
        onPlaybackStarted: () => {
          setStatus("speaking");
          emitAudioDiagnostic("speaking_animation.started", {
            playback: "audio-element",
            isSpeaking: true,
          });
        },
        onPlaybackStopped: (reason) => {
          setStatus("idle");
          emitAudioDiagnostic("speaking_animation.stopped", {
            playback: "audio-element",
            isSpeaking: false,
            reason,
          });
        },
        onRetryRequired: () => setNeedsPlaybackTap(true),
        onRetryCleared: () => setNeedsPlaybackTap(false),
        onDiagnostic: emitAudioDiagnostic,
      });
    }
    return audioControllerRef.current;
  }, []);

  const cancelBrowserSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      emitAudioDiagnostic("tts.browser_cancelled", {
        isSpeaking: window.speechSynthesis.speaking,
      });
      window.speechSynthesis.cancel();
    }

    utteranceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    emitAudioDiagnostic("audio.stop_cleanup", {
      hadAbortController: Boolean(abortControllerRef.current),
      audioContextState: currentAudioContextState(),
    });
    playbackIdRef.current += 1;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    audioControllerRef.current?.cancel("stop");
    cancelBrowserSpeech();
    setStatus("idle");
  }, [cancelBrowserSpeech]);

  const playBrowserFallback = useCallback(
    (text: string, playbackId: number) => {
      if (
        playbackIdRef.current !== playbackId ||
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        setStatus("error");
        return;
      }

      cancelBrowserSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = caseId === "case-01" ? 0.95 : 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const browserVoice = selectBrowserVoice(caseId);
      if (browserVoice) {
        utterance.voice = browserVoice;
      }

      utteranceRef.current = utterance;

      utterance.onstart = () => {
        if (playbackIdRef.current !== playbackId) {
          return;
        }

        setStatus("speaking");
        emitAudioDiagnostic("speaking_animation.started", {
          playback: "browser-speech",
          isSpeaking: true,
        });
      };

      utterance.onend = () => {
        if (playbackIdRef.current !== playbackId) {
          return;
        }

        utteranceRef.current = null;
        setStatus("idle");
        emitAudioDiagnostic("speaking_animation.stopped", {
          playback: "browser-speech",
          isSpeaking: false,
          reason: "ended",
        });
      };

      utterance.onerror = () => {
        if (playbackIdRef.current !== playbackId) {
          return;
        }

        utteranceRef.current = null;
        setStatus("error");
        emitAudioDiagnostic("audio.error", {
          playback: "browser-speech",
          isSpeaking: false,
        });
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        utteranceRef.current = null;
        setStatus("error");
      }
    },
    [cancelBrowserSpeech, caseId],
  );

  const playNavigatorAudio = useCallback(
    async (
      audioBase64: string,
      mimeType: string,
    ): Promise<void> => {
      const audioBlob = new Blob([base64ToUint8Array(audioBase64)], {
        type: mimeType || "audio/mpeg",
      });
      const result = await getAudioController().playGeneratedAudio(audioBlob);
      if (result === "failed") throw new Error("Navigator audio playback failed.");
    },
    [getAudioController],
  );

  const speak = useCallback(
    async (text: string) => {
      const nextText = text.trim();

      if (!nextText) {
        return;
      }

      stop();
      lastTextRef.current = nextText;

      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      setStatus("preparing");
      emitAudioDiagnostic("tts.request_started", {
        playbackId,
        caseId,
        textLength: nextText.length,
        isSpeaking: false,
        audioContextState: currentAudioContextState(),
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            caseId,
            text: nextText,
          }),
          signal: controller.signal,
        });

        const data = (await response.json()) as VoiceSpeakResponse;
        emitAudioDiagnostic("tts.request_completed", {
          playbackId,
          httpStatus: response.status,
          ok: response.ok,
          success: data.success,
          aborted: controller.signal.aborted,
        });

        if (
          playbackIdRef.current !== playbackId ||
          controller.signal.aborted
        ) {
          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.audioBase64 ||
          !data.mimeType
        ) {
          throw new Error("Navigator TTS unavailable.");
        }

        abortControllerRef.current = null;
        await playNavigatorAudio(data.audioBase64, data.mimeType);
      } catch (error) {
        emitAudioDiagnostic("tts.request_failed_or_fallback", {
          playbackId,
          aborted: controller.signal.aborted,
          errorName: error instanceof Error ? error.name : typeof error,
        });
        if (
          playbackIdRef.current !== playbackId ||
          controller.signal.aborted
        ) {
          return;
        }

        abortControllerRef.current = null;
        playBrowserFallback(nextText, playbackId);
      }
    },
    [caseId, playBrowserFallback, playNavigatorAudio, stop],
  );

  const replay = useCallback(() => {
    void speak(lastTextRef.current);
  }, [speak]);

  const primePlayback = useCallback(() => {
    getAudioController().primeFromGesture();
  }, [getAudioController]);

  const retryPlayback = useCallback(() => {
    void getAudioController().retryFromGesture();
  }, [getAudioController]);

  const dismissPlaybackRetry = useCallback(() => {
    audioControllerRef.current?.dismissRetry();
  }, []);

  useEffect(() => {
    return () => {
      emitAudioDiagnostic("audio.unmount_cleanup", {
        hadAbortController: Boolean(abortControllerRef.current),
      });
      playbackIdRef.current += 1;
      abortControllerRef.current?.abort();
      audioControllerRef.current?.dispose();
      audioControllerRef.current = null;
      cancelBrowserSpeech();
    };
  }, [cancelBrowserSpeech]);

  return {
    isSpeaking,
    isPreparingSpeech,
    isSupported,
    needsPlaybackTap,
    primePlayback,
    replay,
    retryPlayback,
    dismissPlaybackRetry,
    speak,
    status,
    stop,
  };
}

function base64ToUint8Array(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

function selectBrowserVoice(caseId: string) {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    return null;
  }

  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en"),
  );
  const candidateVoices = englishVoices.length > 0 ? englishVoices : voices;

  if (caseId === "case-01") {
    const maleVoicePattern =
      /male|adam|alex|daniel|david|fred|george|guy|james|mark|ryan|tom/i;
    const maleVoice = candidateVoices.find((voice) =>
      maleVoicePattern.test(voice.name),
    );

    if (maleVoice) {
      return maleVoice;
    }
  }

  return candidateVoices.find((voice) => voice.default) ?? candidateVoices[0];
}
