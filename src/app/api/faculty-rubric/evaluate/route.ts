import { evaluateFacultyRubricForEncounter } from "@/lib/facultyRubric/evaluation";
import type {
  FacultyRubricEncounterEventInput,
  FacultyRubricEvaluationState,
} from "@/lib/facultyRubric/evaluation/state";
import type { ConversationMessage } from "@/lib/conversationEngine";

export const runtime = "nodejs";

type EvaluationRequest = {
  caseId?: unknown;
  conversationHistory?: unknown;
  encounterEvents?: unknown;
  coveredChecklistItems?: unknown;
  existingState?: unknown;
  forceRefresh?: unknown;
};

type FacultyRubricEvaluateRequest = {
  caseId: string;
  conversationHistory: ConversationMessage[];
  encounterEvents: FacultyRubricEncounterEventInput[];
  coveredChecklistItems: string[];
  existingState?: unknown;
  forceRefresh?: unknown;
};

export async function POST(request: Request) {
  let payload: EvaluationRequest;

  try {
    payload = (await request.json()) as EvaluationRequest;
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!isEvaluationRequest(payload)) {
    return Response.json(
      { success: false, error: "invalid_evaluation_request" },
      { status: 400 },
    );
  }

  try {
    const state = await evaluateFacultyRubricForEncounter({
      caseId: payload.caseId,
      conversationHistory: payload.conversationHistory,
      encounterEvents: payload.encounterEvents,
      coveredChecklistItems: payload.coveredChecklistItems,
      existingState: isFacultyRubricEvaluationState(payload.existingState)
        ? payload.existingState
        : undefined,
      forceRefresh: payload.forceRefresh === true,
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("Faculty rubric API attempt completed.", {
        caseId: payload.caseId,
        transcriptRevision: state.transcriptRevision,
        evaluationStatus: state.status,
        evaluationCount: state.evaluations.length,
        error: state.error,
      });
    }

    return Response.json({ success: true, state });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Faculty rubric API attempt threw.", {
        caseId: payload.caseId,
        error: error instanceof Error ? error.message : "unknown_error",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return Response.json(
      { success: false, error: "faculty_rubric_evaluation_failed" },
      { status: 502 },
    );
  }
}

function isEvaluationRequest(
  payload: EvaluationRequest,
): payload is FacultyRubricEvaluateRequest {
  return (
    typeof payload.caseId === "string" &&
    isConversationMessages(payload.conversationHistory) &&
    isEncounterEvents(payload.encounterEvents) &&
    isStringArray(payload.coveredChecklistItems)
  );
}

function isConversationMessages(value: unknown): value is ConversationMessage[] {
  return (
    Array.isArray(value) &&
    value.every((message) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        return false;
      }

      const candidate = message as Partial<ConversationMessage>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.role === "string" &&
        typeof candidate.text === "string"
      );
    })
  );
}

function isEncounterEvents(
  value: unknown,
): value is FacultyRubricEncounterEventInput[] {
  return (
    Array.isArray(value) &&
    value.every((event) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return false;
      }

      const candidate = event as Partial<FacultyRubricEncounterEventInput>;
      return typeof candidate.type === "string";
    })
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFacultyRubricEvaluationState(
  value: unknown,
): value is FacultyRubricEvaluationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<FacultyRubricEvaluationState>;

  return (
    typeof candidate.caseId === "string" &&
    typeof candidate.rubricVersion === "string" &&
    typeof candidate.transcriptRevision === "string" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.evaluations)
  );
}
