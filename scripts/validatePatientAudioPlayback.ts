import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PatientAudioPlaybackController,
  type PatientAudioElement,
} from "../src/lib/patientAudioPlaybackController";
import { playPatientAudioSequence } from "../src/lib/patientAudioSequence";

async function testPrimeAndPersistentReuse() {
  const harness = createHarness();
  harness.controller.primeFromGesture();
  await flush();
  assert.equal(harness.createdAudioCount, 1, "microphone gesture creates one persistent audio element");
  assert.equal(harness.audio.playCalls, 1, "microphone gesture primes playback synchronously");

  await harness.controller.playGeneratedAudio(new Blob(["voice-response"]));
  assert.equal(harness.createdAudioCount, 1, "delayed voice TTS reuses the primed element");
  assert.equal(harness.audio.playCalls, 2, "delayed voice TTS plays once");
}

async function testTypedPlayback() {
  const harness = createHarness();
  harness.controller.primeFromGesture();
  await flush();
  const result = await harness.controller.playGeneratedAudio(new Blob(["typed-response"]));
  assert.equal(result, "playing");
  assert.equal(harness.createdAudioCount, 1, "typed submission keeps one audio element");
  assert.equal(harness.urlsCreated.length, 1, "typed response creates one object URL");
}

async function testBlockedRetryWithoutRegeneration() {
  const notAllowed = new DOMException("User activation required", "NotAllowedError");
  const harness = createHarness([resolvePlay, () => Promise.reject(notAllowed), resolvePlay]);
  harness.controller.primeFromGesture();
  await flush();
  const blocked = await harness.controller.playGeneratedAudio(new Blob(["blocked-response"]));
  assert.equal(blocked, "blocked");
  assert.equal(harness.retryRequired, 1);
  assert.equal(harness.urlsRevoked.length, 0, "blocked audio URL remains available");

  const retried = await harness.controller.retryFromGesture();
  assert.equal(retried, "playing");
  assert.equal(harness.urlsCreated.length, 1, "retry does not create a second TTS audio payload");
  assert.equal(harness.audio.playCalls, 3, "retry plays the exact retained audio once");
}

async function testAnimationFollowsPlaybackEvents() {
  const harness = createHarness();
  await harness.controller.playGeneratedAudio(new Blob(["response"]));
  assert.equal(harness.started, 0, "play promise alone does not start animation");
  harness.audio.emit("playing");
  assert.equal(harness.started, 1, "playing event starts animation");
  harness.audio.emit("ended");
  assert.equal(harness.stopReasons.at(-1), "ended");
}

async function testStopPathsAndCleanup() {
  const rejection = createHarness([() => Promise.reject(new Error("decode failed"))]);
  assert.equal(await rejection.controller.playGeneratedAudio(new Blob(["bad"])), "failed");
  assert.equal(rejection.stopReasons.at(-1), "rejected");
  assert.equal(rejection.urlsRevoked.length, 1);

  for (const event of ["error", "ended"] as const) {
    const harness = createHarness();
    await harness.controller.playGeneratedAudio(new Blob([event]));
    harness.audio.emit("playing");
    harness.audio.emit(event);
    assert.equal(harness.stopReasons.at(-1), event);
    assert.equal(harness.urlsRevoked.length, 1, `${event} releases the object URL`);
  }

  const cancelled = createHarness();
  await cancelled.controller.playGeneratedAudio(new Blob(["cancel"]));
  cancelled.controller.cancel("test-cancel");
  assert.equal(cancelled.stopReasons.at(-1), "test-cancel");
  assert.equal(cancelled.urlsRevoked.length, 1);

  const dismissed = createHarness([() => Promise.reject(new DOMException("blocked", "NotAllowedError"))]);
  await dismissed.controller.playGeneratedAudio(new Blob(["dismiss"]));
  dismissed.controller.dismissRetry();
  assert.equal(dismissed.urlsRevoked.length, 1, "final dismissal releases retained audio");
}

async function testReplacementHasNoDuplicateElementOrUrl() {
  const harness = createHarness();
  await harness.controller.playGeneratedAudio(new Blob(["first"]));
  await harness.controller.playGeneratedAudio(new Blob(["second"]));
  assert.equal(harness.createdAudioCount, 1);
  assert.equal(harness.urlsCreated.length, 2);
  assert.equal(harness.urlsRevoked[0], harness.urlsCreated[0]);
  harness.controller.dispose();
  assert.equal(harness.urlsRevoked.length, 2, "cleanup releases the final URL");
}

async function testSerialCompletionUsesOneElement() {
  const harness = createHarness();
  const played: string[] = [];
  for (const label of ["effect", "speech-one", "effect-two", "speech-two"]) {
    const completion = harness.controller.playToCompletion(new Blob([label]));
    await flush();
    played.push(label);
    harness.audio.emit("ended");
    assert.equal(await completion, "ended");
  }
  assert.deepEqual(played, ["effect", "speech-one", "effect-two", "speech-two"]);
  assert.equal(harness.createdAudioCount, 1, "the complete sequence reuses one audio element");
}

