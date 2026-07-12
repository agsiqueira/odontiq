import "server-only";

import { EncounterStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/persistence/repositories/prisma";

export type PersistedEncounter = {
  id: string;
  userId: string;
  caseId: string;
  status: EncounterStatus;
  version: number;
  encounterData: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export class ActiveEncounterAlreadyExistsError extends Error {}

export class EncounterRepository {
  findActiveByUserAndCase(userId: string, caseId: string) {
    return db.encounter.findFirst({
      where: { userId, caseId, status: EncounterStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });
  }

  findOwnedById(userId: string, encounterId: string) {
    return db.encounter.findFirst({
      where: { id: encounterId, userId },
    });
  }

  async createActive(userId: string, caseId: string) {
    try {
      return await db.encounter.create({
        data: {
          userId,
          caseId,
          status: EncounterStatus.ACTIVE,
          encounterData: {},
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ActiveEncounterAlreadyExistsError();
      }
      throw error;
    }
  }

  async markCompleted(userId: string, encounterId: string) {
    await db.encounter.updateMany({
      where: {
        id: encounterId,
        userId,
        status: EncounterStatus.ACTIVE,
      },
      data: { status: EncounterStatus.COMPLETED },
    });

    return this.findOwnedById(userId, encounterId);
  }
}

export const encounterRepository = new EncounterRepository();
