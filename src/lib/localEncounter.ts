import type { ConversationMessage } from "@/lib/conversationEngine";
import type { ChecklistCoverageEvidence } from "@/lib/checklistCoverage";
import type { MentorGuidanceCategory } from "@/lib/mentorIntervention";
import type { FacultyRubricEvaluationState } from "@/lib/facultyRubric/evaluation/state";
import type {
  FacultyReport,
  FacultyRubricScore,
} from "@/lib/facultyRubric";

export const COMPLETED_ENCOUNTERS_STORAGE_KEY = "odontiq:completedEncounters";
export const ENCOUNTER_SNAPSHOTS_STORAGE_KEY = "odontiq:encounterSnapshots";
export const MAX_COMPLETED_ATTEMPTS_PER_CASE = 10;

export type EncounterLifecycleStatus =
  | "not-started"
  | "in-progress"
  | "paused"
  | "completed";

export type LocalEncounterEvent = {
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

export type LocalEncounterSummary = {
  caseId: string;
  serverEncounterId?: string;
  serverEncounterRevision?: number;
  conversationHistory: ConversationMessage[];
  coveredFacts: string[];
  coveredChecklistItems: string[];
  coverageEvidence?: ChecklistCoverageEvidence[];
  encounterEvents: LocalEncounterEvent[];
  examinationsViewed: string[];
  savedAt: string;
  lifecycleStatus?: EncounterLifecycleStatus;
  activeDurationMs?: number;
  pausedDurationMs?: number;
  facultyRubricEvaluation?: FacultyRubricEvaluationState;
  facultyRubricScore?: FacultyRubricScore;
  facultyReport?: FacultyReport;
  facultyReportGeneration?: {
    status: "pending" | "in-progress" | "complete" | "failed";
    attemptId: string;
    startedAt: string;
    updatedAt: string;
    error?: string;
  };
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
  };
};

export type CompletedEncounterAttempt = LocalEncounterSummary & {
  attemptId: string;
};

export type CompletedEncounterStore = Record<
  string,
  CompletedEncounterAttempt[]
>;

export type MentorInterventionState = {
  evaluated: boolean;
  shown: boolean;
  shownAt?: string;
  missingCategories: MentorGuidanceCategory[];
  promptKey?: string;
  promptText?: string;
  guidanceCardVisible: boolean;
  audioPlayed: boolean;
};

export type LocalEncounterSnapshot = LocalEncounterSummary & {
  lifecycleStatus: Extract<
    EncounterLifecycleStatus,
    "in-progress" | "paused"
  >;
  currentView: {
    communicationMode: "voice" | "text";
    activePanel: "controls" | "conversation" | "examination" | "viewer";
    selectedExaminationId?: string;
    isInputFocused?: boolean;
  };
  draftQuestion?: string;
  timers: {
    activeDurationMs: number;
    pausedDurationMs: number;
    activeSegmentStartedAt?: string;
    pausedAt?: string;
  };
  mentorIntervention?: MentorInterventionState;
  metadata: {
    createdAt: string;
    updatedAt: string;
    resumedAt?: string;
  };
};

export type EncounterSnapshotIndex = Record<string, LocalEncounterSnapshot>;

