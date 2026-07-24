import "server-only";

import type { ConversationMessage } from "@/lib/conversationEngine";

export type ConversationChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationGatewayRequest = {
  encounterId: string;
  caseId: string;
  requestId: string;
  studentMessageId: string;
  conversation: ConversationMessage[];
  coveredChecklistItems: string[];
  message: string;
};

export type ConversationGatewayInput = ConversationGatewayRequest & {
  systemPrompt: string;
  messages: ConversationChatMessage[];
};

export type ConversationGatewayOutput = {
  success: true;
  provider: string;
  response: string;
  encounterId: string;
  requestId: string;
  patientMessageId: string;
  selectedQuestionId?: string;
  patientQuestionStateVersion: number;
};

export type AIProviderResponse = {
  text: string;
  diagnostics?: {
    provider: string;
    status?: number;
    contentType?: string;
  };
};

export type AITextGenerationInput = {
  systemPrompt: string;
  messages: ConversationChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
};

export interface AIProvider {
  name: string;
  generateText(input: AITextGenerationInput): Promise<AIProviderResponse>;
  generateConversationResponse(
    input: ConversationGatewayInput,
  ): Promise<AIProviderResponse>;
}
