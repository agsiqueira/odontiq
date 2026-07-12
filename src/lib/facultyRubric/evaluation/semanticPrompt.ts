import type { FacultyRubricCriterion } from "../types";
import type {
  FacultyEvaluationEvent,
  FacultyEvaluationMessage,
  FacultyEvaluationInput,
} from "./types";
import {
  getContextualPatientMessages,
  getEligibleEncounterEvents,
  getEligibleLearnerMessages,
  normalizeFacultyEvaluationInput,
} from "./evidence";

export type FacultyConversationExchange = {
  learnerMessage: FacultyEvaluationMessage;
  patientResponse?: FacultyEvaluationMessage;
  nearbyContext: FacultyEvaluationMessage[];
};

export const FACULTY_SEMANTIC_EVALUATION_SYSTEM_PROMPT = `You are the odontIQ faculty-rubric semantic evaluator.

Evaluate learner behavior only for the requested rubric criteria. Return strict JSON only.

Core rules:
- Evaluate learner-authored behavior, not the patient's underlying case state.
- Only student messages can directly earn credit.
- Award credit only when the learner explicitly demonstrates the exact behavior named by the criterion. Never infer competence from patient statements, clinical context, silence, omitted actions, likely reasoning, or clinically obvious conclusions.
- History requires a targeted learner question. Examination requires an explicit learner examination action or stated examination finding. Clinical reasoning requires an explicit learner conclusion. Recommendations require an explicit learner recommendation or decision.
- Not mentioning an action never proves that the learner deliberately decided against it.
- Patient responses may provide context for finding elicitation when they answer or confirm a learner question.
- Mentor, system, report, and evaluator prose are excluded and must never count as learner evidence.
- Semantically equivalent phrasing should count when the learner behavior is clear.
- Isolated keywords should not count.
- Questions must not be mistaken for conclusions.
- Discussion of an option must not automatically count as recommending it.
- Handle negation carefully. Incorrect or unsafe recommendations must not receive credit.
- Prefer "uncertain" when evidence is ambiguous.
- Return "not-met" when the complete supplied encounter contains no supporting evidence.
- Use "uncertain" only when supplied evidence is genuinely ambiguous, never for absent evidence.
- Return findings for met or genuinely uncertain criteria. Explicit not-met findings are allowed but may be omitted.
- Do not assign weights, points, scores, grades, or feedback prose.

Evaluation mode guidance:
- conversation-question: credit a semantically equivalent learner question.
- finding-elicitation: credit requires a learner investigation plus a contextual patient response confirming the expected positive finding.
- clinical-statement: credit requires a learner-authored clinical conclusion or interpretation; a question is insufficient.
- recommendation: credit requires learner advice, recommendation, or management plan; a topic mention is insufficient.
- patient-education: credit requires an explanation to the patient; a bare mention is insufficient.
- shared-decision-making: credit requires exploring patient preferences or ability to follow the plan.
- procedural-choice: credit requires offering, selecting, or clearly recommending the appropriate procedure.

False-positive safeguards:
- "Could this be an abscess?" does not automatically satisfy diagnosing an abscess.
- "There are antibiotics for infections" does not satisfy recommending IV antibiotics.
- "This is not urgent" must not satisfy urgent or emergency criteria.
- A patient volunteering a symptom does not satisfy elicitation unless the learner appropriately investigates it.
- A generic question cannot satisfy a targeted criterion. Patient-provided information does not prove that the learner asked, assessed, examined, concluded, or recommended it. Cite learner evidence that directly demonstrates the named behavior.
- Generic advice like "see someone soon" may not satisfy OMFS consultation or emergency referral.
- Mentioning CT while saying it is unnecessary must not satisfy recommending CT with IV contrast.
- For "Asked About Fever", broad openings such as "What brings you in?", "What seems to be the problem?", "Tell me what happened", and "How can I help you today?" never count.
- A patient volunteering fever or systemic symptoms never satisfies "Asked About Fever" unless the learner directly asks or clearly follows up about fever, chills, feeling unwell, fatigue, weakness, body aches, nausea, vomiting, or systemic involvement.
- Evidence for "Asked About Fever" must quote the targeted learner inquiry itself, not a generic opening or the patient's volunteered statement.

Return exactly:
{
  "results": [
    {
      "criterionId": "requested criterion ID",
      "status": "met" | "not-met" | "uncertain",
      "confidence": 0.0,
      "learnerEvidenceMessageIds": ["student message IDs only"],
      "contextualPatientMessageIds": ["patient message IDs only"],
      "evidenceExcerpts": ["exact excerpts copied from supplied messages"],
      "rationale": "brief evaluator rationale"
    }
  ]
}`;

export function buildFacultySemanticEvaluationUserPrompt({
  caseId,
  criteria,
  input,
}: {
  caseId: string;
  criteria: FacultyRubricCriterion[];
  input: FacultyEvaluationInput;
}) {
  const normalizedInput = normalizeFacultyEvaluationInput(input);
  const learnerMessages = getEligibleLearnerMessages(normalizedInput);
  const patientMessages = getContextualPatientMessages(normalizedInput);
  const events = getEligibleEncounterEvents(normalizedInput);
  const exchanges = buildFacultyConversationExchanges(normalizedInput);

  return JSON.stringify(
    {
      task:
        "Evaluate only the requested odontIQ faculty rubric criteria against the supplied learner/patient evidence.",
      caseId,
      requestedCriteria: criteria.map((criterion) => ({
        id: criterion.id,
        title: criterion.title,
        description: criterion.description,
        evaluationMode: criterion.evaluationMode,
        expectedValue: criterion.expectedValue,
        acceptedConcepts: criterion.acceptedConcepts ?? [],
        reportLabel: criterion.reportLabel,
      })),
      learnerMessages: learnerMessages.map(serializeMessage),
      contextualPatientMessages: patientMessages.map(serializeMessage),
      learnerPatientExchanges: exchanges.map((exchange) => ({
        learnerMessage: serializeMessage(exchange.learnerMessage),
        patientResponse: exchange.patientResponse
          ? serializeMessage(exchange.patientResponse)
          : undefined,
        nearbyContext: exchange.nearbyContext.map(serializeMessage),
      })),
      encounterEvents: events.map(serializeEvent),
      outputContract:
        "Return only requested criterion IDs. Include met and genuinely uncertain findings; explicit not-met findings are optional. Omitted criteria are finalized deterministically as not-met after a successful response.",
    },
    null,
    2,
  );
}

export function buildFacultyConversationExchanges(
  input: FacultyEvaluationInput,
): FacultyConversationExchange[] {
  const messages = normalizeFacultyEvaluationInput(input).messages.filter(
    (message) => message.role === "student" || message.role === "patient",
  );
  const exchanges: FacultyConversationExchange[] = [];

  messages.forEach((message, index) => {
    if (message.role !== "student") {
      return;
    }

    const patientResponse = messages
      .slice(index + 1)
      .find((candidate) => candidate.role === "patient");
    const nearbyContext = messages.slice(
      Math.max(0, index - 1),
      Math.min(messages.length, index + 3),
    );

    exchanges.push({
      learnerMessage: message,
      patientResponse,
      nearbyContext,
    });
  });

  return exchanges;
}

function serializeMessage(message: FacultyEvaluationMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function serializeEvent(event: FacultyEvaluationEvent) {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt,
    metadata: event.metadata,
  };
}
