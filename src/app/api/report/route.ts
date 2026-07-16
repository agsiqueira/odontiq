import { loadCase, type CaseData, type EvaluatorDomain } from "@/data/cases";
import { getAIProvider } from "@/lib/ai";
import { evaluateEncounter, type ChecklistEvaluation } from "@/lib/checklistEvaluation";
import type {
  ReportDomainSection,
  ReportTimelineEvent,
  ReportTranscriptMessage,
  StructuredCaseReport,
} from "@/lib/reportTypes";

export const runtime = "nodejs";

const REPORT_SYSTEM_PROMPT = `You are the odontIQ report-writing assistant for a completed dental simulation.

The deterministic grading code has already completed all scoring. You must not grade, re-grade, add checklist items, remove checklist items, alter scores, alter completed/missed status, alter critical misses, or change expected case facts.

Your task is limited to concise faculty-style prose for a structured learner report. Use only the provided completed transcript, examination events, evaluator context, deterministic grading, and deterministic report scaffold.

Never invent actions. Never say the student asked, examined, diagnosed, or planned something unless it is supported by the evidence. When evidence is missing, prefer wording such as "I did not see evidence that..." rather than "You failed to..."

Write like an experienced clinical educator: supportive, specific, direct, and conversational. The written report may be more complete than the mentor chat, but it should still be concise.

Return strict JSON only. Do not include markdown, tables, comments, role labels, or explanatory text outside JSON.

Return exactly this schema:
{
  "overallPerformance": {
    "summary": "2-3 complete concise sentences grounded in the evidence",
    "mainTakeaway": "one concise priority takeaway"
  },
  "domains": {
    "communication": { "strengths": ["string"], "narrative": "string" },
    "history": { "strengths": ["string"], "narrative": "string" },
    "examination": { "strengths": ["string"], "narrative": "string" },
    "reasoning": { "strengths": ["string"], "narrative": "string" },
    "management": { "strengths": ["string"], "narrative": "string" }
  },
  "practiceNext": ["string", "string", "string"]
}

Rules:
- Do not include scores, completed counts, missed checklist items, critical misses, diagnosis lists, or management lists in your JSON except as natural language references inside prose.
- Overall summary must be 2-3 complete sentences and must not end mid-thought.
- Domain narratives should be 1-2 complete sentences each.
- Domain strengths must only describe supported observed behavior. Use an empty array when no strength is supported.
- practiceNext must contain exactly 3 concise items when the provided priorities allow it.
- Prioritize critical misses first, then the lowest-scoring domains, then learning objectives and management/safety gaps.
- Do not assign a proficiency label unless one is explicitly provided in the context.`;

type ReportRequest = {
  caseId: string;
  conversationHistory: ReportTranscriptMessage[];
  coveredChecklistItems?: string[];
  coveredFacts?: string[];
  examinationsViewed?: string[];
  encounterEvents?: ReportEncounterEvent[];
  completedAt?: string;
};

type ReportEncounterEvent = {
  type: string;
  label?: string;
  timestamp?: string;
  [key: string]: unknown;
};

type ReportAiOutput = {
  overallPerformance: {
    summary: string;
    mainTakeaway: string;
  };
  domains: Record<
    EvaluatorDomain,
    {
      strengths: string[];
      narrative: string;
    }
  >;
  practiceNext: string[];
};

const EVALUATOR_DOMAINS: EvaluatorDomain[] = [
  "communication",
  "history",
  "examination",
  "reasoning",
  "management",
];
const MAX_TRANSCRIPT_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 1_500;
const MAX_LIST_ITEMS = 12;
const MAX_STRENGTHS_PER_DOMAIN = 4;

