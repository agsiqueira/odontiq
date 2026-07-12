import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveAppUserByClerkId } from "../src/lib/resolveAppUser";

type TestUser = {
  id: string;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

class AtomicUserStore {
  private readonly users = new Map<string, TestUser>();
  private nextId = 1;
  private queue = Promise.resolve();

  get size() {
    return this.users.size;
  }

  upsert(args: {
    where: { clerkUserId: string };
    update: Record<string, never>;
    create: { clerkUserId: string };
  }) {
    const operation = this.queue.then(() => {
      const existing = this.users.get(args.where.clerkUserId);

      if (existing) {
        return existing;
      }

      const now = new Date();
      const user = {
        id: `user-${this.nextId++}`,
        clerkUserId: args.create.clerkUserId,
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
  const users = new AtomicUserStore();
  const first = await resolveAppUserByClerkId(users, "clerk-test-user");
  const repeated = await resolveAppUserByClerkId(users, "clerk-test-user");

  assert.equal(users.size, 1, "first resolution should create one user");
  assert.equal(repeated.id, first.id, "repeat resolution should return the same user");

  const concurrentUsers = new AtomicUserStore();
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      resolveAppUserByClerkId(concurrentUsers, "concurrent-clerk-user"),
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

  assert.match(route, /requireAppUser\(\)/, "/api/me must resolve the verified app user");
  assert.doesNotMatch(route, /request\.|searchParams|params\b/, "/api/me must not accept identity input");
  assert.match(helper, /await auth\(\)/, "the helper must use Clerk auth()");
  assert.match(helper, /if \(!clerkAuth\.userId\)/, "the helper must reject missing sessions");
  assert.doesNotMatch(proxy, /[\"']\/api\/me[\"']/, "/api/me must not be public");

  console.log("App-user resolution validation passed.");
}

void main();
