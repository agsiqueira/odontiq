"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackIdRef = useRef(0);
  const lastTextRef = useRef("");
  const [status, setStatus] =
    useState<SpeechSynthesisStatus>("unsupported");

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

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const cancelBrowserSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    utteranceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    playbackIdRef.current += 1;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    cleanupAudio();
    cancelBrowserSpeech();
    setStatus("idle");
  }, [cancelBrowserSpeech, cleanupAudio]);

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
      };

      utterance.onend = () => {
        if (playbackIdRef.current !== playbackId) {
          return;
        }

        utteranceRef.current = null;
        setStatus("idle");
      };

      utterance.onerror = () => {
        if (playbackIdRef.current !== playbackId) {
          return;
        }

        utteranceRef.current = null;
        setStatus("error");
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
      playbackId: number,
    ): Promise<void> => {
      const audioBlob = new Blob([base64ToUint8Array(audioBase64)], {
        type: mimeType || "audio/mpeg",
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      cleanupAudio();
      audioUrlRef.current = audioUrl;
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onplaying = () => {
          if (playbackIdRef.current !== playbackId) {
            return;
          }

          setStatus("speaking");
          resolve();
        };

        audio.onended = () => {
          if (playbackIdRef.current === playbackId) {
            cleanupAudio();
            setStatus("idle");
          }

          resolve();
        };

        audio.onerror = () => {
          if (playbackIdRef.current === playbackId) {
            cleanupAudio();
          }

          reject(new Error("Navigator audio playback failed."));
        };

        void audio.play().catch((error: unknown) => {
          if (playbackIdRef.current === playbackId) {
            cleanupAudio();
          }

          reject(error);
        });
      });
    },
    [cleanupAudio],
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
        await playNavigatorAudio(data.audioBase64, data.mimeType, playbackId);
      } catch {
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

  useEffect(() => {
    return () => {
      playbackIdRef.current += 1;
      abortControllerRef.current?.abort();
      cleanupAudio();
      cancelBrowserSpeech();
    };
  }, [cancelBrowserSpeech, cleanupAudio]);

  return {
    isSpeaking,
    isPreparingSpeech,
    isSupported,
    replay,
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