export async function POST(request: Request) {
  // Development-only legacy comparison utility. The active student report
  // route renders persisted canonical faculty artifacts and never calls this.
  if (process.env.NODE_ENV === "production") {
    return Response.json({ success: false, error: "not_found" }, { status: 404 });
  }
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!isReportRequest(payload)) {
    return Response.json(
      { success: false, error: "invalid_report_request" },
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

  const coveredChecklistItems = normalizeStringList(
    payload.coveredChecklistItems,
    Number.POSITIVE_INFINITY,
  );
  const grading = evaluateEncounter({
    caseId: payload.caseId,
    coveredChecklistItems,
  });
  const timeline = buildTimeline({
    caseData,
    transcript,
    encounterEvents: payload.encounterEvents ?? [],
    examinationsViewed: payload.examinationsViewed ?? [],
  });

  try {
    const provider = getAIProvider();
    const providerResponse = await provider.generateText({
      systemPrompt: REPORT_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 1_200,
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            buildReportContext({
              caseData,
              request: payload,
              transcript,
              timeline,
              grading,
              coveredChecklistItems,
            }),
            null,
            2,
          ),
        },
      ],
    });
    const aiOutput = parseAndValidateReportAiOutput(providerResponse.text);

    if (!aiOutput) {
      return Response.json(
        { success: false, error: "invalid_report_response" },
        { status: 502 },
      );
    }

    const report = buildStructuredReport({
      caseData,
      coveredChecklistItems,
      request: payload,
      transcript,
      timeline,
      grading,
      aiOutput,
    });

    return Response.json({ success: true, report });
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.message.toLowerCase().includes("timed out");

    return Response.json(
      {
        success: false,
        error: isTimeout ? "report_timeout" : "report_generation_failed",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

function isReportRequest(payload: unknown): payload is ReportRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ReportRequest>;

  return (
    typeof candidate.caseId === "string" &&
    Array.isArray(candidate.conversationHistory) &&
    candidate.conversationHistory.every(isTranscriptMessage) &&
    isOptionalStringArray(candidate.coveredChecklistItems) &&
    isOptionalStringArray(candidate.coveredFacts) &&
    isOptionalStringArray(candidate.examinationsViewed) &&
    isOptionalEncounterEventArray(candidate.encounterEvents) &&
    isOptionalString(candidate.completedAt)
  );
}

function isTranscriptMessage(
  message: unknown,
): message is ReportTranscriptMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ReportTranscriptMessage>;

  return (
    (candidate.role === "student" || candidate.role === "patient") &&
    typeof candidate.text === "string" &&
    isOptionalString(candidate.timestamp)
  );
}

function isOptionalEncounterEventArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every(isReportEncounterEvent))
  );
}

function isReportEncounterEvent(value: unknown): value is ReportEncounterEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReportEncounterEvent>;

  return (
    typeof candidate.type === "string" &&
    isOptionalString(candidate.label) &&
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

function normalizeTranscript(
  messages: ReportTranscriptMessage[],
): ReportTranscriptMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, MAX_MESSAGE_LENGTH),
      timestamp: normalizeOptionalString(message.timestamp),
    }))
    .filter((message) => message.text.length > 0)
    .slice(-MAX_TRANSCRIPT_MESSAGES);
}

