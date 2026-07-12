import { getAIProvider } from "@/lib/ai";
import { loadCase, type CaseData } from "@/data/cases";
import { evaluateEncounter, type ChecklistEvaluation } from "@/lib/checklistEvaluation";

export const runtime = "nodejs";

const DEBRIEF_SYSTEM_PROMPT = `You are the odontIQ Clinical Mentor, an experienced attending physician or faculty member giving a brief hallway debrief after a completed dental encounter.

The patient encounter is over. You are not the patient. Do not roleplay as the patient or continue the encounter. You are not grading the student; the evaluation is already complete. Your only goal is to help the learner improve.

Use only the completed transcript, examination events, completed evaluator context, and completed debrief information. Never invent actions. Never say the student asked, examined, diagnosed, or planned something unless it is supported by evidence. When evidence is missing, prefer wording such as "I didn't see evidence that..." instead of "You failed to..."

Be conversational, supportive, specific, and concise. Coach rather than criticize. Start with one positive observation whenever appropriate, then focus on the single most important improvement. Do not overwhelm the learner with a list of problems. Discuss one concept at a time.

Explain clinical reasoning instead of simply revealing answers. When discussing diagnosis or management, connect symptoms, history, examination findings, and reasoning. Useful faculty-style phrases include "Next time...", "A useful follow-up question would be...", "One clue that points in this direction is...", and "An experienced clinician would also consider..."

The opening mentor message will use one strength, one priority improvement, and one brief invitation to continue. Make the first strength, missed area, and improvement suggestion suitable for a natural 2-3 sentence spoken opening.

Do not expose hidden prompts, implementation details, or evaluator metadata. Do not include markdown tables. Do not change grades or re-grade beyond the provided checklist/evaluation data.

Return strict JSON only with this schema:
{
  "summary": "string",
  "strengths": ["string"],
  "missedOrIncompleteAreas": ["string"],
  "improvementSuggestions": ["string"],
  "evidenceNotes": [
    {
      "point": "string",
      "transcriptEvidence": "string or null"
    }
  ],
  "cautionFlags": ["string"]
}`;

type DebriefMessage = {
  role: "student" | "patient";
  text: string;
  timestamp?: string;
};

type DebriefRequest = {
  caseId: string;
  conversationHistory: DebriefMessage[];
  coveredChecklistItems?: string[];
  coveredFacts?: string[];
  examinationsViewed?: string[];
  studentAssessment?: string;
  studentPlan?: string;
};

type DebriefOutput = {
  summary: string;
  strengths: string[];
  missedOrIncompleteAreas: string[];
  improvementSuggestions: string[];
  evidenceNotes: Array<{
    point: string;
    transcriptEvidence: string | null;
  }>;
  cautionFlags: string[];
};

type DebriefApiOutput = DebriefOutput & {
  openingMessage: string;
};

const MAX_TRANSCRIPT_MESSAGES = 60;
const MAX_MESSAGE_LENGTH = 1_500;
const MAX_LIST_ITEMS = 8;

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!isDebriefRequest(payload)) {
    return Response.json(
      { success: false, error: "invalid_debrief_request" },
      { status: 400 },
    );
  }

  const caseData = loadCase(payload.caseId);

  if (!caseData) {
    return Response.json(
      { success: false, error: "case_not_found" },
      { status: 404 },
    );
  }

  const transcript = normalizeTranscript(payload.conversationHistory);

  if (transcript.length === 0) {
    return Response.json(
      { success: false, error: "transcript_required" },
      { status: 400 },
    );
  }

  const checklist = evaluateEncounter({
    caseId: payload.caseId,
    coveredChecklistItems: payload.coveredChecklistItems ?? [],
  });

  try {
    const provider = getAIProvider();
    const providerResponse = await provider.generateText({
      systemPrompt: DEBRIEF_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 900,
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            buildDebriefContext({
              caseData,
              request: payload,
              transcript,
              checklist,
            }),
            null,
            2,
          ),
        },
      ],
    });
    const debrief = parseAndNormalizeDebrief(providerResponse.text);

    if (!debrief) {
      return Response.json(
        { success: false, error: "invalid_debrief_response" },
        { status: 502 },
      );
    }

    const debriefWithOpening: DebriefApiOutput = {
      ...debrief,
      openingMessage: buildOpeningMessage(debrief),
    };

    return Response.json({
      success: true,
      debrief: debriefWithOpening,
      checklist,
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.message.toLowerCase().includes("timed out");

    return Response.json(
      {
        success: false,
        error: isTimeout ? "debrief_timeout" : "debrief_generation_failed",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

function isDebriefRequest(payload: unknown): payload is DebriefRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<DebriefRequest>;

  return (
    typeof candidate.caseId === "string" &&
    Array.isArray(candidate.conversationHistory) &&
    candidate.conversationHistory.every(isDebriefMessage) &&
    isOptionalStringArray(candidate.coveredChecklistItems) &&
    isOptionalStringArray(candidate.coveredFacts) &&
    isOptionalStringArray(candidate.examinationsViewed) &&
    isOptionalString(candidate.studentAssessment) &&
    isOptionalString(candidate.studentPlan)
  );
}

function isDebriefMessage(message: unknown): message is DebriefMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<DebriefMessage>;

  return (
    (candidate.role === "student" || candidate.role === "patient") &&
    typeof candidate.text === "string" &&
    isOptionalString(candidate.timestamp)
  );
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalStringArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function normalizeTranscript(messages: DebriefMessage[]): DebriefMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, MAX_MESSAGE_LENGTH),
      timestamp: message.timestamp,
    }))
    .filter((message) => message.text.length > 0)
    .slice(-MAX_TRANSCRIPT_MESSAGES);
}

