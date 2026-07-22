import "server-only";

import {
  ArtifactIntegrityStatus,
  EncounterStatus,
  Prisma,
  ReportGenerationStatus,
} from "@prisma/client";
import type { EncounterDocument } from "@/lib/encounter/encounterDocument";

import { db } from "@/lib/persistence/repositories/prisma";
import { facultyArtifactRepository } from "@/lib/persistence/repositories/facultyArtifactRepository";
import {
  selectRetainedAttemptIds,
} from "@/lib/persistence/repositories/completedAttemptPolicy";

export type PersistAttemptBundle = {
  userId: string;
  encounterId: string;
  caseId: string;
  attemptId: string;
  generationStatus: keyof typeof ReportGenerationStatus;
  generationError?: string;
  integrityStatus: keyof typeof ArtifactIntegrityStatus;
  percentage?: number;
  passed: boolean;
  completedAt?: Date;
  evaluation?: unknown;
  score?: unknown;
  report?: unknown;
};

export type ClaimReportGenerationInput = {
  userId: string;
  attemptId: string;
  generationAttemptId: string;
  expectedUpdatedAt: Date;
  staleBefore: Date;
  allowInvalidCompleteReclaim: boolean;
};

export class CompletedAttemptRepository {
  findOwnedByAttemptId(userId: string, attemptId: string) {
    return db.completedAttempt.findUnique({
      where: { userId_attemptId: { userId, attemptId } },
      include: {
        encounter: { select: { encounterData: true } },
        facultyEvaluation: true,
        facultyScore: true,
        facultyReport: true,
      },
    });
  }

