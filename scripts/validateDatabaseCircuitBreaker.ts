import assert from "node:assert/strict";

import {
  DatabaseCircuitBreaker,
  DatabaseCircuitOpenError,
  executeIdempotentDatabaseRead,
} from "../src/lib/persistence/databaseResilience";

let now = 0;
const events: string[] = [];
const circuit = new DatabaseCircuitBreaker({
  now: () => now,
  openDurationMs: 30_000,
  failureThreshold: 3,
  log: (_level, _message, fields) => events.push(String(fields.event)),
});
let failedCalls = 0;
await assert.rejects(() =>
  executeIdempotentDatabaseRead({
    circuit,
    operation: async () => {
      failedCalls += 1;
      throw Object.assign(new Error("offline"), { code: "P1001" });
    },
    sleep: async (delayMs) => {
      now += delayMs;
    },
    now: () => now,
    log: () => undefined,
  }),
);
assert.equal(failedCalls, 3);
assert.equal(circuit.getState(), "open");
assert(events.includes("circuit_open"));

await assert.rejects(
  () =>
    executeIdempotentDatabaseRead({
      circuit,
      operation: async () => "must-not-run",
      sleep: async () => undefined,
    }),
  DatabaseCircuitOpenError,
);

now += 30_000;
let recoveryCalls = 0;
const recovered = await executeIdempotentDatabaseRead({
  circuit,
  operation: async () => {
    recoveryCalls += 1;
    return "healthy";
  },
  sleep: async () => undefined,
  now: () => now,
  log: () => undefined,
});
assert.equal(recovered, "healthy");
assert.equal(recoveryCalls, 1);
assert.equal(circuit.getState(), "closed");
assert.deepEqual(
  events.filter((event) => event.startsWith("circuit_")),
  ["circuit_open", "circuit_half_open", "circuit_closed"],
);

console.log("Database circuit-breaker validation passed.");
