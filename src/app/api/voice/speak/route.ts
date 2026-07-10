import { loadCase, type CaseData } from "@/data/cases";
import {
  createNavigatorSpeechAudio,
  getDefaultNavigatorSpeed,
  getDefaultNavigatorVoice,
  NavigatorSpeechError,
} from "@/lib/ai/navigatorSpeech";

export const runtime = "nodejs";

type VoiceRequestBody = {
  caseId?: unknown;
  text?: unknown;
};

type ResolvedVoicePreference = {
  voiceId: string;
  speed: number;
};

const MAX_TTS_TEXT_LENGTH = 1_200;

export async function POST(request: Request) {
  let body: VoiceRequestBody;

  try {
    body = (await request.json()) as VoiceRequestBody;
  } catch {
    return Response.json(
      { success: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!caseId || !text) {
    return Response.json(
      { success: false, error: "caseId_and_text_required" },
      { status: 400 },
    );
  }

  const patientCase = loadCase(caseId);

  if (!patientCase) {
    return Response.json(
      { success: false, error: "case_not_found" },
      { status: 404 },
    );
  }

  const voicePreference = resolveVoicePreference(patientCase);

  try {
    const audio = await createNavigatorSpeechAudio({
      text: text.slice(0, MAX_TTS_TEXT_LENGTH),
      voiceId: voicePreference.voiceId,
      speed: voicePreference.speed,
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

function resolveVoicePreference(caseData: CaseData): ResolvedVoicePreference {
  const defaultVoiceId = getDefaultNavigatorVoice();
  const defaultSpeed = getDefaultNavigatorSpeed();
  const caseVoicePreference = caseData.voicePreference;

  if (caseVoicePreference?.provider !== "navigator") {
    return {
      voiceId: defaultVoiceId,
      speed: defaultSpeed,
    };
  }

  return {
    voiceId: caseVoicePreference.voiceId.trim() || defaultVoiceId,
    speed:
      typeof caseVoicePreference.speed === "number" &&
      Number.isFinite(caseVoicePreference.speed) &&
      caseVoicePreference.speed > 0
        ? caseVoicePreference.speed
        : defaultSpeed,
  };
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
