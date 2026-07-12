"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getKokoroVoicesByGender,
  type KokoroVoiceCatalogEntry,
} from "@/lib/voiceCatalog";

const DEFAULT_SAMPLE_TEXT =
  "Hello, doctor. I've had pain on this side of my mouth for about three days. It hurts when I chew.";

type VoiceAuditionResponse =
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

export function VoiceAuditionClient() {
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [speed, setSpeed] = useState(0.9);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesByVoiceId, setNotesByVoiceId] = useState<Record<string, string>>(
    {},
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const voiceGroups = useMemo(
    () => [
      { label: "Male", voices: getKokoroVoicesByGender("male") },
      { label: "Female", voices: getKokoroVoicesByGender("female") },
    ],
    [],
  );

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

    setPlayingVoiceId(null);
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoadingVoiceId(null);
    cleanupAudio();
  }, [cleanupAudio]);

  const playVoice = useCallback(
    async (voiceId: string) => {
      const text = sampleText.trim();

      if (!text) {
        setErrorMessage("Enter sample text before playing a voice.");
        return;
      }

      stop();
      setErrorMessage(null);
      setLoadingVoiceId(voiceId);

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/dev/voice-audition", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            voiceId,
            speed,
          }),
          signal: controller.signal,
        });
        const data = (await response
          .json()
          .catch(() => undefined)) as VoiceAuditionResponse | undefined;

        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        if (!data) {
          throw new Error(`Could not generate ${voiceId}: invalid_response`);
        }

        if (!response.ok) {
          const reason = data.success
            ? "unknown_error"
            : (data.reason ?? data.error ?? "unknown_error");
          throw new Error(`Could not generate ${voiceId}: ${reason}`);
        }

        if (!data.success) {
          const reason = data.reason ?? data.error ?? "unknown_error";
          throw new Error(`Could not generate ${voiceId}: ${reason}`);
        }

        const audioBlob = new Blob([base64ToUint8Array(data.audioBase64)], {
          type: data.mimeType || "audio/mpeg",
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audioUrlRef.current = audioUrl;
        audioRef.current = audio;
        setLoadingVoiceId(null);

        audio.onplaying = () => {
          if (requestIdRef.current === requestId) {
            setPlayingVoiceId(voiceId);
          }
        };

        audio.onended = () => {
          if (requestIdRef.current === requestId) {
            cleanupAudio();
          }
        };

        audio.onerror = () => {
          if (requestIdRef.current === requestId) {
            setErrorMessage(`Could not play audio for ${voiceId}.`);
            cleanupAudio();
          }
        };

        await audio.play();
      } catch (error) {
        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setLoadingVoiceId(null);
        cleanupAudio();
        setErrorMessage(
          error instanceof Error
            ? error.message
            : `Could not generate ${voiceId}.`,
        );
      } finally {
        if (requestIdRef.current === requestId) {
          abortControllerRef.current = null;
        }
      }
    },
    [cleanupAudio, sampleText, speed, stop],
  );

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-5 py-8 text-[var(--color-foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-muted-foreground)] uppercase">
            Developer tool
          </p>
          <h1 className="text-2xl font-semibold">Kokoro Voice Audition</h1>
          <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            Try approved local voice IDs against Navigator/Kokoro. This page is
            hidden from navigation and unavailable in production builds.
          </p>
        </header>

        <section className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="grid gap-2 text-sm font-medium">
            Sample text
            <textarea
              value={sampleText}
              onChange={(event) => setSampleText(event.target.value)}
              maxLength={500}
              rows={4}
              className="min-h-28 resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-primary)]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_7rem] sm:items-end">
            <label className="grid gap-2 text-sm font-medium">
              Speed: {speed.toFixed(2)}
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.01"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="w-full"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Value
              <input
                type="number"
                min="0.7"
                max="1.3"
                step="0.01"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm font-normal outline-none focus:border-[var(--color-primary)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button
              type="button"
              variant="outline"
              onClick={stop}
              disabled={!loadingVoiceId && !playingVoiceId}
            >
              <Square className="size-4" />
              Stop
            </Button>
            <span className="text-[var(--color-muted-foreground)]">
              Playing: {playingVoiceId ?? "none"}
            </span>
            {loadingVoiceId ? (
              <span className="text-[var(--color-muted-foreground)]">
                Generating: {loadingVoiceId}
              </span>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-3 py-2 text-sm text-[var(--color-destructive)]">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {voiceGroups.map((group) => (
            <section key={group.label} className="grid gap-3">
              <h2 className="text-lg font-semibold">{group.label}</h2>
              <div className="grid gap-2">
                {group.voices.map((voice) => (
                  <VoiceRow
                    key={voice.voiceId}
                    voice={voice}
                    isLoading={loadingVoiceId === voice.voiceId}
                    isPlaying={playingVoiceId === voice.voiceId}
                    note={notesByVoiceId[voice.voiceId] ?? ""}
                    onNoteChange={(note) =>
                      setNotesByVoiceId((currentNotes) => ({
                        ...currentNotes,
                        [voice.voiceId]: note,
                      }))
                    }
                    onPlay={() => void playVoice(voice.voiceId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

type VoiceRowProps = {
  voice: KokoroVoiceCatalogEntry;
  isLoading: boolean;
  isPlaying: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onPlay: () => void;
};

function VoiceRow({
  voice,
  isLoading,
  isPlaying,
  note,
  onNoteChange,
  onPlay,
}: VoiceRowProps) {
  return (
    <div
      className={`grid gap-3 rounded-lg border p-3 ${
        isPlaying
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{voice.voiceId}</p>
          {voice.notes ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {voice.notes}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={onPlay} disabled={isLoading}>
          <Play className="size-4" />
          {isLoading ? "Loading" : "Play"}
        </Button>
      </div>
      <label className="grid gap-1 text-xs font-medium text-[var(--color-muted-foreground)]">
        Local note
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Optional listening note"
          className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm font-normal text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
        />
      </label>
    </div>
  );
}

function base64ToUint8Array(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}
