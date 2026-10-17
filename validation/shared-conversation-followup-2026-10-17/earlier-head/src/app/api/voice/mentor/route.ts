import {
  createNavigatorSpeechAudio,
  getDefaultNavigatorSpeed,
  NavigatorSpeechError,
} from "@/lib/ai/navigatorSpeech";

export const runtime = "nodejs";

type MentorVoiceRequestBody = {
  text?: unknown;
};

const MAX_TTS_TEXT_LENGTH = 900;
const DEFAULT_MENTOR_VOICE_ID = "am_adam";
const DEFAULT_MENTOR_SPEED = 1;

export async function POST(request: Request) {
  let body: MentorVoiceRequestBody;

  try {
    body = (await request.json()) as MentorVoiceRequestBody;
  } catch {
    return Response.json(
      { success: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return Response.json(
      { success: false, error: "text_required" },
      { status: 400 },
    );
  }

  try {
    const audio = await createNavigatorSpeechAudio({
      text: text.slice(0, MAX_TTS_TEXT_LENGTH),
      voiceId: getMentorVoiceId(),
      speed: getMentorVoiceSpeed(),
    });

    return Response.json({
      success: true,
      audioBase64: audio.audioBase64,
      mimeType: audio.mimeType,
    });
  } catch (error) {
    if (error instanceof NavigatorSpeechError) {
      return Response.json(
        {
          success: false,
          error: "navigator_tts_unavailable",
          reason: error.reason,
        },
        { status: statusForNavigatorSpeechError(error) },
      );
    }

    return Response.json(
      {
        success: false,
        error: "navigator_tts_unavailable",
        reason: "request_failed",
      },
      { status: 502 },
    );
  }
}

function getMentorVoiceId() {
  return process.env.NAVIGATOR_MENTOR_TTS_VOICE?.trim() || DEFAULT_MENTOR_VOICE_ID;
}

function getMentorVoiceSpeed() {
  const configuredSpeed = process.env.NAVIGATOR_MENTOR_TTS_SPEED;

  if (!configuredSpeed) {
    return DEFAULT_MENTOR_SPEED;
  }

  const parsedSpeed = Number(configuredSpeed);
  return Number.isFinite(parsedSpeed) && parsedSpeed > 0
    ? parsedSpeed
    : getDefaultNavigatorSpeed();
}

function statusForNavigatorSpeechError(error: NavigatorSpeechError) {
  if (error.reason === "timeout") {
    return 504;
  }

  if (error.reason === "invalid_upstream_response") {
    return 502;
  }

  return error.status && error.status >= 400 && error.status < 600
    ? error.status
    : 503;
}
