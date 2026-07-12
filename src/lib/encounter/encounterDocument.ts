import type { ChecklistCoverageEvidence } from "@/lib/checklistCoverage";
import type { ConversationMessage } from "@/lib/conversationEngine";
import type { LocalEncounterEvent } from "@/lib/localEncounter";

export const ENCOUNTER_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type EncounterDocument = {
  schemaVersion: typeof ENCOUNTER_DOCUMENT_SCHEMA_VERSION;
  serverEncounterId?: string;
  caseId: string;
  attemptId?: string;
  encounterVersion: number;
  messages: ConversationMessage[];
  examinations: string[];
  lifecycleEvents: LocalEncounterEvent[];
  disclosedFacts: string[];
  checklistCoverage: {
    itemIds: string[];
    evidence: ChecklistCoverageEvidence[];
  };
  timing: {
    activeDurationMs: number;
    pausedDurationMs: number;
    startedAt?: string;
    completedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export function isEncounterDocument(value: unknown): value is EncounterDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<EncounterDocument>;
  return (
    candidate.schemaVersion === ENCOUNTER_DOCUMENT_SCHEMA_VERSION &&
    typeof candidate.caseId === "string" &&
    typeof candidate.encounterVersion === "number" &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.examinations) &&
    Array.isArray(candidate.lifecycleEvents) &&
    Array.isArray(candidate.disclosedFacts) &&
    Boolean(candidate.checklistCoverage) &&
    Array.isArray(candidate.checklistCoverage?.itemIds) &&
    Array.isArray(candidate.checklistCoverage?.evidence) &&
    Boolean(candidate.timing) &&
    typeof candidate.timing?.activeDurationMs === "number" &&
    typeof candidate.timing?.pausedDurationMs === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}
