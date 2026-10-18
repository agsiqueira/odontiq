import type { AIProvider } from "@/lib/ai/provider";
import type { ConversationMessage } from "@/lib/conversationEngine";
import { constrainQuestionClassification } from "./eligibility";
import { parseCase3Explanations } from "./explanationScope";
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
      ...(input.caseId === "case-03" && input.provider.name === "navigator"
        ? { model: process.env.NAVIGATOR_CASE3_CLASSIFIER_MODEL ?? "gpt-oss-120b" } : {}),
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: prompt.userPrompt }],
      temperature: 0,
      maxTokens: input.caseId === "case-03" ? 2048 : 450,
    });
    let triggerText = result.text;
    let explanationValue: unknown;
    if (input.caseId === "case-03") {
      const combined = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, ""));
      explanationValue = combined.explanations;
      delete combined.explanations;
      triggerText = JSON.stringify(combined);
    }
    const parsed = parsePatientQuestionClassification({
      text: triggerText,
      caseId: input.caseId,
      studentMessageId: input.studentMessageId,
      allowedEvents: prompt.allowedEvents,
      evidenceAliases: prompt.evidenceAliases,
    });
    if (input.caseId === "case-03") {
      const evidence = parseCase3Explanations(explanationValue, input.studentMessage, input.studentMessageId);
      if (!parsed.success) {
        // Independent, validated explanations are knowledge, not trigger evidence.
        // Preserve them with the final answer without allowing a failed trigger
        // decision to unlock or consume any question.
        return Object.keys(evidence).length ? { success: true, classification: {
          schemaVersion: 1, caseId: input.caseId, analyzedStudentMessageId: input.studentMessageId,
          confidence: 0, evidenceAliases: ["student-current"], evidenceMessageIds: [input.studentMessageId],
          detectedEvents: {}, case3Explanations: evidence, questionDecisionVerified: false,
        } } : parsed;
      }
      parsed.classification.case3Explanations = evidence;
      parsed.classification.detectedEvents.drainageTemporaryOrNondefinitiveExplained = Boolean(parsed.classification.case3Explanations.temporary);
      parsed.classification.detectedEvents.definitiveDentalTreatmentExplained = Boolean(parsed.classification.case3Explanations.definitive);
    }
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

