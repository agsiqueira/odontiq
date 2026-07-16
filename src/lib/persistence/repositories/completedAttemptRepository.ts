import "server-only";

import {
  ArtifactIntegrityStatus,
  ReportGenerationStatus,
} from "@prisma/client";

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
}

export const completedAttemptRepository = new CompletedAttemptRepository();
