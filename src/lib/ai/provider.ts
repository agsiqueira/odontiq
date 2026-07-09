import "server-only";

import type { ConversationMessage } from "@/lib/conversationEngine";

export type ConversationGatewayInput = {
  encounterId: string;
  caseId: string;
  conversation: ConversationMessage[];
  coveredChecklistItems: string[];
  message: string;
};

export type ConversationGatewayOutput = {
  success: true;
  provider: string;
  response: string;
  encounterId: string;
};

export type AIProviderResponse = {
  text: string;
};

export interface AIProvider {
  name: string;
  generateConversationResponse(
    input: ConversationGatewayInput,
  ): Promise<AIProviderResponse>;
}
