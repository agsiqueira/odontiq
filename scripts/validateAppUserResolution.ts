import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

  get size() {
    return this.users.size;
  }

  upsertByClerkUserId(clerkUserId: string) {
    const operation = this.queue.then(() => {
      const existing = this.users.get(clerkUserId);

      if (existing) {
        return existing;
      }

      const now = new Date();
      const user = {
        id: `user-${this.nextId++}`,
        clerkUserId,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(user.clerkUserId, user);
      return user;
    });

    this.queue = operation.then(() => undefined);
    return operation;
  }
}

async function main() {
  const users = new AtomicUserRepository();
  const service = new UserService(users);
  const first = await service.resolveAuthenticatedUser("clerk-test-user");
  const repeated = await service.resolveAuthenticatedUser("clerk-test-user");

  assert.equal(users.size, 1, "first resolution should create one user");
  assert.equal(repeated.id, first.id, "repeat resolution should return the same user");

  const concurrentUsers = new AtomicUserRepository();
  const concurrentService = new UserService(concurrentUsers);
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      concurrentService.resolveAuthenticatedUser("concurrent-clerk-user"),
    ),
  );

  assert.equal(concurrentUsers.size, 1, "concurrent resolution should create one user");
  assert.equal(
    new Set(concurrent.map((user) => user.id)).size,
    1,
    "concurrent resolution should return one internal identity",
  );

  const route = await readFile("src/app/api/me/route.ts", "utf8");
  const helper = await readFile("src/lib/requireAppUser.ts", "utf8");
  const proxy = await readFile("src/proxy.ts", "utf8");
  const repository = await readFile(
    "src/lib/persistence/repositories/userRepository.ts",
    "utf8",
  );

  assert.match(route, /requireAppUser\(\)/, "/api/me must resolve the verified app user");
  assert.doesNotMatch(route, /request\.|searchParams|params\b/, "/api/me must not accept identity input");
  assert.match(helper, /await auth\(\)/, "the helper must use Clerk auth()");
  assert.match(helper, /if \(!clerkAuth\.userId\)/, "the helper must reject missing sessions");
  assert.match(helper, /userService\.resolveAuthenticatedUser/, "the helper must delegate to UserService");
  assert.match(repository, /db\.user\.upsert/, "UserRepository must own the Prisma upsert");
  assert.doesNotMatch(proxy, /[\"']\/api\/me[\"']/, "/api/me must not be public");

  console.log("App-user resolution validation passed.");
}

void main();
