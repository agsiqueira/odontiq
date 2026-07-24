import type { ConversationMessage } from "@/lib/conversationEngine";
import type { PatientQuestionState } from "./types";

export function buildPatientQuestionClassifierPrompt(input: {
  caseId: string;
  studentMessageId: string;
  studentMessage: string;
  draftPatientMessageId: string;
  draftPatientResponse: string;
  conversation: readonly ConversationMessage[];
  state: PatientQuestionState;
}) {
  const bounded = input.conversation.slice(-10).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.text,
  }));
  bounded.push(
    { id: input.studentMessageId, role: "student", content: input.studentMessage },
    { id: input.draftPatientMessageId, role: "patient", content: input.draftPatientResponse },
  );
  return {
    systemPrompt: `Classify semantic events for an odontIQ patient-question state machine.
Return one JSON object only. Do not write markdown.
Use meaning, paraphrases, and clinical equivalents; do not rely on literal keywords.
Evaluate only events supported by the supplied ordered messages.

Event policy:
- hospitalAdmissionOrSurgicalManagementDiscussed: current care includes hospital admission, surgical management, or OMFS/oral-surgery consultation; historical questions do not count.
- antibioticsRecommendedAsCurrentPlan: antibiotics are recommended or part of the current plan. History, allergy inquiry, hypothetical mention, and saying antibiotics are unnecessary do not count.
- incisionAndDrainageProposed: the provider proposes incision and drainage of this abscess.
- patientAgreedToIncisionAndDrainage: the patient affirmatively agrees specifically to incision and drainage, not merely anesthesia, medication, imaging, or admission.
- promptDentalFollowUpConfirmed: after the patient's follow-up question, the provider confirms the patient still needs prompt dental care.
- drainageTemporaryOrNondefinitiveExplained: the current provider answer explains drainage only relieves pressure/drains infection or is temporary/nondefinitive.
- definitiveDentalTreatmentExplained: the current provider answer explains root canal, extraction, or equivalent definitive dental treatment is still required.
- painManagementOrDispositionDiscussed: the provider gives a pain treatment plan or disposition/follow-up plan.
- antibioticsRecommended: the provider recommends antibiotics.
- antibioticsNotIndicatedExplained: the provider already explains antibiotics are unnecessary/not indicated.
- patientPainDescribed: the patient communicates a substantive current-pain attribute: location, quality, severity, timing, provoking/relieving factor, or functional effect. "Yes, it hurts" alone is insufficient.

Eligible IDs by case:
case-01 c1-extraction-question
case-02 c2-antibiotic-effect-question
case-03 c3-follow-up-needed-question or c3-follow-up-why
case-04 c4-antibiotic-needed-question
case-05 c5-antibiotic-request

Select at most one eligibleQuestionId, otherwise null. Existing state and sequencing are supplied for context, but application code is authoritative.`,
    userPrompt: JSON.stringify({
      schemaVersion: 1,
      caseId: input.caseId,
      analyzedStudentMessageId: input.studentMessageId,
      existingState: input.state,
      messages: bounded,
      requiredOutputShape: {
        schemaVersion: 1,
        caseId: input.caseId,
        analyzedStudentMessageId: input.studentMessageId,
        detectedEvents: Object.fromEntries(
          Object.keys(input.state.detectedEvents).map((key) => [key, false]),
        ),
        eligibleQuestionId: null,
        confidence: 0.0,
        evidenceMessageIds: [],
      },
    }),
    validMessageIds: bounded.map((message) => message.id),
  };
}
