import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { DatabaseCircuitBreaker } from "../src/lib/persistence/databaseResilience";
import { UserService } from "../src/lib/persistence/services/userService";

type TestUser = {
  id: string;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

class AtomicUserRepository {
  private readonly users = new Map<string, TestUser>();
  private nextId = 1;
  private queue = Promise.resolve();
  reads = 0;
  writes = 0;

  seed(clerkUserId: string) {
    const now = new Date();
    const user = { id: `user-${this.nextId++}`, clerkUserId, createdAt: now, updatedAt: now };
    this.users.set(clerkUserId, user);
    return user;
  }

  async findByClerkUserId(clerkUserId: string) {
    this.reads += 1;
    return this.users.get(clerkUserId) ?? null;
  }

  createByClerkUserId(clerkUserId: string) {
    const operation = this.queue.then(() => {
      const existing = this.users.get(clerkUserId);
      if (existing) return existing;
      this.writes += 1;
      return this.seed(clerkUserId);
    });
    this.queue = operation.then(() => undefined);
    return operation;
  }
}

async function main() {
  const users = new AtomicUserRepository();
  const existing = users.seed("clerk-existing-user");
  const service = new UserService(users, new DatabaseCircuitBreaker());
  const resolved = await service.resolveAuthenticatedUser(existing.clerkUserId);
  assert.equal(resolved.id, existing.id);
  assert.equal(users.reads, 1);
  assert.equal(users.writes, 0, "existing users must not execute a database write");

  const created = await service.resolveAuthenticatedUser("clerk-first-login");
  assert.equal(created.clerkUserId, "clerk-first-login", "Clerk identity must remain authoritative");
  assert.equal(users.writes, 1, "first login provisions exactly one application user");

  const concurrentUsers = new AtomicUserRepository();
  const concurrentService = new UserService(
    concurrentUsers,
    new DatabaseCircuitBreaker(),
  );
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      concurrentService.resolveAuthenticatedUser("concurrent-clerk-user"),
    ),
  );
  assert.equal(concurrentUsers.writes, 1);
  assert.equal(new Set(concurrent.map((user) => user.id)).size, 1);

  let transientCalls = 0;
  const retryDelays: number[] = [];
  let clock = 0;
  const transientService = new UserService(
    {
      async findByClerkUserId(clerkUserId: string) {
        transientCalls += 1;
        if (transientCalls < 3) {
          throw Object.assign(new Error("temporary database outage"), { code: "P1001" });
        }
        const now = new Date();
        return { id: "user-retried", clerkUserId, createdAt: now, updatedAt: now };
      },
      async createByClerkUserId() {
        throw new Error("create_not_expected");
      },
    },
    new DatabaseCircuitBreaker({ now: () => clock }),
    async (delayMs) => {
      retryDelays.push(delayMs);
      clock += delayMs;
    },
    () => clock,
  );
  assert.equal(
    (await transientService.resolveAuthenticatedUser("retry-user")).id,
    "user-retried",
  );
  assert.deepEqual(retryDelays, [300, 1_000]);
  assert.equal(transientCalls, 3);

  let nonTransientCalls = 0;
  const nonTransientService = new UserService(
    {
      async findByClerkUserId() {
        nonTransientCalls += 1;
        throw Object.assign(new Error("invalid query"), { code: "P2003" });
      },
      async createByClerkUserId() {
        throw new Error("create_not_expected");
      },
    },
    new DatabaseCircuitBreaker(),
    async () => assert.fail("non-transient errors must not sleep or retry"),
  );
  await assert.rejects(() => nonTransientService.resolveAuthenticatedUser("invalid"));
  assert.equal(nonTransientCalls, 1);

  const route = await readFile("src/app/api/me/route.ts", "utf8");
  const helper = await readFile("src/lib/requireAppUser.ts", "utf8");
  const proxy = await readFile("src/proxy.ts", "utf8");
  const repository = await readFile(
    "src/lib/persistence/repositories/userRepository.ts",
    "utf8",
  );

  assert.match(route, /requireAppUser\(\)/);
  assert.doesNotMatch(route, /request\.|searchParams|params\b/);
  assert.match(helper, /await auth\(\)/);
  assert.match(helper, /if \(!clerkAuth\.userId\)/);
  assert.match(repository, /db\.user\.findUnique/);
  assert.match(repository, /db\.user\.create/);
  assert.doesNotMatch(repository, /db\.user\.upsert/);
  assert.doesNotMatch(proxy, /["']\/api\/me["']/);

  console.log("App-user resolution validation passed.");
}

void main();
