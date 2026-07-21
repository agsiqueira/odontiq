import type { AppUser } from "@/lib/persistence/repositories/userRepository";
import {
  DatabaseCircuitBreaker,
  executeIdempotentDatabaseRead,
  executeNonRetriedDatabaseWrite,
} from "../databaseResilience";

export type UserRepositoryContract = {
  findByClerkUserId(clerkUserId: string): Promise<AppUser | null>;
  createByClerkUserId(clerkUserId: string): Promise<AppUser>;
};

export class UserService {
  constructor(
    private readonly users: UserRepositoryContract,
    private readonly circuit = new DatabaseCircuitBreaker(),
    private readonly sleep?: (delayMs: number) => Promise<void>,
    private readonly now?: () => number,
  ) {}

  async resolveAuthenticatedUser(clerkUserId: string) {
    const existing = await executeIdempotentDatabaseRead({
      operation: () => this.users.findByClerkUserId(clerkUserId),
      circuit: this.circuit,
      ...(this.sleep ? { sleep: this.sleep } : {}),
      ...(this.now ? { now: this.now } : {}),
    });
    if (existing) return existing;

    return executeNonRetriedDatabaseWrite({
      operation: () => this.users.createByClerkUserId(clerkUserId),
      circuit: this.circuit,
    });
  }
}
