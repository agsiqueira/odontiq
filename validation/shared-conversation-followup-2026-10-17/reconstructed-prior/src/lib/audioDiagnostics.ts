"use client";

export const AUDIO_DIAGNOSTIC_LIMIT = 200;

export type AudioDiagnosticValue = string | number | boolean | null;

export type AudioDiagnosticEvent = {
  timestamp: string;
  event: string;
  details?: Record<string, AudioDiagnosticValue>;
};

type Listener = () => void;

let events: AudioDiagnosticEvent[] = [];
const listeners = new Set<Listener>();

export function isAudioDebugEnabled(): boolean {
  return typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debugAudio") === "1";
}

export function emitAudioDiagnostic(
  event: string,
  details?: Record<string, unknown>,
): void {
  if (!isAudioDebugEnabled()) return;

  events = appendAudioDiagnosticEvent(events, {
    timestamp: new Date().toISOString(),
    event: normalizeEventName(event),
    details: sanitizeAudioDiagnosticDetails(details),
  });
  listeners.forEach((listener) => listener());
}

export function getAudioDiagnosticEvents(): readonly AudioDiagnosticEvent[] {
  return events;
}

export function subscribeAudioDiagnostics(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearAudioDiagnostics(): void {
  if (!isAudioDebugEnabled()) return;
  events = [];
  listeners.forEach((listener) => listener());
}

export function appendAudioDiagnosticEvent(
  currentEvents: readonly AudioDiagnosticEvent[],
  nextEvent: AudioDiagnosticEvent,
): AudioDiagnosticEvent[] {
  return [...currentEvents, nextEvent].slice(-AUDIO_DIAGNOSTIC_LIMIT);
}

export function sanitizeAudioDiagnosticDetails(
  details?: Record<string, unknown>,
): Record<string, AudioDiagnosticValue> | undefined {
  if (!details) return undefined;

  const safeDetails: Record<string, AudioDiagnosticValue> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!/length$/i.test(key) && /text|transcript|message|patient|content|audioBase64/i.test(key)) continue;
    if (typeof value === "string") safeDetails[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safeDetails[key] = value;
  }

  return Object.keys(safeDetails).length > 0 ? safeDetails : undefined;
}

export function currentAudioContextState(): string {
  if (typeof window === "undefined") return "unavailable";
  return "AudioContext" in window || "webkitAudioContext" in window
    ? "available-not-instantiated"
    : "unavailable";
}

function normalizeEventName(event: string): string {
  return event.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").slice(0, 64) || "unknown";
}
