import "server-only";

import { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class FacultyArtifactRepository {
  upsertEvaluation(
    tx: TransactionClient,
    completedAttemptId: string,
    data: unknown,
  ) {
    return tx.facultyEvaluation.upsert({
      where: { completedAttemptId },
      create: { completedAttemptId, data: json(data) },
      update: { data: json(data) },
    });
  }

  upsertScore(
    tx: TransactionClient,
    completedAttemptId: string,
    data: unknown,
  ) {
    return tx.facultyScore.upsert({
      where: { completedAttemptId },
      create: { completedAttemptId, data: json(data) },
      update: { data: json(data) },
    });
  }

  upsertReport(
    tx: TransactionClient,
    completedAttemptId: string,
    data: unknown,
  ) {
    return tx.facultyReport.upsert({
      where: { completedAttemptId },
      create: { completedAttemptId, data: json(data) },
      update: { data: json(data) },
    });
  }
}

export const facultyArtifactRepository = new FacultyArtifactRepository();
