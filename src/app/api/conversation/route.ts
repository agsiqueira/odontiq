import { getAIProvider } from "@/lib/ai";
import type {
  AIProvider,
  ConversationGatewayInput,
} from "@/lib/ai";
import type {
  ConversationChatMessage,
  ConversationGatewayRequest,
} from "@/lib/ai/provider";
import { loadCase, type CaseData } from "@/data/cases";
import { buildPatientDisclosureState } from "@/lib/patientDisclosure";
import type { PatientDisclosureState } from "@/lib/patientDisclosure";
import { NavigatorProviderError } from "@/lib/ai/navigatorProvider";
import { normalizePatientDialogueWithDiagnostics } from "@/lib/patientDialogue";

const PATIENT_ROLE_SYSTEM_PROMPT = `You are the patient in an odontIQ dental encounter simulation.

You must act only as the patient. Do not act as the dentist, instructor, evaluator, preceptor, assistant, or narrator.

Respond only with natural spoken dialogue. Return only the words the patient should say aloud.

Do not use Markdown, headings, numbered lists, bullet points, tables, code formatting, bold markers, or italic markers. Do not use asterisks, hash symbols, or structured formatting. Do not add labels such as "Response:", "Patient:", or "Answer:". Do not enumerate information as "one, two, three" unless the patient would naturally speak that way.

Do not include analysis, teaching, diagnosis, differential diagnosis, treatment recommendations, grading feedback, narration, or explanations for the student.

Carefully determine whether the provider is asking you a question or explaining something to you. The current provider message intent is supplied in turnPolicy.providerMessageIntent.

When the provider explains a diagnosis, treatment, medication, procedure, referral, admission, discharge plan, follow-up plan, or other course of action, respond as a patient receiving that information. Briefly acknowledge, react, express an appropriate concern or emotion, or ask one short realistic follow-up question about pain, safety, timing, medication, admission, recovery, or what happens next. Do not ask a question every time, and vary acknowledgments naturally while staying consistent with the patient's age, personality, emotional state, and the seriousness of the situation.

Do not say "I don't know," "That's why I'm here," or "You're the doctor" in response to a provider explanation, recommendation, instruction, reassurance, or closing statement. Do not independently approve, reject, alter, or add to the clinical plan. React only as the patient.

Use an unknown-information response only when the provider asks a genuine factual question, the requested fact is not available in visibleFacts, and the patient would not reasonably know it. If the provider asks whether you understand the plan, answer that comprehension question directly rather than using the unknown-information response.

Use only the patient facts provided in the prompt context. Do not infer, invent, or volunteer clinical findings that are not provided. If a detail is not provided or has not been made visible, say you are not sure or answer naturally that you do not know.

Answer the student's specific question directly and briefly, usually in one short sentence. If the student asks a broad question, reveal at most one new patient fact. Do not give the full history unless the student explicitly asks for a summary, and even then only summarize visible patient facts.

Only reveal symptoms, history, medications, allergies, dental history, social history, and examination-related information when the student asks an appropriate question about that topic.

If the student asks for a diagnosis, clinical interpretation, management plan, or what the dentist should do, do not diagnose or teach. Respond as a patient, for example: "I don't know, that's why I'm here."

If the student mentions examination images, radiographs, tests, or findings, only discuss information explicitly provided as visible to the patient for this turn. Do not volunteer hidden clinical findings.

Maintain the patient's identity, tone, and communication style consistently.

Return only the patient response text.`;

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!isConversationRequest(payload)) {
    return Response.json(
      { success: false, error: "Invalid conversation request" },
      { status: 400 },
    );
  }

  let provider: AIProvider | undefined;

  try {
    const patientCase = loadCase(payload.caseId);

    if (!patientCase) {
      return Response.json(
        { success: false, error: "Case not found" },
        { status: 404 },
      );
    }

    const providerInput: ConversationGatewayInput = {
      ...payload,
      systemPrompt: buildPatientSystemPrompt(
        patientCase,
        buildPatientDisclosureState({
          caseData: patientCase,
          conversation: payload.conversation,
          latestStudentMessage: payload.message,
        }),
      ),
      messages: buildChatTranscript(payload),
    };

    provider = getAIProvider();
    const providerResponse =
      await provider.generateConversationResponse(providerInput);
    const normalizedResponse = normalizePatientDialogueWithDiagnostics(
      providerResponse.text,
    );

    if (process.env.NODE_ENV !== "production" && normalizedResponse.changed) {
      console.info("Patient dialogue formatting was normalized.", {
        categories: normalizedResponse.categories,
        caseId: payload.caseId,
        encounterId: payload.encounterId,
      });
    }

    return Response.json({
      success: true,
      provider: provider.name,
      response: normalizedResponse.text,
      encounterId: payload.encounterId,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Conversation provider request failed.", {
        provider: provider?.name ?? "unknown",
        category:
          error instanceof NavigatorProviderError ? error.category : "unknown",
        status: error instanceof NavigatorProviderError ? error.status : undefined,
        contentType:
          error instanceof NavigatorProviderError ? error.contentType : undefined,
        message: error instanceof Error ? error.message : "Conversation failed",
      });
    }
    return Response.json(
      {
        success: false,
        provider: provider?.name ?? "unknown",
        error: error instanceof Error ? error.message : "Conversation failed",
      },
      { status: 502 },
    );
  }
}

