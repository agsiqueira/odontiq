import "server-only";

import type {
  AIProvider,
  AIProviderResponse,
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

export class NavigatorProvider implements AIProvider {
  name = "navigator";

  async generateConversationResponse(
    input: ConversationGatewayInput,
  ): Promise<AIProviderResponse> {
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
        throw new Error(
          `Navigator request failed with status ${response.status}`,
        );
      }

      const data: unknown = await response.json();
      const text = extractNavigatorText(data);

      if (!text) {
        throw new Error("Navigator response did not include text content");
      }

      return { text };
    } catch (error) {
      throw toSafeNavigatorError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required when AI_PROVIDER=navigator`);
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

function buildNavigatorRequest(
  input: ConversationGatewayInput,
  model: string,
): NavigatorRequestBody {
  return {
    model,
    temperature: 0.4,
    max_tokens: 250,
    stop: ["\nuser", "\nUser", "\nassistant", "\nAssistant"],
    messages: [
      {
        role: "system",
        content:
          "You are the odontIQ conversation gateway. Return only the patient response text for the current dental consultation turn.",
      },
      {
        role: "user",
        content: JSON.stringify({
          encounterId: input.encounterId,
          caseId: input.caseId,
          conversation: input.conversation,
          coveredChecklistItems: input.coveredChecklistItems,
          message: input.message,
        }),
      },
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
  if (error instanceof Error && error.name === "AbortError") {
    return new Error("Navigator request timed out");
  }

  if (error instanceof Error) {
    return new Error(error.message);
  }

  return new Error("Navigator request failed");
}
