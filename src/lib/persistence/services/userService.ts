import type { AppUser } from "@/lib/persistence/repositories/userRepository";

export type UserRepositoryContract = {
  upsertByClerkUserId(clerkUserId: string): Promise<AppUser>;
};

export class UserService {
  constructor(private readonly users: UserRepositoryContract) {}

  resolveAuthenticatedUser(clerkUserId: string) {
    return this.users.upsertByClerkUserId(clerkUserId);
  }
}
