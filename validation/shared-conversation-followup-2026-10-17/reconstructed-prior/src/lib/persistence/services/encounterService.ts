import type { PersistedEncounter } from "@/lib/persistence/repositories/encounterRepository";
import type { EncounterDocument } from "@/lib/encounter/encounterDocument";

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
  pauseActiveByUserAndCase(userId: string, caseId: string): Promise<number>;
  markCompleted(
    userId: string,
    encounterId: string,
  ): Promise<PersistedEncounter | null>;
  updateDocumentIfRevision(
    userId: string,
    encounterId: string,
    revision: number,
    encounterData: EncounterDocument,
  ): Promise<PersistedEncounter | null>;
};

export class EncounterNotFoundError extends Error {}
export class EncounterRevisionConflictError extends Error {}

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

  async startFreshEncounter(userId: string, caseId: string) {
    await this.encounters.pauseActiveByUserAndCase(userId, caseId);
    return this.encounters.createActive(userId, caseId);
  }

  async completeEncounter(userId: string, encounterId: string) {
    const owned = await this.encounters.findOwnedById(userId, encounterId);
    if (!owned) throw new EncounterNotFoundError();
    if (owned.status === "COMPLETED") return owned;

    const completed = await this.encounters.markCompleted(userId, encounterId);
    if (!completed) throw new EncounterNotFoundError();
    return completed;
  }

  async getOwnedEncounter(userId: string, encounterId: string) {
    const encounter = await this.encounters.findOwnedById(userId, encounterId);
    if (!encounter) throw new EncounterNotFoundError();
    return encounter;
  }

  async updateEncounterDocument(
    userId: string,
    encounterId: string,
    revision: number,
    document: EncounterDocument,
  ) {
    const owned = await this.getOwnedEncounter(userId, encounterId);
    if (owned.version !== revision) throw new EncounterRevisionConflictError();
    if (
      document.caseId !== owned.caseId ||
      document.serverEncounterId !== owned.id
    ) {
      throw new EncounterNotFoundError();
    }

    const nextRevision = revision + 1;
    const updated = await this.encounters.updateDocumentIfRevision(
      userId,
      encounterId,
      revision,
      { ...document, encounterVersion: nextRevision },
    );
    if (!updated) throw new EncounterRevisionConflictError();
    return updated;
  }
}