  listByUserAndCase(userId: string, caseId: string) {
    return db.completedAttempt.findMany({
      where: { userId, caseId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  listByUser(userId: string) {
    return db.completedAttempt.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async reconcileLocalCompletion(input: {
    userId: string;
    attemptId: string;
    caseId: string;
    preferredEncounterId?: string;
    completedAt: Date;
    document: EncounterDocument;
  }) {
    const existing = await this.findOwnedByAttemptId(input.userId, input.attemptId);
    if (existing) return { attempt: existing, duplicate: true };

    try {
      return await db.$transaction(async (tx) => {
        let encounterId: string;

        if (input.preferredEncounterId) {
          const encounter = await tx.encounter.findFirst({
            where: { id: input.preferredEncounterId, userId: input.userId },
          });
          const storedDocument = encounter?.encounterData as {
            attemptId?: unknown;
          } | null;
          if (
            !encounter ||
            encounter.caseId !== input.caseId
          ) {
            throw new CompletedAttemptReconciliationConflictError();
          }
          if (storedDocument?.attemptId !== input.attemptId) {
            if (
              encounter.status !== EncounterStatus.ACTIVE ||
              encounter.version !== input.document.encounterVersion
            ) {
              throw new CompletedAttemptReconciliationConflictError();
            }
            const guardedWrite = await tx.encounter.updateMany({
              where: {
                id: encounter.id,
                userId: input.userId,
                status: EncounterStatus.ACTIVE,
                version: input.document.encounterVersion,
              },
              data: {
                encounterData: {
                  ...input.document,
                  serverEncounterId: encounter.id,
                  encounterVersion: input.document.encounterVersion + 1,
                } as unknown as Prisma.InputJsonValue,
                version: { increment: 1 },
              },
            });
            if (guardedWrite.count !== 1) {
              throw new CompletedAttemptReconciliationConflictError();
            }
          }
          await tx.encounter.update({
            where: { id: encounter.id },
            data: { status: EncounterStatus.COMPLETED },
          });
          encounterId = encounter.id;
        } else {
          const encounter = await tx.encounter.create({
            data: {
              userId: input.userId,
              caseId: input.caseId,
              status: EncounterStatus.COMPLETED,
              encounterData: input.document as unknown as Prisma.InputJsonValue,
            },
          });
          const storedDocument = {
            ...input.document,
            serverEncounterId: encounter.id,
          } as unknown as Prisma.InputJsonValue;
          await tx.encounter.update({
            where: { id: encounter.id },
            data: { encounterData: storedDocument },
          });
          encounterId = encounter.id;
        }

        const attempt = await tx.completedAttempt.create({
          data: {
            userId: input.userId,
            attemptId: input.attemptId,
            encounterId,
            caseId: input.caseId,
            generationStatus: "PENDING",
            integrityStatus: "PENDING",
            passed: false,
            completedAt: input.completedAt,
          },
        });
        return { attempt, duplicate: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await this.findOwnedByAttemptId(
          input.userId,
          input.attemptId,
        );
        if (duplicate) return { attempt: duplicate, duplicate: true };
      }
      throw error;
    }
  }

  async persistBundle(input: PersistAttemptBundle) {
    return db.$transaction(async (tx) => {
      const attempt = await tx.completedAttempt.upsert({
        where: {
          userId_attemptId: {
            userId: input.userId,
            attemptId: input.attemptId,
          },
        },
        create: {
          attemptId: input.attemptId,
          userId: input.userId,
          encounterId: input.encounterId,
          caseId: input.caseId,
          generationStatus: "PENDING",
          integrityStatus: "PENDING",
          passed: false,
        },
        update: {},
      });
      const guardedUpdate = await tx.completedAttempt.updateMany({
        where: {
          id: attempt.id,
          ...(input.generationStatus === "PENDING"
            ? { generationStatus: { not: "IN_PROGRESS" as const } }
            : {}),
          NOT: {
            generationStatus: "COMPLETE",
            integrityStatus: "VALID",
          },
        },
        data: {
          generationStatus: input.generationStatus,
          generationError: input.generationError,
          integrityStatus: input.integrityStatus,
          percentage: input.percentage,
          passed: input.passed,
          completedAt: input.completedAt,
        },
      });
      const mayWrite = guardedUpdate.count === 1;

      if (mayWrite && input.evaluation !== undefined) {
        await facultyArtifactRepository.upsertEvaluation(
          tx,
          attempt.id,
          input.evaluation,
        );
      }
      if (mayWrite && input.score !== undefined) {
        await facultyArtifactRepository.upsertScore(tx, attempt.id, input.score);
      }
      if (mayWrite && input.report !== undefined) {
        await facultyArtifactRepository.upsertReport(tx, attempt.id, input.report);
      }

      const attempts = await tx.completedAttempt.findMany({
        where: { userId: input.userId, caseId: input.caseId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      const keepIds = selectRetainedAttemptIds(
        attempt.id,
        attempts.map((candidate) => candidate.id),
      );
      await tx.completedAttempt.deleteMany({
        where: {
          userId: input.userId,
          caseId: input.caseId,
          id: { notIn: keepIds },
        },
      });

      return tx.completedAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: {
          facultyEvaluation: true,
          facultyScore: true,
          facultyReport: true,
        },
      });
    });
  }

  async claimReportGeneration(input: ClaimReportGenerationInput) {
    const claimableStatuses: Prisma.CompletedAttemptWhereInput[] = [
      { generationStatus: { in: ["PENDING", "FAILED"] } },
      {
        generationStatus: "IN_PROGRESS",
        OR: [
          { generationStartedAt: null },
          { generationStartedAt: { lt: input.staleBefore } },
        ],
      },
    ];
    if (input.allowInvalidCompleteReclaim) {
      claimableStatuses.push({ generationStatus: "COMPLETE" });
    }

    const result = await db.completedAttempt.updateMany({
      where: {
        userId: input.userId,
        attemptId: input.attemptId,
        updatedAt: input.expectedUpdatedAt,
        OR: claimableStatuses,
      },
      data: {
        generationStatus: "IN_PROGRESS",
        generationAttemptId: input.generationAttemptId,
        generationStartedAt: new Date(),
        generationError: null,
        integrityStatus: "PENDING",
      },
    });
    return result.count === 1;
  }

  async completeClaimedReportGeneration(
    input: PersistAttemptBundle & { generationAttemptId: string },
  ) {
    return db.$transaction(async (tx) => {
      const guardedUpdate = await tx.completedAttempt.updateMany({
        where: {
          userId: input.userId,
          attemptId: input.attemptId,
          generationStatus: "IN_PROGRESS",
          generationAttemptId: input.generationAttemptId,
        },
        data: {
          generationStatus: "COMPLETE",
          generationAttemptId: null,
          generationStartedAt: null,
          generationError: null,
          integrityStatus: input.integrityStatus,
          percentage: input.percentage,
          passed: input.passed,
          completedAt: input.completedAt,
        },
      });
      if (guardedUpdate.count !== 1) return false;
      const attempt = await tx.completedAttempt.findUniqueOrThrow({
        where: {
          userId_attemptId: {
            userId: input.userId,
            attemptId: input.attemptId,
          },
        },
      });
      if (input.evaluation !== undefined) {
        await facultyArtifactRepository.upsertEvaluation(tx, attempt.id, input.evaluation);
      }
      if (input.score !== undefined) {
        await facultyArtifactRepository.upsertScore(tx, attempt.id, input.score);
      }
      if (input.report !== undefined) {
        await facultyArtifactRepository.upsertReport(tx, attempt.id, input.report);
      }
      return true;
    });
  }

  async failClaimedReportGeneration(input: {
    userId: string;
    attemptId: string;
    generationAttemptId: string;
    error: string;
  }) {
    const result = await db.completedAttempt.updateMany({
      where: {
        userId: input.userId,
        attemptId: input.attemptId,
        generationStatus: "IN_PROGRESS",
        generationAttemptId: input.generationAttemptId,
      },
      data: {
        generationStatus: "FAILED",
        generationAttemptId: null,
        generationStartedAt: null,
        generationError: input.error,
        integrityStatus: "INVALID",
      },
    });
    return result.count === 1;
  }
}

export class CompletedAttemptReconciliationConflictError extends Error {}

export const completedAttemptRepository = new CompletedAttemptRepository();
