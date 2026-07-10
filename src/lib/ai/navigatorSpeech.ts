import "server-only";

const DEFAULT_NAVIGATOR_BASE = "https://api.ai.it.ufl.edu";
const DEFAULT_TTS_MODEL = "kokoro";
const DEFAULT_TTS_VOICE = "af_heart";
const DEFAULT_TTS_SPEED = 1;
const DEFAULT_TTS_TIMEOUT_MS = 60_000;

export type NavigatorSpeechErrorReason =
  | "key_model_access_denied"
  | "model_not_found"
  | "model_not_available"
  | "timeout"
  | "invalid_upstream_response"
  | "request_failed";

export class NavigatorSpeechError extends Error {
  reason: NavigatorSpeechErrorReason;
  status?: number;

  constructor(
    reason: NavigatorSpeechErrorReason,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "NavigatorSpeechError";
    this.reason = reason;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

export type NavigatorSpeechRequest = {
  text: string;
  voiceId: string;
  speed: number;
};

export type NavigatorSpeechAudio = {
  audioBase64: string;
  mimeType: string;
};

export function getDefaultNavigatorVoice() {
  return process.env.NAVIGATOR_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE;
}

export function getDefaultNavigatorSpeed() {
  return parsePositiveNumber(
    process.env.NAVIGATOR_TTS_SPEED,
    DEFAULT_TTS_SPEED,
  );
}

export async function createNavigatorSpeechAudio({
  text,
  voiceId,
  speed,
}: NavigatorSpeechRequest): Promise<NavigatorSpeechAudio> {
  const apiKey = process.env.NAVIGATOR_API_KEY?.trim();
  const input = text.trim();

  if (!apiKey) {
    throw new NavigatorSpeechError(
      "request_failed",
      "Navigator TTS is not configured.",
      { status: 503 },
    );
  }

  if (!input) {
    throw new NavigatorSpeechError(
      "invalid_upstream_response",
      "Speech text is required.",
      { status: 400 },
    );
  }

  const baseUrl = (
    process.env.NAVIGATOR_BASE?.trim() || DEFAULT_NAVIGATOR_BASE
  ).replace(/\/+$/, "");
  const model = process.env.NAVIGATOR_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const timeoutMs = parsePositiveNumber(
    process.env.NAVIGATOR_TTS_TIMEOUT_MS,
    DEFAULT_TTS_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        voice: voiceId,
        response_format: "mp3",
        speed,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await safeReadText(response);
      throw new NavigatorSpeechError(
        normalizeNavigatorSpeechReason(response.status, responseText),
        `Navigator TTS request failed with status ${response.status}.`,
        { status: response.status },
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length === 0) {
      throw new NavigatorSpeechError(
        "invalid_upstream_response",
        "Navigator TTS returned empty audio.",
        { status: 502 },
      );
    }

    return {
      audioBase64: buffer.toString("base64"),
      mimeType: response.headers.get("content-type") || "audio/mpeg",
    };
  } catch (error) {
    if (error instanceof NavigatorSpeechError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new NavigatorSpeechError("timeout", "Navigator TTS timed out.", {
        status: 504,
        cause: error,
      });
    }

    throw new NavigatorSpeechError(
      "request_failed",
      "Navigator TTS request failed.",
      { status: 502, cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function normalizeNavigatorSpeechReason(
  status: number,
  responseText: string,
): NavigatorSpeechErrorReason {
  const normalizedText = responseText.toLowerCase();

  if (normalizedText.includes("key_model_access_denied")) {
    return "key_model_access_denied";
  }

  if (normalizedText.includes("model_not_found")) {
    return "model_not_found";
  }

  if (normalizedText.includes("model_not_available")) {
    return "model_not_available";
  }

  if (status === 404) {
    return "model_not_found";
  }

  if (status === 408 || status === 504) {
    return "timeout";
  }

  return "request_failed";
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
