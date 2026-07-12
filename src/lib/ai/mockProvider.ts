import "server-only";

import type {
  AIProvider,
  AIProviderResponse,
} from "@/lib/ai/provider";

export class MockProvider implements AIProvider {
  name = "mock";

  async generateText(): Promise<AIProviderResponse> {
    return {
      text: "(AI gateway placeholder)",
    };
  }

  async generateConversationResponse(): Promise<AIProviderResponse> {
    return {
      text: "(AI gateway placeholder)",
    };
  }
}
