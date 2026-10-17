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
    "temporaryTreatmentActive",
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
  temporaryTreatmentActive:
    "the provider actively recommends, orders, starts, gives, offers, or performs a Case 3 temporary treatment: antibiotic therapy, local dental anesthesia or nerve block, incision and drainage, or acetaminophen pain relief; history, allergy inquiry, hypothetical, considered, declined, negated, unnecessary, and permanent-only treatment do not count",
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
An asserted event requires evidence of that exact event, not merely discussion of a related topic.
Provider questions seeking history, symptoms, county, insurance or ability to pay are NOT treatment/disposition plans.
Looking/searching for care options is NOT giving a plan. A plan chooses an actual current treatment, referral or follow-up action.
A patient answer about county, insurance, payment or preferences is NOT a pain description.
Generic tooth pain without a substantive attribute is NOT patientPainDescribed.
A substantive pain description may occur in an opening complaint or later answer; never use turn count.
Do not infer events from the case scenario, intended future care or a patient's appended question.
For a background-only exchange all clinical events should be false.
Example: provider asks county; patient says Duval County => painManagementOrDispositionDiscussed=false.
Example: provider gives ibuprofen plan and directs dentist follow-up => painManagementOrDispositionDiscussed=true.
Example: patient says tooth pain keeps waking me => patientPainDescribed=true.
Example: patient says I am focused on my tooth pain => patientPainDescribed=false.

Return exactly these top-level fields:
- schemaVersion: the number 1
- caseId: the supplied case ID
- events: an object containing every allowed event name exactly once, each with a boolean value
- confidence: a number from 0 to 1 representing confidence in the event determinations
- evidence: an array containing only supplied short message aliases that support asserted true events
${input.caseId === "case-04" ? `- currentProviderAct: exactly one of current_plan, history_or_symptom_question, background_screening, care_search_offer, explanation, other
- currentPlanEvidence: a verbatim quote from student-current that actually gives a current pain-treatment or disposition/follow-up plan, or an empty string if none.
A current_plan chooses a specific current treatment or follow-up action. An access-screening question, county for referral, acceptable fees or offering to look for options does not choose a plan. A symptom-history question is not a plan. Do not use patient-draft or prior context as the current plan witness.
For a mixed turn that both gives a plan and asks a background question, currentProviderAct may be current_plan; quote the actual plan portion only.
Only current_plan with a nonempty valid quote can support painManagementOrDispositionDiscussed=true.` : ""}

Do not return message IDs. Do not add fields other than those specified for this case or add event names.

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