export function createCompletedEncounterAttemptId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `encounter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readCompletedEncounterStore(): CompletedEncounterStore {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(COMPLETED_ENCOUNTERS_STORAGE_KEY);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as unknown;
    return isCompletedEncounterStore(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readCompletedEncounterAttempt(
  caseId: string,
  attemptId?: string,
) {
  const attempts = readCompletedEncounterStore()[caseId] ?? [];
  return attemptId
    ? attempts.find((attempt) => attempt.attemptId === attemptId) ?? null
    : attempts[0] ?? null;
}

export function writeCompletedEncounterAttempt(
  attempt: CompletedEncounterAttempt,
) {
  if (typeof window === "undefined") return;
  const store = readCompletedEncounterStore();
  const attempts = [...(store[attempt.caseId] ?? [])];
  const existingIndex = attempts.findIndex(
    (candidate) => candidate.attemptId === attempt.attemptId,
  );
  if (existingIndex >= 0) attempts[existingIndex] = attempt;
  else attempts.unshift(attempt);

  const untrimmedStore = { ...store, [attempt.caseId]: attempts };
  window.localStorage.setItem(
    COMPLETED_ENCOUNTERS_STORAGE_KEY,
    JSON.stringify(untrimmedStore),
  );
  if (attempts.length > MAX_COMPLETED_ATTEMPTS_PER_CASE) {
    window.localStorage.setItem(
      COMPLETED_ENCOUNTERS_STORAGE_KEY,
      JSON.stringify({
        ...untrimmedStore,
        [attempt.caseId]: attempts.slice(0, MAX_COMPLETED_ATTEMPTS_PER_CASE),
      }),
    );
  }
}

export function readEncounterSnapshots(): EncounterSnapshotIndex {
  if (typeof window === "undefined") {
    return {};
  }

  const storedSnapshots = window.localStorage.getItem(
    ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
  );

  if (!storedSnapshots) {
    return {};
  }

  try {
    const parsedSnapshots = JSON.parse(storedSnapshots) as unknown;

    return isEncounterSnapshotIndex(parsedSnapshots) ? parsedSnapshots : {};
  } catch {
    return {};
  }
}

export function readEncounterSnapshot(caseId: string) {
  return readEncounterSnapshots()[caseId] ?? null;
}

export function writeEncounterSnapshot(snapshot: LocalEncounterSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshots = readEncounterSnapshots();

  snapshots[snapshot.caseId] = snapshot;
  window.localStorage.setItem(
    ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
    JSON.stringify(snapshots),
  );
}

export function removeEncounterSnapshot(caseId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshots = readEncounterSnapshots();
  delete snapshots[caseId];
  window.localStorage.setItem(
    ENCOUNTER_SNAPSHOTS_STORAGE_KEY,
    JSON.stringify(snapshots),
  );
}

export function writeEncounterSnapshotServerRevision(
  caseId: string,
  serverEncounterId: string,
  serverEncounterRevision: number,
) {
  const snapshot = readEncounterSnapshot(caseId);
  if (!snapshot || snapshot.serverEncounterId !== serverEncounterId) return;
  writeEncounterSnapshot({
    ...snapshot,
    serverEncounterRevision,
  });
}

function isEncounterSnapshotIndex(
  value: unknown,
): value is EncounterSnapshotIndex {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isEncounterSnapshot);
}

function isCompletedEncounterStore(
  value: unknown,
): value is CompletedEncounterStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([caseId, attempts]) =>
      Array.isArray(attempts) &&
      attempts.every(
        (attempt) =>
          Boolean(attempt) &&
          typeof attempt === "object" &&
          (attempt as Partial<CompletedEncounterAttempt>).caseId === caseId &&
          typeof (attempt as Partial<CompletedEncounterAttempt>).attemptId ===
            "string" &&
          typeof (attempt as Partial<CompletedEncounterAttempt>).savedAt ===
            "string",
      ),
  );
}

function isEncounterSnapshot(value: unknown): value is LocalEncounterSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<LocalEncounterSnapshot>;

  return (
    typeof snapshot.caseId === "string" &&
    (snapshot.lifecycleStatus === "in-progress" ||
      snapshot.lifecycleStatus === "paused") &&
    Array.isArray(snapshot.conversationHistory) &&
    Array.isArray(snapshot.coveredFacts) &&
    Array.isArray(snapshot.coveredChecklistItems) &&
    Array.isArray(snapshot.encounterEvents) &&
    Array.isArray(snapshot.examinationsViewed) &&
    typeof snapshot.savedAt === "string" &&
    Boolean(snapshot.currentView) &&
    Boolean(snapshot.timers) &&
    Boolean(snapshot.metadata)
  );
}
