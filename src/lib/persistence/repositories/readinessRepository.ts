import "server-only";

import { db } from "@/lib/persistence/repositories/prisma";

export class ReadinessRepository {
  async checkDatabaseConnection() {
    await db.$queryRaw`SELECT 1`;
  }
}

export const readinessRepository = new ReadinessRepository();