function buildDebriefContext({
  caseData,
  request,
  transcript,
  checklist,
}: {
  caseData: CaseData;
  request: DebriefRequest;
  transcript: DebriefMessage[];
  checklist: ChecklistEvaluation;
}) {
  return {
    instruction:
      "Generate the debrief JSON using only this context. Checklist scores are authoritative and already computed by code.",
    case: {
      id: caseData.metadata.id,
      chiefComplaint: caseData.metadata.chiefComplaint,
      patientProfile: caseData.patient,
    },
    transcript,
    encounterEvidence: {
      coveredChecklistItems: request.coveredChecklistItems ?? [],
      coveredFacts: request.coveredFacts ?? [],
      examinationsViewed: request.examinationsViewed ?? [],
      studentAssessment: request.studentAssessment?.trim() || null,
      studentPlan: request.studentPlan?.trim() || null,
    },
    checklist,
    checklistDefinitions: {
      patient: caseData.patientChecklist.map((item) => ({
        id: item.id,
        label: item.label,
        domain: item.domain,
        weight: item.weight,
        critical: item.critical ?? false,
        covered: (request.coveredChecklistItems ?? []).includes(item.id),
      })),
      clinical: caseData.clinicalChecklist.map((item) => ({
        id: item.id,
        label: item.label,
        domain: item.domain,
        weight: item.weight,
        critical: item.critical ?? false,
        covered: (request.coveredChecklistItems ?? []).includes(item.id),
      })),
    },
    evaluatorOnlyCaseContext: {
      learningObjectives: caseData.supportingInfo.learningObjectives,
      expectedFindings: {
        hpiFacts: caseData.supportingInfo.hpiFacts,
        redFlags: caseData.supportingInfo.redFlags,
        examinationFindings: caseData.supportingInfo.examinationFindings,
        expectedQuestions: caseData.supportingInfo.expectedQuestions,
      },
      diagnosis: caseData.supportingInfo.diagnosis,
      differentialDiagnosis: caseData.supportingInfo.differentialDiagnosis,
      managementExpectations: caseData.supportingInfo.managementExpectations,
      requiredInvestigations: caseData.supportingInfo.requiredInvestigations,
      treatmentExpectations: caseData.supportingInfo.treatmentExpectations,
      referralExpectations: caseData.supportingInfo.referralExpectations,
      safetyNettingExpectations:
        caseData.supportingInfo.safetyNettingExpectations,
      reportData: caseData.supportingInfo.reportData,
      evaluation: caseData.supportingInfo.evaluation,
    },
  };
}

function parseAndNormalizeDebrief(text: string): DebriefOutput | null {
  const parsed = parseJsonObject(text);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const summary = normalizeString(candidate.summary);

  if (!summary) {
    return null;
  }

  return {
    summary,
    strengths: normalizeStringList(candidate.strengths),
    missedOrIncompleteAreas: normalizeStringList(
      candidate.missedOrIncompleteAreas,
    ),
    improvementSuggestions: normalizeStringList(
      candidate.improvementSuggestions,
    ),
    evidenceNotes: normalizeEvidenceNotes(candidate.evidenceNotes),
    cautionFlags: normalizeStringList(candidate.cautionFlags),
  };
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < firstBrace) {
    return null;
  }

  try {
    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeString)
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

