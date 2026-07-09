import "server-only";

import type { AIProvider } from "@/lib/ai/provider";
import { MockProvider } from "@/lib/ai/mockProvider";
import { NavigatorProvider } from "@/lib/ai/navigatorProvider";

export function getAIProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER ?? "mock";

  switch (providerName) {
    case "mock":
      return new MockProvider();
    case "navigator":
      return new NavigatorProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${providerName}`);
  }
}

export type {
  AIProvider,
  ConversationGatewayInput,
  ConversationGatewayOutput,
} from "@/lib/ai/provider";
