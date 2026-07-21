import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/persistence/repositories/prisma";

export type AppUser = {
  id: string;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export class UserRepository {
  findById(id: string): Promise<AppUser | null> {
    return db.user.findUnique({ where: { id } });
  }

  findByClerkUserId(clerkUserId: string): Promise<AppUser | null> {
    return db.user.findUnique({ where: { clerkUserId } });
  }

  async createByClerkUserId(clerkUserId: string): Promise<AppUser> {
    try {
      return await db.user.create({ data: { clerkUserId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return db.user.findUniqueOrThrow({ where: { clerkUserId } });
      }
      throw error;
    }
  }
}

export const userRepository = new UserRepository();