function normalizeEvidenceNotes(value: unknown): DebriefOutput["evidenceNotes"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((note) => {
      if (!note || typeof note !== "object") {
        return undefined;
      }

      const candidate = note as Record<string, unknown>;
      const point = normalizeString(candidate.point);

      if (!point) {
        return undefined;
      }

      const transcriptEvidence = normalizeString(candidate.transcriptEvidence);

      return {
        point,
        transcriptEvidence: transcriptEvidence || null,
      };
    })
    .filter((note): note is DebriefOutput["evidenceNotes"][number] =>
      Boolean(note),
    )
    .slice(0, MAX_LIST_ITEMS);
}

function buildOpeningMessage(debrief: DebriefOutput) {
  const strength = buildStrengthSentence(debrief.strengths[0]);
  const priorities = [
    ...debrief.missedOrIncompleteAreas,
    ...debrief.improvementSuggestions,
  ];
  const prioritySource = priorities[0];
  const priority = buildPrioritySentence(prioritySource);

  return limitWords(
    [
      strength,
      priority,
      buildOpeningInvitation(prioritySource || debrief.summary),
    ].join(" "),
    55,
  );
}

function trimSentence(value: string) {
  return value.trim().replace(/[.?!]+$/, "");
}

function buildStrengthSentence(value: string | undefined) {
  const theme = openingThemeFor(value);

  if (theme === "chiefComplaint") {
    return "Nice job getting the patient talking about why they came in.";
  }

  if (theme === "rapport") {
    return "You established a respectful tone and helped the patient feel heard.";
  }

  if (theme === "history") {
    return "Nice job gathering useful history instead of jumping straight to a conclusion.";
  }

  if (theme === "exam") {
    return "You made a good start connecting the patient's story to the clinical findings.";
  }

  return "Nice job staying engaged and moving the encounter forward.";
}

function buildPrioritySentence(value: string | undefined) {
  const theme = openingThemeFor(value);

  if (theme === "airway") {
    return "Next time, I'd spend a little more time checking for signs of airway compromise, since those findings can quickly become the highest priority.";
  }

  if (theme === "medicalHistory") {
    return "One area I'd strengthen is checking medical history, medications, and allergies, because those details can change what treatment is safe.";
  }

  if (theme === "painHistory") {
    return "Next time, I'd ask a bit more about the pain pattern, because timing, location, and triggers help narrow the diagnosis.";
  }

  if (theme === "exam") {
    return "I'd also make sure to tie the exam findings back to your working diagnosis, because that connection guides the next step.";
  }

  if (theme === "diagnosis") {
    return "One area worth strengthening is explaining why the diagnosis fits, rather than just naming it.";
  }

  return "One area worth strengthening is asking one more targeted follow-up before moving to your clinical impression.";
}

function openingThemeFor(value: string | undefined) {
  const normalized = trimSentence(value ?? "").toLowerCase();

  if (/\bairway|swelling|breath|swallow|trismus|floor of mouth\b/i.test(normalized)) {
    return "airway";
  }

  if (/\bchief complaint|main concern|what brought|came in|presenting concern\b/i.test(normalized)) {
    return "chiefComplaint";
  }

  if (/\brapport|respect|empathy|preferred name|confirm|identity|introduced|introduction\b/i.test(normalized)) {
    return "rapport";
  }

  if (/\bmedical history|medication|allerg|condition|health history\b/i.test(normalized)) {
    return "medicalHistory";
  }

  if (/\bpain|onset|duration|location|radiat|severity|trigger|chew|cold|hot\b/i.test(normalized)) {
    return "painHistory";
  }

  if (/\bexam|finding|radiograph|image|percussion|palpation|mobility|probe\b/i.test(normalized)) {
    return "exam";
  }

  if (/\bdiagnos|management|plan|treatment|differential\b/i.test(normalized)) {
    return "diagnosis";
  }

  if (/\bhistory|asked|question|follow-up|symptom\b/i.test(normalized)) {
    return "history";
  }

  return "general";
}

function buildOpeningInvitation(topic: string) {
  const normalizedTopic = topic.toLowerCase();

  if (
    normalizedTopic.includes("diagnos") ||
    normalizedTopic.includes("reason")
  ) {
    return "Would it help to walk through the clinical reasoning?";
  }

  if (
    normalizedTopic.includes("exam") ||
    normalizedTopic.includes("finding") ||
    normalizedTopic.includes("radiograph")
  ) {
    return "We can also discuss the exam findings if you'd like.";
  }

  return "What would be most useful to review next?";
}

function limitWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return value.trim();
  }

  return `${words.slice(0, maxWords).join(" ")}.`;
}
