import assert from "node:assert/strict";
import {
  AUDIO_DIAGNOSTIC_LIMIT,
  appendAudioDiagnosticEvent,
  sanitizeAudioDiagnosticDetails,
  type AudioDiagnosticEvent,
} from "../src/lib/audioDiagnostics";

const events = Array.from({ length: AUDIO_DIAGNOSTIC_LIMIT + 5 }, (_, index): AudioDiagnosticEvent => ({
  timestamp: `2026-08-05T00:00:${String(index).padStart(2, "0")}Z`,
  event: `event-${index}`,
})).reduce<AudioDiagnosticEvent[]>((current, event) => appendAudioDiagnosticEvent(current, event), []);

assert.equal(events.length, 200);
assert.equal(events[0]?.event, "event-5");
assert.equal(events.at(-1)?.event, "event-204");

assert.deepEqual(
  sanitizeAudioDiagnosticDetails({
    transcript: "sensitive spoken question",
    patientMessageId: "patient-secret",
    content: "sensitive response",
    transcriptLength: 25,
    responseId: "safe-short-id",
    isListening: true,
    nested: { unsafe: true },
  }),
  {
    transcriptLength: 25,
    responseId: "safe-short-id",
    isListening: true,
  },
);

assert.equal(
  sanitizeAudioDiagnosticDetails({ diagnosticIdentifier: "x".repeat(200) })?.diagnosticIdentifier,
  "x".repeat(120),
);

console.log("Audio diagnostics validation passed: 3 assertions.");
