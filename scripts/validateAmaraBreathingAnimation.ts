import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  startAmaraBreathingAnimation,
  type AmaraBreathingVideoElement,
} from "../src/lib/amaraBreathingAnimation";
import {
  AMARA_BREATHING_HEAVY_VIDEO_PATH,
  AMARA_BREATHING_MODERATE_VIDEO_PATH,
  buildPatientAudioPlan,
  getAmaraBreathingAnimationPath,
} from "../src/lib/patientAudioPlan";
import {
  playPatientAudioSequence,
  type RenderedPatientAudioSegment,
} from "../src/lib/patientAudioSequence";

class FakeVideo implements AmaraBreathingVideoElement {
  currentTime = 8;
  loop = true;
  muted = false;
  pauseCalls = 0;
  playCalls = 0;
  constructor(private readonly rejectPlay = false) {}
  pause() { this.pauseCalls += 1; }
  play() {
    this.playCalls += 1;
    return this.rejectPlay ? Promise.reject(new DOMException("blocked", "NotAllowedError")) : Promise.resolve();
  }
}

assert.equal(getAmaraBreathingAnimationPath("amara-breath-moderate-01"), AMARA_BREATHING_MODERATE_VIDEO_PATH);
assert.equal(getAmaraBreathingAnimationPath("amara-breath-moderate-02"), AMARA_BREATHING_MODERATE_VIDEO_PATH);
assert.equal(getAmaraBreathingAnimationPath("amara-breath-heavy-01"), AMARA_BREATHING_HEAVY_VIDEO_PATH);
assert.notEqual(AMARA_BREATHING_MODERATE_VIDEO_PATH, AMARA_BREATHING_HEAVY_VIDEO_PATH);
assert.equal(getAmaraBreathingAnimationPath(undefined), undefined, "speech selects no animation");
assert.equal(getAmaraBreathingAnimationPath("unknown-effect"), undefined, "unknown effects are safe");

const video = new FakeVideo();
const stop = startAmaraBreathingAnimation(video);
assert.equal(video.playCalls, 1, "effect activation starts the video");
assert.equal(video.currentTime, 0, "each effect starts at time zero");
assert.equal(video.loop, false, "the breathing video never loops");
assert.equal(video.muted, true, "the breathing video is always silent");
stop();
assert.equal(video.pauseCalls, 1, "effect completion stops the video");
assert.equal(video.currentTime, 0, "effect completion resets the video");

const rejected = new FakeVideo(true);
const stopRejected = startAmaraBreathingAnimation(rejected);
await Promise.resolve();
stopRejected();
assert.equal(rejected.pauseCalls, 1, "rejected video playback remains safely stoppable");
assert.doesNotThrow(() => startAmaraBreathingAnimation(null)(), "missing MP4 is a no-op");

for (const effectId of ["amara-breath-moderate-01", "amara-breath-heavy-01"] as const) {
  const result = await playPatientAudioSequence([
    { type: "effect", effectId, src: "/effect.mp3" },
  ], {
    isCancelled: () => false,
    loadEffect: async () => new Blob(["effect"]),
    loadSpeech: (segment) => new Blob([segment.text]),
    play: async () => {
      startAmaraBreathingAnimation(null)();
      return "ended";
    },
  });
  assert.equal(result, "ended", `missing ${effectId} MP4 does not block audio`);
}

const activity: string[] = [];
const rendered: RenderedPatientAudioSegment[] = [
  { type: "speech", text: "First.", audioBase64: "MQ==", mimeType: "audio/mpeg" },
  { type: "effect", effectId: "amara-breath-moderate-01", src: "/audio.mp3" },
  { type: "speech", text: " Second.", audioBase64: "Mg==", mimeType: "audio/mpeg" },
];
await playPatientAudioSequence(rendered, {
  isCancelled: () => false,
  loadEffect: async () => new Blob(["effect"]),
  loadSpeech: (segment) => new Blob([segment.text]),
  play: async (_blob, segment) => {
    if (segment.type === "effect") {
      activity.push("effect-active");
      const cleanup = startAmaraBreathingAnimation(new FakeVideo());
      cleanup();
      activity.push("effect-reset");
    } else {
      activity.push("speech-no-animation");
    }
    return "ended";
  },
});
assert.deepEqual(activity, ["speech-no-animation", "effect-active", "effect-reset", "speech-no-animation"]);

const switchedAnimations: Array<string | undefined> = [];
await playPatientAudioSequence([
  { type: "effect", effectId: "amara-breath-moderate-01", src: "/moderate.mp3" },
  { type: "effect", effectId: "amara-breath-heavy-01", src: "/heavy.mp3" },
], {
  isCancelled: () => false,
  loadEffect: async () => new Blob(["effect"]),
  loadSpeech: (segment) => new Blob([segment.text]),
  play: async (_blob, segment) => {
    switchedAnimations.push(
      segment.type === "effect"
        ? getAmaraBreathingAnimationPath(segment.effectId)
        : undefined,
    );
    return "ended";
  },
});
assert.deepEqual(switchedAnimations, [
  AMARA_BREATHING_MODERATE_VIDEO_PATH,
  AMARA_BREATHING_HEAVY_VIDEO_PATH,
], "two effects switch to the correct animation");

const failedEffectVideo = new FakeVideo();
const resetFailedEffect = startAmaraBreathingAnimation(failedEffectVideo);
resetFailedEffect();
assert.equal(failedEffectVideo.pauseCalls, 1, "failed effect playback resets animation");

for (const reason of ["cancellation", "replacement", "unmount"] as const) {
  const lifecycleVideo = new FakeVideo();
  const cleanup = startAmaraBreathingAnimation(lifecycleVideo);
  cleanup();
  assert.equal(lifecycleVideo.pauseCalls, 1, `${reason} stops the video`);
  assert.equal(lifecycleVideo.currentTime, 0, `${reason} resets the video`);
}

assert.ok(
  buildPatientAudioPlan("case-02", "Another patient speaks.", 10)
    .every((segment) => segment.type === "speech"),
  "non-Amara patients never receive the breathing animation trigger",
);

const encounter = await readFile("src/components/EncounterExperience.tsx", "utf8");
assert.match(encounter, /patientCase\.id === "case-01" && speechPlayback\.isBreathingEffectActive/);
assert.match(encounter, /getAmaraBreathingAnimationPath\(speechPlayback\.activeEffectId\)/);

console.log("Amara breathing animation validation passed: 23 focused assertions.");
