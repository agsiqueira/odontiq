import type { ConversationMessage } from "@/lib/conversationEngine";
import type {
  PatientQuestionEventId,
  PatientQuestionState,
} from "./types";

export type PatientQuestionEvidenceAlias = {
  alias: string;
  messageId: string;
  role: "student" | "patient";
  content: string;
};

const CASE_EVENTS: Record<string, readonly PatientQuestionEventId[]> = {
  "case-01": ["hospitalAdmissionOrSurgicalManagementDiscussed"],
  "case-02": ["antibioticsRecommendedAsCurrentPlan"],
  "case-03": [
    "incisionAndDrainageProposed",
    "patientAgreedToIncisionAndDrainage",
  ],
  "case-04": [
    "painManagementOrDispositionDiscussed",
    "antibioticsRecommended",
    "antibioticsNotIndicatedExplained",
  ],
  "case-05": ["patientPainDescribed"],
};

const EVENT_DEFINITIONS: Record<PatientQuestionEventId, string> = {
  hospitalAdmissionOrSurgicalManagementDiscussed:
    "current care includes hospital admission, surgical management, or OMFS/oral-surgery consultation; historical questions do not count",
  antibioticsRecommendedAsCurrentPlan:
    "antibiotics are recommended or part of the current plan; history, allergy inquiry, hypothetical mention, and saying antibiotics are unnecessary do not count",
  incisionAndDrainageProposed:
    "the provider proposes incision and drainage of this abscess",
  patientAgreedToIncisionAndDrainage:
    "the patient affirmatively agrees specifically to incision and drainage, not merely anesthesia, medication, imaging, or admission",
  promptDentalFollowUpConfirmed:
    "after the patient's follow-up question, the provider confirms the patient still needs prompt dental care",
  drainageTemporaryOrNondefinitiveExplained:
    "the current provider answer explains drainage only relieves pressure or drains infection, or is temporary or nondefinitive",
  definitiveDentalTreatmentExplained:
    "the current provider answer explains root canal, extraction, or equivalent definitive dental treatment is still required",
  painManagementOrDispositionDiscussed:
    "the provider gives a pain treatment plan or disposition/follow-up plan",
  antibioticsRecommended:
    "the provider recommends antibiotics",
  antibioticsNotIndicatedExplained:
    "the provider already explains antibiotics are unnecessary or not indicated",
  patientPainDescribed:
    'the patient communicates a substantive current-pain attribute: location, quality, severity, timing, provoking or relieving factor, or functional effect; "Yes, it hurts" alone is insufficient',
};

export function classifierEventsForCase(
  caseId: string,
  state: PatientQuestionState,
): readonly PatientQuestionEventId[] {
  if (
    caseId === "case-03" &&
    state.emittedQuestionIds.includes("c3-follow-up-needed-question")
  ) {
    return [
      "promptDentalFollowUpConfirmed",
      "drainageTemporaryOrNondefinitiveExplained",
      "definitiveDentalTreatmentExplained",
    ];
  }
  return CASE_EVENTS[caseId] ?? [];
}

export function buildPatientQuestionClassifierPrompt(input: {
  caseId: string;
  studentMessageId: string;
  studentMessage: string;
  draftPatientMessageId: string;
  draftPatientResponse: string;
  conversation: readonly ConversationMessage[];
  state: PatientQuestionState;
}) {
  const prior = input.conversation.slice(-8);
  const roleTotals = {
    student: prior.filter((message) => message.role === "student").length,
    patient: prior.filter((message) => message.role === "patient").length,
  };
  const roleSeen = { student: 0, patient: 0 };
  const evidence: PatientQuestionEvidenceAlias[] = prior.map((message) => {
    roleSeen[message.role] += 1;
    return {
      alias: `${message.role}-prior-${roleTotals[message.role] - roleSeen[message.role] + 1}`,
      messageId: message.id,
      role: message.role,
      content: message.text,
    };
  });
  evidence.push(
    {
      alias: "student-current",
      messageId: input.studentMessageId,
      role: "student",
      content: input.studentMessage,
    },
    {
      alias: "patient-draft",
      messageId: input.draftPatientMessageId,
      role: "patient",
      content: input.draftPatientResponse,
    },
  );
  const allowedEvents = classifierEventsForCase(input.caseId, input.state);

  const eventDefinitions = allowedEvents
    .map((event) => `- ${event}: ${EVENT_DEFINITIONS[event]}`)
    .join("\n");

  return {
    systemPrompt: `Classify semantic events for one odontIQ case.
Return exactly one JSON object and no Markdown or commentary.
Determine meaning from the ordered messages, including paraphrases and clinical equivalents.
Do not select a patient question. Application code determines question eligibility.

Return exactly these top-level fields:
- schemaVersion: the number 1
- caseId: the supplied case ID
- events: an object containing every allowed event name exactly once, each with a boolean value
- confidence: a number from 0 to 1 representing confidence in the event determinations
- evidence: an array containing only supplied short message aliases that support asserted true events

Do not return message IDs. Do not add fields or event names.

Allowed event definitions for this request:
${eventDefinitions}`,
    userPrompt: JSON.stringify({
      caseId: input.caseId,
      allowedEventNames: allowedEvents,
      allowedEvidenceAliases: evidence.map((message) => message.alias),
      messages: evidence.map(({ alias, role, content }) => ({
        alias,
        role,
        content,
      })),
    }),
    allowedEvents,
    evidenceAliases: evidence,
  };
}
