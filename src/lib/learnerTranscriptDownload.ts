import type { ConversationMessage } from "@/lib/conversationEngine";

type LearnerTranscriptContext = {
  patientName: string;
  caseTitle: string;
  caseLabel?: string;
  completedAt?: string;
};

export function buildLearnerTranscriptText(
  context: LearnerTranscriptContext,
  transcript: ConversationMessage[],
) {
  const identity = [
    "OdontIQ Consultation Transcript",
    `Patient: ${context.patientName}`,
    `Case: ${context.caseLabel ?? context.caseTitle}`,
    context.completedAt ? `Consultation date: ${context.completedAt}` : null,
    "",
  ].filter((line): line is string => line !== null);

  const messages = transcript.flatMap((message) => [
    `${message.role === "student" ? "Provider" : "Patient"}${
      message.timestamp ? ` · ${message.timestamp}` : ""
    }`,
    message.text,
    "",
  ]);

  return [...identity, ...messages].join("\n");
}

export function buildLearnerTranscriptFilename(caseId: string) {
  const safeCaseId = caseId.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `odontiq-${safeCaseId}-transcript.txt`;
}
