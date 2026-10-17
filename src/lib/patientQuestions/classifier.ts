import type { AIProvider } from "@/lib/ai/provider";
import type { ConversationMessage } from "@/lib/conversationEngine";
import { constrainQuestionClassification } from "./eligibility";
import { loadCase } from "../../data/cases";
import { buildPatientQuestionClassifierPrompt } from "./prompt";
import { parsePatientQuestionClassification } from "./schema";
import type { PatientQuestionState } from "./types";
import type { PatientQuestionClassificationResult } from "./types";

export async function classifyPatientQuestionTrigger(input: {
  provider: AIProvider;
  caseId: string;
  studentMessageId: string;
  studentMessage: string;
  draftPatientMessageId: string;
  draftPatientResponse: string;
  conversation: readonly ConversationMessage[];
  state: PatientQuestionState;
}): Promise<PatientQuestionClassificationResult> {
  const prompt = buildPatientQuestionClassifierPrompt(input);
  try {
    const result = await input.provider.generateText({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: prompt.userPrompt }],
      temperature: 0,
      maxTokens: 450,
    });
    const parsed = parsePatientQuestionClassification({
      text: result.text,
      caseId: input.caseId,
      studentMessageId: input.studentMessageId,
      allowedEvents: prompt.allowedEvents,
      evidenceAliases: prompt.evidenceAliases,
    });
    return parsed.success ? { success: true, classification: constrainQuestionClassification({
      classification: parsed.classification,
      studentMessage: input.studentMessage,
      patientResponse: input.draftPatientResponse,
      conversation: input.conversation,
      facts: loadCase(input.caseId)?.supportingInfo.patientFacts ?? [],
    }) } : parsed;
  } catch (error) {
    const safeProviderError =
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "NavigatorProviderError"
        ? error as { category?: unknown; status?: unknown }
        : undefined;
    return {
      success: false,
      reason: "provider-failure",
      ...(safeProviderError
        ? {
            safeMetadata: {
              ...(typeof safeProviderError.category === "string"
                ? { providerErrorCategory: safeProviderError.category }
                : {}),
              ...(typeof safeProviderError.status === "number"
                ? { providerStatus: safeProviderError.status }
                : {}),
            },
          }
        : {}),
    };
  }
}