async function testSequenceRetryAndCancellation() {
  const blockedError = new DOMException("blocked", "NotAllowedError");
  const blocked = createHarness([() => Promise.reject(blockedError), resolvePlay]);
  const completion = blocked.controller.playToCompletion(new Blob(["effect"]));
  await flush();
  assert.equal(blocked.retryRequired, 1);
  assert.equal(blocked.urlsCreated.length, 1, "blocked segment is generated only once");
  assert.equal(await blocked.controller.retryFromGesture(), "playing");
  blocked.audio.emit("ended");
  assert.equal(await completion, "ended");
  assert.equal(blocked.urlsCreated.length, 1, "retry does not duplicate the completed segment");

  const cancelled = createHarness();
  const cancelledCompletion = cancelled.controller.playToCompletion(new Blob(["sequence"]));
  await flush();
  cancelled.controller.cancel("replacement");
  assert.equal(await cancelledCompletion, "cancelled");
}

async function testPlanExecutionOrderAndEffectFailure() {
  const calls: string[] = [];
  const segments = [
    { type: "effect" as const, effectId: "broken", src: "/broken.mp3" },
    { type: "speech" as const, text: "First.", audioBase64: "MQ==", mimeType: "audio/mpeg" },
    { type: "effect" as const, effectId: "working", src: "/working.mp3" },
    { type: "speech" as const, text: " Second.", audioBase64: "Mg==", mimeType: "audio/mpeg" },
  ];
  const result = await playPatientAudioSequence(segments, {
    isCancelled: () => false,
    loadEffect: async (segment) => {
      calls.push(`effect:${segment.effectId}`);
      if (segment.effectId === "broken") throw new Error("missing asset");
      return new Blob([segment.effectId]);
    },
    loadSpeech: (segment) => {
      calls.push(`speech:${segment.text}`);
      return new Blob([segment.text]);
    },
    play: async () => { calls.push("play"); return "ended"; },
  });
  assert.equal(result, "ended");
  assert.deepEqual(calls, [
    "effect:broken",
    "speech:First.", "play",
    "effect:working", "play",
    "speech: Second.", "play",
  ], "effect failure continues to speech while successful segments stay ordered");
}

async function testAuthoritativeListeningStateWiring() {
  const recognition = await readFile("src/hooks/useSpeechRecognition.ts", "utf8");
  const encounter = await readFile("src/components/EncounterExperience.tsx", "utf8");
  assert.match(recognition, /isListeningRef\.current = false;/);
  assert.match(recognition, /isListeningNow: \(\) => isListeningRef\.current/);
  assert.match(encounter, /isListening: speechRecognition\.isListeningNow\(\)/);
  assert.match(encounter, /speechPlayback\.primePlayback\(\);[\s\S]{0,500}speechRecognition\.toggleListening\(\)/);
}

function createHarness(playPlan: Array<() => Promise<void>> = []): HarnessShape {
  const audio = new FakeAudio(playPlan);
  const urlsCreated: string[] = [];
  const urlsRevoked: string[] = [];
  const stopReasons: string[] = [];
  let createdAudioCount = 0;
  let started = 0;
  let retryRequired = 0;
  const controller = new PatientAudioPlaybackController({
    createAudio: () => { createdAudioCount += 1; return audio; },
    createObjectUrl: () => { const url = `blob:test-${urlsCreated.length + 1}`; urlsCreated.push(url); return url; },
    revokeObjectUrl: (url) => urlsRevoked.push(url),
    onPlaybackStarted: () => { started += 1; },
    onPlaybackStopped: (reason) => stopReasons.push(reason),
    onRetryRequired: () => { retryRequired += 1; },
    onRetryCleared: () => undefined,
  });
  return {
    audio,
    controller,
    urlsCreated,
    urlsRevoked,
    stopReasons,
    get createdAudioCount() { return createdAudioCount; },
    get started() { return started; },
    get retryRequired() { return retryRequired; },
  };
}

type HarnessShape = {
  audio: FakeAudio;
  controller: PatientAudioPlaybackController;
  urlsCreated: string[];
  urlsRevoked: string[];
  stopReasons: string[];
  readonly createdAudioCount: number;
  readonly started: number;
  readonly retryRequired: number;
};

class FakeAudio implements PatientAudioElement {
  public src = "";
  public preload = "";
  public error: { code: number } | null = null;
  public playCalls = 0;
  private readonly listeners = new Map<string, Set<() => void>>();

  public constructor(private readonly playPlan: Array<() => Promise<void>>) {}
  public addEventListener(type: string, listener: () => void) { this.listenerSet(type).add(listener); }
  public removeEventListener(type: string, listener: () => void) { this.listenerSet(type).delete(listener); }
  public load() {}
  public pause() { this.emit("pause"); }
  public play() { this.playCalls += 1; return (this.playPlan.shift() ?? resolvePlay)(); }
  public removeAttribute(name: string) { if (name === "src") this.src = ""; }
  public emit(type: string) { this.listenerSet(type).forEach((listener) => listener()); }
  private listenerSet(type: string) {
    const existing = this.listeners.get(type);
    if (existing) return existing;
    const created = new Set<() => void>();
    this.listeners.set(type, created);
    return created;
  }
}

function resolvePlay() { return Promise.resolve(); }
function flush() { return new Promise<void>((resolve) => setTimeout(resolve, 0)); }

await testPrimeAndPersistentReuse();
await testTypedPlayback();
await testBlockedRetryWithoutRegeneration();
await testAnimationFollowsPlaybackEvents();
await testStopPathsAndCleanup();
await testReplacementHasNoDuplicateElementOrUrl();
await testSerialCompletionUsesOneElement();
await testSequenceRetryAndCancellation();
await testPlanExecutionOrderAndEffectFailure();
await testAuthoritativeListeningStateWiring();

console.log("Patient audio playback validation passed: 10 focused scenarios.");
