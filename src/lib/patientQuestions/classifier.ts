import type { AIProvider } from "@/lib/ai/provider";
import type { ConversationMessage } from "@/lib/conversationEngine";
import { buildPatientQuestionClassifierPrompt } from "./prompt";
import { parsePatientQuestionClassification } from "./schema";
import type { PatientQuestionState } from "./types";

export async function classifyPatientQuestionTrigger(input: {
  provider: AIProvider;
  caseId: string;
  studentMessageId: string;
  studentMessage: string;
  draftPatientMessageId: string;
  draftPatientResponse: string;
  conversation: readonly ConversationMessage[];
  state: PatientQuestionState;
}) {
  const prompt = buildPatientQuestionClassifierPrompt(input);
  try {
    const result = await input.provider.generateText({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: prompt.userPrompt }],
      temperature: 0,
      maxTokens: 450,
    });
    return parsePatientQuestionClassification({
      text: result.text,
      caseId: input.caseId,
      studentMessageId: input.studentMessageId,
      validMessageIds: prompt.validMessageIds,
    });
  } catch {
    return undefined;
  }
}
