import "server-only";

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

  upsertByClerkUserId(clerkUserId: string): Promise<AppUser> {
    return db.user.upsert({
      where: { clerkUserId },
      update: {},
      create: { clerkUserId },
    });
  }
}

export const userRepository = new UserRepository();
