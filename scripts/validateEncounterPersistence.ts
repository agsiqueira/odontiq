import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  EncounterNotFoundError,
  EncounterService,
  type EncounterRepositoryContract,
} from "../src/lib/persistence/services/encounterService";
import type { PersistedEncounter } from "../src/lib/persistence/repositories/encounterRepository";
import type { EncounterDocument } from "../src/lib/encounter/encounterDocument";

class ActiveConflict extends Error {}

class MemoryEncounterRepository implements EncounterRepositoryContract {
  readonly encounters: PersistedEncounter[] = [];
  private nextId = 1;
  private creationQueue = Promise.resolve();

  async findActiveByUserAndCase(userId: string, caseId: string) {
    return (
      this.encounters.find(
        (item) =>
          item.userId === userId &&
          item.caseId === caseId &&
          item.status === "ACTIVE",
      ) ?? null
    );
  }

  async findOwnedById(userId: string, encounterId: string) {
    return (
      this.encounters.find(
        (item) => item.id === encounterId && item.userId === userId,
      ) ?? null
    );
  }

  async createActive(userId: string, caseId: string) {
    const operation = this.creationQueue.then(async () => {
      if (await this.findActiveByUserAndCase(userId, caseId)) {
        throw new ActiveConflict();
      }
      const now = new Date();
      const encounter: PersistedEncounter = {
        id: `encounter-${this.nextId++}`,
        userId,
        caseId,
        status: "ACTIVE",
        version: 1,
        encounterData: {},
        createdAt: now,
        updatedAt: now,
      };
      this.encounters.push(encounter);
      return encounter;
    });
    this.creationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async pauseActiveByUserAndCase(userId: string, caseId: string) {
    let count = 0;
    for (const encounter of this.encounters) {
      if (encounter.userId === userId && encounter.caseId === caseId && encounter.status === "ACTIVE") {
        encounter.status = "PAUSED";
        encounter.updatedAt = new Date();
        count += 1;
      }
    }
    return count;
  }

  async markCompleted(userId: string, encounterId: string) {
    const encounter = await this.findOwnedById(userId, encounterId);
    if (encounter?.status === "ACTIVE") {
      encounter.status = "COMPLETED";
      encounter.updatedAt = new Date();
    }
    return encounter;
  }

  async updateDocumentIfRevision(
    userId: string,
    encounterId: string,
    revision: number,
    encounterData: EncounterDocument,
  ) {
    const encounter = await this.findOwnedById(userId, encounterId);
    if (!encounter || encounter.version !== revision) return null;
    encounter.encounterData = JSON.parse(JSON.stringify(encounterData));
    encounter.version += 1;
    encounter.updatedAt = new Date();
    return encounter;
  }
}

async function main() {
  const repository = new MemoryEncounterRepository();
  const service = new EncounterService(
    repository,
    (error) => error instanceof ActiveConflict,
  );

  const first = await service.getOrCreateActiveEncounter("user-1", "case-01");
  const reopened = await service.getOrCreateActiveEncounter("user-1", "case-01");
  assert.equal(reopened.id, first.id);

  const concurrentRepository = new MemoryEncounterRepository();
  const concurrentService = new EncounterService(
    concurrentRepository,
    (error) => error instanceof ActiveConflict,
  );
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      concurrentService.getOrCreateActiveEncounter("user-1", "case-02"),
    ),
  );
  assert.equal(new Set(concurrent.map((item) => item.id)).size, 1);
  assert.equal(concurrentRepository.encounters.length, 1);

  await assert.rejects(
    () => service.completeEncounter("user-2", first.id),
    EncounterNotFoundError,
  );
  const completed = await service.completeEncounter("user-1", first.id);
  assert.equal(completed.id, first.id);
  assert.equal(completed.status, "COMPLETED");
  const completedAgain = await service.completeEncounter("user-1", first.id);
  assert.equal(completedAgain.id, first.id);
  assert.equal(completedAgain.status, "COMPLETED");

  const retry = await service.getOrCreateActiveEncounter("user-1", "case-01");
  assert.notEqual(retry.id, first.id);
  assert.equal(first.status, "COMPLETED");
  assert.equal(repository.encounters.length, 2);

  const fresh = await service.startFreshEncounter("user-1", "case-01");
  assert.notEqual(fresh.id, retry.id);
  assert.equal(retry.status, "PAUSED");
  assert.equal(completed.status, "COMPLETED", "completed attempts remain untouched");

  const encounterSource = await readFile(
    "src/components/EncounterExperience.tsx",
    "utf8",
  );
  const startRoute = await readFile(
    "src/app/api/encounters/start/route.ts",
    "utf8",
  );
  const completeRoute = await readFile(
    "src/app/api/encounters/[encounterId]/complete/route.ts",
    "utf8",
  );
  const migration = await readFile(
    "prisma/migrations/20260712230000_unique_active_encounter_per_user_case/migration.sql",
    "utf8",
  );

  assert(encounterSource.includes("serverEncounterId"));
  assert(encounterSource.includes('fetch("/api/encounters/start"'));
  assert(encounterSource.includes("/complete`"));
  assert(startRoute.includes("requireAppUser()"));
  assert(completeRoute.includes("requireAppUser()"));
  assert(!startRoute.includes("userId"));
  assert.match(migration, /UNIQUE INDEX[\s\S]+WHERE "status" = 'ACTIVE'/);

  console.log("Encounter persistence validation passed.");
}

void main();
