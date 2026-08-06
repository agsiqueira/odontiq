"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentAudioContextState, emitAudioDiagnostic } from "@/lib/audioDiagnostics";
import { PatientAudioPlaybackController } from "@/lib/patientAudioPlaybackController";
import {
  playPatientAudioSequence,
  type RenderedPatientAudioSegment,
} from "@/lib/patientAudioSequence";

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
      audioPlan: RenderedPatientAudioSegment[];
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

  const playAudioBlob = useCallback(
    async (
      audioBlob: Blob,
    ) => {
      return getAudioController().playToCompletion(audioBlob);
    },
    [getAudioController],
  );

  const playAudioPlan = useCallback(
    async (audioPlan: Extract<VoiceSpeakResponse, { success: true }>["audioPlan"], playbackId: number) => {
      await playPatientAudioSequence(audioPlan, {
        isCancelled: () => playbackIdRef.current !== playbackId,
        loadEffect: (segment) => fetchEffectBlob(segment.src),
        loadSpeech: (segment) => new Blob(
          [base64ToUint8Array(segment.audioBase64)],
          { type: segment.mimeType || "audio/mpeg" },
        ),
        play: playAudioBlob,
        onFailure: (segment, error, continued) => {
          emitAudioDiagnostic("audio.sequence_segment_failed", {
            playbackId,
            segmentType: segment.type,
            segmentId: segment.type === "effect" ? segment.effectId : undefined,
            errorName: error instanceof Error ? error.name : typeof error,
            continued,
          });
        },
      });
    },
    [playAudioBlob],
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
          !Array.isArray(data.audioPlan) ||
          data.audioPlan.length === 0
        ) {
          throw new Error("Navigator TTS unavailable.");
        }

        abortControllerRef.current = null;
        await playAudioPlan(data.audioPlan, playbackId);
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
    [caseId, playAudioPlan, playBrowserFallback, stop],
  );

  const auditionEffect = useCallback(
    async (src: string) => {
      stop();
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      setStatus("preparing");
      try {
        const blob = await fetchEffectBlob(src);
        if (playbackIdRef.current !== playbackId) return;
        await playAudioBlob(blob);
      } catch {
        if (playbackIdRef.current === playbackId) setStatus("error");
      }
    },
    [playAudioBlob, stop],
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
    auditionEffect,
    speak,
    status,
    stop,
  };
}

async function fetchEffectBlob(src: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Breathing effect failed with status ${response.status}.`);
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith("audio/")) {
    throw new Error("Breathing effect was not valid audio.");
  }
  return blob;
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
