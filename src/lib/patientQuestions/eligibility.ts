import { type PatientDisclosureFact } from "../patientDisclosure";
import { interpretBackgroundTurn } from "../patientBackgroundTurn";
import { isPatientConversationClosure } from "../patientConversationClosure";
import { expressesRequiredFact } from "../patientOutputGuard";
import type { ConversationMessage } from "../conversationEngine";
import type { PatientQuestionClassification } from "./types";

/** Semantic classification is necessary, never sufficient: enforce scope and sourced evidence.
 * This veto does not grant permission based on words or turn count. The catalog/state machine
 * still require affirmative semantic events and enforce once-only emission transactionally.
 */
export function constrainQuestionClassification(input: {
  classification: PatientQuestionClassification;
  studentMessage: string;
  patientResponse: string;
  conversation: readonly ConversationMessage[];
  facts: readonly PatientDisclosureFact[];
}): PatientQuestionClassification {
  const result = { ...input.classification, detectedEvents: { ...input.classification.detectedEvents } };
  if (isPatientConversationClosure(input.studentMessage)) {
    for (const event of Object.keys(result.detectedEvents)) result.detectedEvents[event as keyof typeof result.detectedEvents] = false;
    return result;
  }
  const background = interpretBackgroundTurn(input.studentMessage, input.conversation, input.facts);
  if (result.caseId === "case-04" && background && !background.clinicalRequested) {
    result.detectedEvents.painManagementOrDispositionDiscussed = false;
  }
  // A substantive current-pain description must express an actual sourced attribute,
  // not a county, preference, general pain mention or the antibiotic question itself.
  if (result.caseId === "case-05") {
    const painFacts = input.facts.filter(f => /^c5\.(?:location|duration|constant|quality|severity|spontaneous|nocturnal|cold|lingering|chewing|biting)$/.test(f.id));
    const patientTexts = [...input.conversation.filter(m => m.role === "patient").map(m => m.text), input.patientResponse];
    const substantive = patientTexts.some(text => {
      const answer = text.split(/(?<=[.!?])\s+/).filter(s => !s.includes("?")).join(" ");
      return painFacts.some(fact => expressesRequiredFact(answer, fact));
    });
    if (!substantive) result.detectedEvents.patientPainDescribed = false;
  }
  return result;
}
