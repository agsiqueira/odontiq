import { isEncounterDocument } from "../../encounter/encounterDocument";

export type CompletedAttemptPersistenceInput = {
  encounterId: string;
  caseId: string;
  attemptId: string;
  generationStatus: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "FAILED";
  generationError?: string;
  integrityStatus: "PENDING" | "VALID" | "INVALID";
  percentage?: number;
  passed: boolean;
  completedAt?: Date;
  evaluation?: unknown;
  score?: unknown;
  report?: unknown;
};

type OwnedEncounter = {
  id: string;
  userId: string;
  caseId: string;
  status: string;
  encounterData?: unknown;
};

export type CompletedAttemptRepositoryContract = {
  persistBundle(input: CompletedAttemptPersistenceInput & { userId: string }): Promise<unknown>;
};

export type EncounterOwnershipRepositoryContract = {
  findOwnedById(userId: string, encounterId: string): Promise<OwnedEncounter | null>;
};

export class CompletedAttemptOwnershipError extends Error {}

export class CompletedAttemptService {
  constructor(
    private readonly attempts: CompletedAttemptRepositoryContract,
    private readonly encounters: EncounterOwnershipRepositoryContract,
  ) {}

  persistCompletion(userId: string, input: CompletedAttemptPersistenceInput) {
    return this.persist(userId, input);
  }

  persistGenerationFailure(userId: string, input: CompletedAttemptPersistenceInput) {
    return this.persist(userId, { ...input, generationStatus: "FAILED" });
  }

  persistCanonicalArtifacts(userId: string, input: CompletedAttemptPersistenceInput) {
    return this.persist(userId, { ...input, generationStatus: "COMPLETE" });
  }

  retryCanonicalGeneration(userId: string, input: CompletedAttemptPersistenceInput) {
    return this.persist(userId, input);
  }

  private async persist(userId: string, input: CompletedAttemptPersistenceInput) {
    const encounter = await this.encounters.findOwnedById(userId, input.encounterId);
    if (
      !encounter ||
      encounter.caseId !== input.caseId ||
      encounter.status !== "COMPLETED" ||
      (isEncounterDocument(encounter.encounterData) &&
        encounter.encounterData.attemptId !== input.attemptId)
    ) {
      throw new CompletedAttemptOwnershipError();
    }
    return this.attempts.persistBundle({ ...input, userId });
  }
}
