import { getAIProvider } from "@/lib/ai";
import type { AIProvider, ConversationGatewayInput } from "@/lib/ai";

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
    provider = getAIProvider();
    const providerResponse = await provider.generateConversationResponse(payload);

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
): payload is ConversationGatewayInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ConversationGatewayInput>;

  return (
    typeof candidate.encounterId === "string" &&
    typeof candidate.caseId === "string" &&
    Array.isArray(candidate.conversation) &&
    Array.isArray(candidate.coveredChecklistItems) &&
    candidate.coveredChecklistItems.every((item) => typeof item === "string") &&
    typeof candidate.message === "string"
  );
}