function normalizeStringList(value: unknown, limit = MAX_LIST_ITEMS) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildReportContext({
  caseData,
  request,
  transcript,
  timeline,
  grading,
  coveredChecklistItems,
}: {
  caseData: CaseData;
  request: ReportRequest;
  transcript: ReportTranscriptMessage[];
  timeline: ReportTimelineEvent[];
  grading: ChecklistEvaluation;
  coveredChecklistItems: string[];
}) {
  return {
    instruction:
      "Write only the AI-owned prose fields in the requested JSON schema. Deterministic scores, missed items, critical misses, diagnosis, management, transcript, and timeline are authoritative.",
    case: {
      id: caseData.metadata.id,
      title: caseData.metadata.title,
      chiefComplaint: caseData.metadata.chiefComplaint,
      patientProfile: caseData.patient,
    },
    completedAt: request.completedAt ?? null,
    transcript,
    timeline,
    encounterEvidence: {
      coveredChecklistItems,
      coveredFacts: normalizeStringList(request.coveredFacts),
      examinationsViewed: normalizeStringList(request.examinationsViewed),
    },
    deterministicGrading: grading,
    deterministicDomainScaffold: buildDeterministicDomainSections(grading),
    checklistDefinitions: {
      patient: caseData.patientChecklist.map((item) => ({
        id: item.id,
        label: item.label,
        domain: item.domain,
        weight: item.weight,
        critical: item.critical ?? false,
        covered: coveredChecklistItems.includes(item.id),
      })),
      clinical: caseData.clinicalChecklist.map((item) => ({
        id: item.id,
        label: item.label,
        domain: item.domain,
        weight: item.weight,
        critical: item.critical ?? false,
        covered: coveredChecklistItems.includes(item.id),
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
    practicePrioritiesInOrder: buildPracticePrioritySources({
      caseData,
      grading,
    }),
  };
}

function buildStructuredReport({
  caseData,
  coveredChecklistItems,
  request,
  transcript,
  timeline,
  grading,
  aiOutput,
}: {
  caseData: CaseData;
  coveredChecklistItems: string[];
  request: ReportRequest;
  transcript: ReportTranscriptMessage[];
  timeline: ReportTimelineEvent[];
  grading: ChecklistEvaluation;
  aiOutput: ReportAiOutput;
}): StructuredCaseReport {
  return {
    case: {
      caseId: caseData.metadata.id,
      title: caseData.metadata.title,
      patientName: caseData.patient.name,
      chiefComplaint: caseData.metadata.chiefComplaint,
      completedAt:
        normalizeOptionalString(request.completedAt) ??
        getLatestTimestamp([...transcript, ...timeline]),
    },
    overallPerformance: {
      score: grading.overall,
      summary: aiOutput.overallPerformance.summary,
      mainTakeaway: aiOutput.overallPerformance.mainTakeaway,
    },
    domains: buildFinalDomainSections({
      caseData,
      coveredChecklistItems,
      grading,
      aiOutput,
    }),
    clinicalReasoning: {
      expectedDiagnosis: caseData.supportingInfo.diagnosis,
      differentialDiagnosis: caseData.supportingInfo.differentialDiagnosis,
      supportingFindings: normalizeStringList(request.coveredFacts),
      keyRedFlags: caseData.supportingInfo.redFlags,
    },
    management: {
      requiredInvestigations: caseData.supportingInfo.requiredInvestigations,
      treatmentExpectations: caseData.supportingInfo.treatmentExpectations,
      referralExpectations: caseData.supportingInfo.referralExpectations,
      safetyNettingExpectations: caseData.supportingInfo.safetyNettingExpectations,
    },
    practiceNext: aiOutput.practiceNext,
    transcript,
    timeline,
    grading,
  };
}

function buildFinalDomainSections({
  caseData,
  coveredChecklistItems,
  grading,
  aiOutput,
}: {
  caseData: CaseData;
  coveredChecklistItems: string[];
  grading: ChecklistEvaluation;
  aiOutput: ReportAiOutput;
}) {
  const coveredIds = new Set(coveredChecklistItems);

  return Object.fromEntries(
    EVALUATOR_DOMAINS.map((domain) => {
      const section = grading.domains[domain];
      const aiSection = aiOutput.domains[domain];
      const completedCriteria = [
        ...caseData.patientChecklist,
        ...caseData.clinicalChecklist,
      ]
        .filter((item) => item.domain === domain && coveredIds.has(item.id))
        .map((item) => item.label);

      return [
        domain,
        {
          score: section.score,
          completed: section.completed,
          total: section.total,
          earnedWeight: section.earnedWeight,
          availableWeight: section.availableWeight,
          completedCriteria,
          strengths: aiSection.strengths,
          missedOrIncomplete: section.missed,
          narrative: aiSection.narrative,
          criticalMisses: section.criticalMisses,
        },
      ];
    }),
  ) as Record<EvaluatorDomain, ReportDomainSection>;
}

function buildDeterministicDomainSections(grading: ChecklistEvaluation) {
  return Object.fromEntries(
    EVALUATOR_DOMAINS.map((domain) => {
      const section = grading.domains[domain];

      return [
        domain,
        {
          score: section.score,
          completed: section.completed,
          total: section.total,
          earnedWeight: section.earnedWeight,
          availableWeight: section.availableWeight,
          missedOrIncomplete: section.missed,
          criticalMisses: section.criticalMisses,
        },
      ];
    }),
  );
}

function buildPracticePrioritySources({
  caseData,
  grading,
}: {
  caseData: CaseData;
  grading: ChecklistEvaluation;
}) {
  const criticalMisses = uniqueStrings(
    EVALUATOR_DOMAINS.flatMap((domain) => grading.domains[domain].criticalMisses),
  );
  const lowestDomainMisses = EVALUATOR_DOMAINS.filter(
    (domain) => grading.domains[domain].total > 0,
  )
    .sort((first, second) => {
      const scoreDelta = grading.domains[first].score - grading.domains[second].score;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return (
        grading.domains[second].availableWeight -
        grading.domains[first].availableWeight
      );
    })
    .flatMap((domain) => grading.domains[domain].missed.slice(0, 2));

  return uniqueStrings([
    ...criticalMisses,
    ...lowestDomainMisses,
    ...caseData.supportingInfo.learningObjectives,
    ...caseData.supportingInfo.managementExpectations,
    ...caseData.supportingInfo.referralExpectations,
    ...caseData.supportingInfo.safetyNettingExpectations,
  ]).slice(0, 10);
}

function buildTimeline({
  caseData,
  transcript,
  encounterEvents,
  examinationsViewed,
}: {
  caseData: CaseData;
  transcript: ReportTranscriptMessage[];
  encounterEvents: ReportEncounterEvent[];
  examinationsViewed: string[];
}): ReportTimelineEvent[] {
  const transcriptEvents = transcript.map((message) => ({
    type: message.role === "student" ? "student_message" : "patient_message",
    label: message.role === "student" ? "Student message" : "Patient response",
    timestamp: message.timestamp,
  }));
  const encounterTimeline = encounterEvents
    .filter((event) => event.type.trim().length > 0)
    .map((event) => ({
      type: event.type.trim(),
      label: normalizeOptionalString(event.label) ?? labelForEvent(event, caseData),
      timestamp: normalizeOptionalString(event.timestamp),
    }));
  const examinationsAlreadyInEvents = new Set(
    encounterEvents
      .map((event) => getEventExaminationId(event))
      .filter((id): id is string => Boolean(id)),
  );
  const examinationEvents = normalizeStringList(
    examinationsViewed,
    Number.POSITIVE_INFINITY,
  )
    .filter((id) => !examinationsAlreadyInEvents.has(id))
    .map((id) => ({
      type: "examination_viewed",
      label: `Viewed ${labelForExamination(id, caseData)}`,
    }));

  return sortTimelineByTimestamp([
    ...transcriptEvents,
    ...encounterTimeline,
    ...examinationEvents,
  ]);
}

function labelForEvent(event: ReportEncounterEvent, caseData: CaseData) {
  const examinationId = getEventExaminationId(event);

  if (examinationId) {
    return `Viewed ${labelForExamination(examinationId, caseData)}`;
  }

  switch (event.type) {
    case "examination_opened":
      return "Opened examination tools";
    case "examination_viewed":
      return "Viewed examination material";
    case "finish_consultation":
      return "Finished consultation";
    case "student_message_sent":
      return "Student message sent";
    case "patient_response_generated":
      return "Patient response generated";
    default:
      return titleCaseEventType(event.type);
  }
}

function getEventExaminationId(event: ReportEncounterEvent) {
  const directId = event.examinationId;

  if (typeof directId === "string" && directId.trim()) {
    return directId.trim();
  }

  if (event.payload && typeof event.payload === "object") {
    const payload = event.payload as Record<string, unknown>;
    const payloadId = payload.examinationId ?? payload.examId ?? payload.id;

    if (typeof payloadId === "string" && payloadId.trim()) {
      return payloadId.trim();
    }
  }

  return undefined;
}

function labelForExamination(examinationId: string, caseData: CaseData) {
  return (
    caseData.assets.examinations.find((asset) => asset.id === examinationId)
      ?.title ?? examinationId
  );
}

function sortTimelineByTimestamp(events: ReportTimelineEvent[]) {
  return events
    .map((event, index) => ({ event, index, time: timestampToTime(event.timestamp) }))
    .sort((first, second) => {
      if (first.time === null && second.time === null) {
        return first.index - second.index;
      }

      if (first.time === null) {
        return 1;
      }

      if (second.time === null) {
        return -1;
      }

      return first.time - second.time || first.index - second.index;
    })
    .map(({ event }) => event);
}

function timestampToTime(timestamp: string | undefined) {
  if (!timestamp) {
    return null;
  }

  const time = Date.parse(timestamp);

  return Number.isFinite(time) ? time : null;
}

function getLatestTimestamp(
  entries: Array<{ timestamp?: string }>,
): string | undefined {
  return entries
    .map((entry) => entry.timestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((first, second) => Date.parse(second) - Date.parse(first))[0];
}

function parseAndValidateReportAiOutput(text: string): ReportAiOutput | null {
  const parsed = parseJsonObject(text);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const overall = normalizeOverallPerformance(candidate.overallPerformance);
  const domains = normalizeAiDomains(candidate.domains);
  const practiceNext = normalizeStringList(candidate.practiceNext, 3);

  if (!overall || !domains || practiceNext.length !== 3) {
    return null;
  }

  return {
    overallPerformance: overall,
    domains,
    practiceNext,
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

function normalizeOverallPerformance(
  value: unknown,
): ReportAiOutput["overallPerformance"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const summary = normalizeRequiredString(candidate.summary);
  const mainTakeaway = normalizeRequiredString(candidate.mainTakeaway);

  if (!summary || !mainTakeaway) {
    return null;
  }

  return { summary, mainTakeaway };
}

function normalizeAiDomains(value: unknown): ReportAiOutput["domains"] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const entries = EVALUATOR_DOMAINS.map((domain) => {
    const domainValue = candidate[domain];

    if (!domainValue || typeof domainValue !== "object") {
      return null;
    }

    const domainCandidate = domainValue as Record<string, unknown>;
    const narrative = normalizeRequiredString(domainCandidate.narrative);

    if (!narrative) {
      return null;
    }

    return [
      domain,
      {
        strengths: normalizeStringList(
          domainCandidate.strengths,
          MAX_STRENGTHS_PER_DOMAIN,
        ),
        narrative,
      },
    ] as const;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  const validEntries = entries.filter(
    (
      entry,
    ): entry is readonly [
      EvaluatorDomain,
      { readonly strengths: string[]; readonly narrative: string },
    ] => entry !== null,
  );

  return Object.fromEntries(validEntries) as ReportAiOutput["domains"];
}

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function titleCaseEventType(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
