import type { PersistedEncounter } from "@/lib/persistence/repositories/encounterRepository";

export type EncounterRepositoryContract = {
  findActiveByUserAndCase(
    userId: string,
    caseId: string,
  ): Promise<PersistedEncounter | null>;
  findOwnedById(
    userId: string,
    encounterId: string,
  ): Promise<PersistedEncounter | null>;
  createActive(userId: string, caseId: string): Promise<PersistedEncounter>;
  markCompleted(
    userId: string,
    encounterId: string,
  ): Promise<PersistedEncounter | null>;
};

export class EncounterNotFoundError extends Error {}

export class EncounterService {
  constructor(
    private readonly encounters: EncounterRepositoryContract,
    private readonly isActiveConflict: (error: unknown) => boolean,
  ) {}

  async getOrCreateActiveEncounter(userId: string, caseId: string) {
    const existing = await this.encounters.findActiveByUserAndCase(userId, caseId);
    if (existing) return existing;

    try {
      return await this.encounters.createActive(userId, caseId);
    } catch (error) {
      if (!this.isActiveConflict(error)) throw error;
      const concurrent = await this.encounters.findActiveByUserAndCase(
        userId,
        caseId,
      );
      if (concurrent) return concurrent;
      throw error;
    }
  }

  async completeEncounter(userId: string, encounterId: string) {
    const owned = await this.encounters.findOwnedById(userId, encounterId);
    if (!owned) throw new EncounterNotFoundError();
    if (owned.status === "COMPLETED") return owned;

    const completed = await this.encounters.markCompleted(userId, encounterId);
    if (!completed) throw new EncounterNotFoundError();
    return completed;
  }
}
