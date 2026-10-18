"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentAudioContextState, emitAudioDiagnostic } from "@/lib/audioDiagnostics";

type SpeechRecognitionStatus =
  | "unsupported"
  | "idle"
  | "listening"
  | "error";

type SpeechRecognitionError = {
  code?: string;
  message: string;
};

type SpeechRecognitionResultAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionResultAlternative;
};

type SpeechRecognitionResultList = {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

type UseSpeechRecognitionOptions = {
  onFinalTranscript: (transcript: string) => void;
};

const unsupportedError: SpeechRecognitionError = {
  message: "Voice input is not available in this browser. Please type your question.",
};

const permissionBlockedError: SpeechRecognitionError = {
  code: "not-allowed",
  message: "Microphone access was blocked. Please enable it or type your question.",
};

export function useSpeechRecognition({
  onFinalTranscript,
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const [status, setStatus] =
    useState<SpeechRecognitionStatus>("unsupported");
  const [error, setError] = useState<SpeechRecognitionError | null>(null);

  const isSupported = status !== "unsupported";
  const isListening = status === "listening";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const Recognition =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;

      if (!Recognition) {
        setStatus("unsupported");
        setError(unsupportedError);
        return;
      }

      setStatus("idle");
      isListeningRef.current = false;
      setError(null);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const stopListening = useCallback(() => {
    emitAudioDiagnostic("microphone.recording_stop_requested", {
      isListening: true,
      isRecording: true,
      audioContextState: currentAudioContextState(),
    });
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      setStatus("unsupported");
      setError(unsupportedError);
      return;
    }

    if (recognitionRef.current) {
      emitAudioDiagnostic("speech_recognition.abort", { reason: "restart" });
      recognitionRef.current.abort();
    }
    finalTranscriptRef.current = "";

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let finalTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index] ?? event.results.item(index);

        if (result?.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }

      if (finalTranscript.trim()) {
        finalTranscriptRef.current = [
          finalTranscriptRef.current,
          finalTranscript,
        ]
          .filter(Boolean)
          .join(" ");
        emitAudioDiagnostic("speech_recognition.completed", {
          transcriptLength: finalTranscript.trim().length,
          isListening: true,
          isRecording: true,
        });
      }
    };

    recognition.onerror = (event) => {
      isListeningRef.current = false;
      emitAudioDiagnostic("speech_recognition.error", {
        errorCode: event.error ?? "unknown",
        isListening: false,
        isRecording: false,
      });
      const blocked = event.error === "not-allowed";
      setStatus("error");
      setError(
        blocked
          ? permissionBlockedError
          : {
              code: event.error,
              message: "Voice input could not be captured. Please try again or type your question.",
            },
      );
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      recognitionRef.current = null;

      setStatus((currentStatus) =>
        currentStatus === "error" ? "error" : "idle",
      );

      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";

      emitAudioDiagnostic("microphone.recording_stopped", {
        isListening: false,
        isRecording: false,
        transcriptLength: transcript.length,
        audioContextState: currentAudioContextState(),
      });

      if (transcript) {
        emitAudioDiagnostic("recognized_transcript.submitted", {
          transcriptLength: transcript.length,
        });
        onFinalTranscript(transcript);
      }
    };

    try {
      setError(null);
      setStatus("listening");
      isListeningRef.current = true;
      recognition.start();
      emitAudioDiagnostic("microphone.recording_started", {
        isListening: true,
        isRecording: true,
        audioContextState: currentAudioContextState(),
      });
    } catch {
      emitAudioDiagnostic("microphone.recording_start_rejected", {
        isListening: false,
        isRecording: false,
      });
      recognitionRef.current = null;
      isListeningRef.current = false;
      setStatus("error");
      setError({
        message: "Voice input could not be started. Please try again or type your question.",
      });
    }
  }, [onFinalTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        emitAudioDiagnostic("speech_recognition.cleanup", {
          action: "abort",
          isListening: true,
          isRecording: true,
        });
        recognitionRef.current.abort();
      }
      isListeningRef.current = false;
    };
  }, []);

  return {
    error,
    isListening,
    isListeningNow: () => isListeningRef.current,
    isSupported,
    startListening,
    status,
    stopListening,
    toggleListening,
  };
}
