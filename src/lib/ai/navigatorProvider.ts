import "server-only";

import type {
  AIProvider,
  AIProviderResponse,
  AITextGenerationInput,
  ConversationGatewayInput,
} from "@/lib/ai/provider";

const NAVIGATOR_TIMEOUT_MS = 30_000;
const DEFAULT_NAVIGATOR_BASE_URL = "https://api.ai.it.ufl.edu";

type NavigatorMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type NavigatorRequestBody = {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: NavigatorMessage[];
  stop?: string[];
};

export type NavigatorErrorCategory =
  | "missing-configuration"
  | "authentication"
  | "model-not-found"
  | "endpoint-not-found"
  | "rate-limit"
  | "timeout"
  | "network"
  | "invalid-response"
  | "unknown";

export class NavigatorProviderError extends Error {
  constructor(
    message: string,
    readonly category: NavigatorErrorCategory,
    readonly status?: number,
    readonly contentType?: string,
  ) {
    super(message);
    this.name = "NavigatorProviderError";
  }
}

export class NavigatorProvider implements AIProvider {
  name = "navigator";

  async generateText(input: AITextGenerationInput): Promise<AIProviderResponse> {
    const apiKey = getRequiredEnv("NAVIGATOR_API_KEY");
    const baseUrl = getNavigatorBaseUrl();
    const model = getRequiredEnv("NAVIGATOR_MODEL");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NAVIGATOR_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildNavigatorRequest(input, model)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new NavigatorProviderError(
          await getSafeProviderErrorMessage(response),
          classifyHttpStatus(response.status),
          response.status,
          response.headers.get("content-type") ?? undefined,
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new NavigatorProviderError(
          "Navigator returned an invalid JSON response",
          "invalid-response",
          response.status,
          response.headers.get("content-type") ?? undefined,
        );
      }
      const text = extractNavigatorText(data);

      if (!text) {
        throw new NavigatorProviderError(
          "Navigator response did not include text content",
          "invalid-response",
          response.status,
          response.headers.get("content-type") ?? undefined,
        );
      }

      return {
        text,
        diagnostics: {
          provider: this.name,
          status: response.status,
          contentType: response.headers.get("content-type") ?? undefined,
        },
      };
    } catch (error) {
      throw toSafeNavigatorError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateConversationResponse(
    input: ConversationGatewayInput,
  ): Promise<AIProviderResponse> {
    return this.generateText({
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      temperature: 0.4,
      maxTokens: 250,
      stop: ["\nuser", "\nUser", "\nassistant", "\nAssistant"],
    });
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new NavigatorProviderError(
      `${name} is required when AI_PROVIDER=navigator`,
      "missing-configuration",
    );
  }

  return value;
}

function getNavigatorBaseUrl(): string {
  return stripTrailingSlashes(
    process.env.NAVIGATOR_BASE ??
      process.env.NAVIGATOR_BASE_URL ??
      DEFAULT_NAVIGATOR_BASE_URL,
  );
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildNavigatorRequest(input: AITextGenerationInput, model: string): NavigatorRequestBody {
  return {
    model,
    temperature: input.temperature ?? 0.4,
    max_tokens: input.maxTokens ?? 250,
    stop: input.stop,
    messages: [
      {
        role: "system",
        content: input.systemPrompt,
      },
      ...input.messages,
    ],
  };
}

function extractNavigatorText(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  if (!Array.isArray(data.choices)) {
    return undefined;
  }

  const firstChoice: unknown = data.choices[0];

  if (!isRecord(firstChoice)) {
    return undefined;
  }

  if (!isRecord(firstChoice.message)) {
    return undefined;
  }

  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeNavigatorError(error: unknown): Error {
  if (error instanceof NavigatorProviderError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new NavigatorProviderError("Navigator request timed out", "timeout");
  }

  if (error instanceof Error) {
    const cause = error.cause as { code?: string } | undefined;
    if (
      error instanceof TypeError ||
      cause?.code === "EACCES" ||
      cause?.code === "ECONNREFUSED" ||
      cause?.code === "ENOTFOUND"
    ) {
      return new NavigatorProviderError("Navigator network request failed", "network");
    }
    return new NavigatorProviderError(error.message, "unknown");
  }

  return new NavigatorProviderError("Navigator request failed", "unknown");
}

function classifyHttpStatus(status: number): NavigatorErrorCategory {
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "endpoint-not-found";
  if (status === 429) return "rate-limit";
  return "unknown";
}

async function getSafeProviderErrorMessage(response: Response) {
  const fallback = `Navigator request failed with status ${response.status}`;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;

  try {
    const body = (await response.json()) as {
      error?: { message?: unknown; code?: unknown };
      message?: unknown;
    };
    const message = body.error?.message ?? body.message;
    const code = body.error?.code;
    if (typeof code === "string" && /model/i.test(code)) {
      return `Navigator model error: ${typeof message === "string" ? message.slice(0, 160) : code}`;
    }
    return typeof message === "string" ? message.slice(0, 160) : fallback;
  } catch {
    return fallback;
  }
}
