import type { ConversationMessage } from "@/lib/conversationEngine";

export const LAST_ENCOUNTER_STORAGE_KEY = "odontiq:lastEncounter";

export type LocalEncounterEvent = {
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

export type LocalEncounterSummary = {
  caseId: string;
  conversationHistory: ConversationMessage[];
  coveredFacts: string[];
  coveredChecklistItems: string[];
  encounterEvents: LocalEncounterEvent[];
  examinationsViewed: string[];
  savedAt: string;
};