function isConversationRequest(
  payload: unknown,
): payload is ConversationGatewayRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ConversationGatewayRequest>;

  return (
    typeof candidate.encounterId === "string" &&
    typeof candidate.caseId === "string" &&
    Array.isArray(candidate.conversation) &&
    Array.isArray(candidate.coveredChecklistItems) &&
    candidate.coveredChecklistItems.every((item) => typeof item === "string") &&
    typeof candidate.message === "string"
  );
}

function buildPatientSystemPrompt(
  patientCase: CaseData,
  disclosureState: PatientDisclosureState,
): string {
  return [
    PATIENT_ROLE_SYSTEM_PROMPT,
    "",
    "Use visibleFacts.allowedThisTurn as the only source for new patient facts in this response.",
    "visibleFacts.alreadyDisclosed may be used only to preserve continuity; do not add extra details from it unless the student asks a direct follow-up.",
    "If visibleFacts.allowedThisTurn is empty, answer naturally without adding clinical facts. Use the restricted response in turnPolicy only for a genuine question asking the patient to supply a diagnosis, clinical interpretation, or plan; never use it for a provider explanation or recommendation.",
    "",
    "Visible patient facts for this turn (source of truth):",
    JSON.stringify(
      buildSanitizedPatientContext(patientCase, disclosureState),
      null,
      2,
    ),
  ].join("\n");
}

function buildSanitizedPatientContext(
  patientCase: CaseData,
  disclosureState: PatientDisclosureState,
) {
  return {
    patientProfile: {
      name: patientCase.patient.name,
      age: patientCase.patient.age,
      sex: patientCase.patient.sex,
      communicationStyle: "brief, natural, cooperative, and concerned as appropriate for the complaint",
    },
    openingGreeting: shouldIncludeOpeningGreeting(disclosureState)
      ? patientCase.conversation.openingGreeting
      : undefined,
    visibleFacts: {
      alreadyDisclosed: disclosureState.alreadyDisclosed,
      allowedThisTurn: disclosureState.allowedThisTurn,
    },
    turnPolicy: {
      latestTopics: disclosureState.latestTopics,
      isBroadQuestion: disclosureState.isBroadQuestion,
      asksRestrictedClinicalInterpretation:
        disclosureState.asksRestrictedClinicalInterpretation,
      providerMessageIntent: disclosureState.providerMessageIntent,
      restrictedClinicalInterpretationResponse:
        "I don't know, that's why I'm here.",
    },
  };
}

function shouldIncludeOpeningGreeting(
  disclosureState: PatientDisclosureState,
): boolean {
  return (
    disclosureState.alreadyDisclosed.length === 0 &&
    disclosureState.allowedThisTurn.length === 0 &&
    disclosureState.latestTopics.length === 0 &&
    !disclosureState.asksRestrictedClinicalInterpretation
  );
}

function buildChatTranscript(
  payload: ConversationGatewayRequest,
): ConversationChatMessage[] {
  const transcript = payload.conversation
    .map((message): ConversationChatMessage | undefined => {
      const content = message.text.trim();

      if (!content) {
        return undefined;
      }

      return {
        role: message.role === "student" ? "user" : "assistant",
        content,
      };
    })
    .filter((message): message is ConversationChatMessage =>
      Boolean(message),
    );
  const currentMessage = payload.message.trim();
  const lastMessage = transcript[transcript.length - 1];

  if (
    currentMessage &&
    !(
      lastMessage?.role === "user" &&
      lastMessage.content.trim() === currentMessage
    )
  ) {
    transcript.push({
      role: "user",
      content: currentMessage,
    });
  }

  return transcript;
}
