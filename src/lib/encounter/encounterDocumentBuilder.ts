import type { ChecklistCoverageEvidence } from "@/lib/checklistCoverage";
import type { ConversationMessage } from "@/lib/conversationEngine";
import {
  ENCOUNTER_DOCUMENT_SCHEMA_VERSION,
  type EncounterDocument,
} from "./encounterDocument";
import type { LocalEncounterEvent } from "@/lib/localEncounter";

export type BuildEncounterDocumentInput = {
  serverEncounterId?: string;
  caseId: string;
  attemptId?: string;
  encounterVersion: number;
  messages: readonly ConversationMessage[];
  examinationIds: readonly string[];
  lifecycleEvents: readonly LocalEncounterEvent[];
  disclosedFacts: readonly string[];
  coveredChecklistItemIds: readonly string[];
  coverageEvidence?: readonly ChecklistCoverageEvidence[];
  activeDurationMs?: number;
  pausedDurationMs?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function buildEncounterDocument(
  input: BuildEncounterDocumentInput,
): EncounterDocument {
  return {
    schemaVersion: ENCOUNTER_DOCUMENT_SCHEMA_VERSION,
    ...(input.serverEncounterId === undefined
      ? {}
      : { serverEncounterId: input.serverEncounterId }),
    caseId: input.caseId,
    ...(input.attemptId === undefined ? {} : { attemptId: input.attemptId }),
    encounterVersion: input.encounterVersion,
    messages: input.messages.map((message) => ({ ...message })),
    examinations: [...input.examinationIds],
    lifecycleEvents: input.lifecycleEvents.map((event) => ({
      type: event.type,
      timestamp: event.timestamp,
      ...(event.payload === undefined
        ? {}
        : { payload: cloneRecord(event.payload) }),
    })),
    disclosedFacts: [...input.disclosedFacts],
    checklistCoverage: {
      itemIds: [...input.coveredChecklistItemIds],
      evidence: (input.coverageEvidence ?? []).map((evidence) => ({
        ...evidence,
      })),
    },
    timing: {
      activeDurationMs: input.activeDurationMs ?? 0,
      pausedDurationMs: input.pausedDurationMs ?? 0,
      ...(input.startedAt === undefined ? {} : { startedAt: input.startedAt }),
      ...(input.completedAt === undefined
        ? {}
        : { completedAt: input.completedAt }),
    },
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function cloneRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
  );
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return cloneRecord(value as Record<string, unknown>);
  }
  return value;
}
