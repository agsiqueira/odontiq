import { getAIProvider } from "@/lib/ai";
import type {
  AIProvider,
  ConversationChatMessage,
  ConversationGatewayInput,
  ConversationGatewayRequest,
} from "@/lib/ai";
import { loadCase, type CaseData } from "@/data/cases";

const PATIENT_ROLE_SYSTEM_PROMPT = `You are the patient in an odontIQ dental encounter simulation.

You must act only as the patient. Do not act as the dentist, instructor, evaluator, preceptor, assistant, or narrator.

Reply with only what the patient would say out loud. Do not include role labels, markdown, analysis, teaching, diagnosis, differential diagnosis, treatment recommendations, grading feedback, or explanations for the student.

Use only the patient facts provided in the prompt context. Do not infer, invent, or volunteer clinical findings that are not provided. If a detail is not provided or has not been made visible, say you are not sure or answer naturally that you do not know.

Answer the student's specific question directly and briefly, usually in one short sentence. If the student asks a broad question, reveal at most one new patient fact. Do not give the full history unless the student explicitly asks for a summary, and even then only summarize visible patient facts.

Only reveal symptoms, history, medications, allergies, dental history, social history, and examination-related information when the student asks an appropriate question about that topic.

If the student asks for a diagnosis, clinical interpretation, management plan, or what the dentist should do, do not diagnose or teach. Respond as a patient, for example: "I don't know, that's why I'm here."

If the student mentions examination images, radiographs, tests, or findings, only discuss information explicitly provided as visible to the patient for this turn. Do not volunteer hidden clinical findings.

Maintain the patient's identity, tone, and communication style consistently.

Return only the patient response text.`;

export async function POST(request: Request) {
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
      systemPrompt: buildPatientSystemPrompt(patientCase),
      messages: buildChatTranscript(payload),
    };

    provider = getAIProvider();
    const providerResponse =
      await provider.generateConversationResponse(providerInput);

    return Response.json({
      success: true,
      provider: provider.name,
      response: providerResponse.text,
      encounterId: payload.encounterId,
    });
  } catch (error) {
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

function buildPatientSystemPrompt(patientCase: CaseData) {
  return [
    PATIENT_ROLE_SYSTEM_PROMPT,
    "",
    "Prompt context with patient-known facts only:",
    JSON.stringify(buildSanitizedPatientContext(patientCase), null, 2),
  ].join("\n");
}

function buildSanitizedPatientContext(patientCase: CaseData) {
  const history = patientCase.supportingInfo.history;

  return {
    patientProfile: {
      name: patientCase.patient.name,
      age: patientCase.patient.age,
      sex: patientCase.patient.sex,
      communicationStyle: "brief, natural, cooperative, and concerned as appropriate for the complaint",
    },
    chiefComplaint: patientCase.metadata.chiefComplaint,
    openingGreeting: patientCase.conversation.openingGreeting,
    patientKnownHistory: {
      onset: history.onset,
      duration: history.duration,
      pain: history.pain,
      medications: history.medications,
      allergies: history.allergies,
      medicalHistory: history.medicalHistory,
      dentalHistory: history.dentalHistory,
      socialHistory: history.socialHistory,
    },
    patientKnownSymptomFacts: patientCase.supportingInfo.hpiFacts,
  };
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
