import {
  createNavigatorSpeechAudio,
  NavigatorSpeechError,
} from "@/lib/ai/navigatorSpeech";
import { isKnownKokoroVoiceId } from "@/lib/voiceCatalog";

export const runtime = "nodejs";

type VoiceAuditionRequestBody = {
  text?: unknown;
  voiceId?: unknown;
  speed?: unknown;
};

const MAX_AUDITION_TEXT_LENGTH = 500;
const MIN_AUDITION_SPEED = 0.7;
const MAX_AUDITION_SPEED = 1.3;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ success: false, error: "not_found" }, { status: 404 });
  }

  let body: VoiceAuditionRequestBody;

  try {
    body = (await request.json()) as VoiceAuditionRequestBody;
  } catch {
    return Response.json(
      { success: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  const speed = typeof body.speed === "number" ? body.speed : Number.NaN;

  if (!text || text.length > MAX_AUDITION_TEXT_LENGTH) {
    return Response.json(
      {
        success: false,
        error: "invalid_text",
        maxLength: MAX_AUDITION_TEXT_LENGTH,
      },
      { status: 400 },
    );
  }

  if (!voiceId || !isKnownKokoroVoiceId(voiceId)) {
    return Response.json(
      { success: false, error: "invalid_voice" },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(speed) ||
    speed < MIN_AUDITION_SPEED ||
    speed > MAX_AUDITION_SPEED
  ) {
    return Response.json(
      {
        success: false,
        error: "invalid_speed",
        min: MIN_AUDITION_SPEED,
        max: MAX_AUDITION_SPEED,
      },
      { status: 400 },
    );
  }

  try {
    const audio = await createNavigatorSpeechAudio({
      text,
      voiceId,
      speed,
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
