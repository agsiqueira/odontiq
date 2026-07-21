import assert from "node:assert/strict";

import {
  readCompletedEncounterAttempt,
  setLocalEncounterUserScope,
  writeCompletedEncounterAttempt,
  type CompletedEncounterAttempt,
} from "../src/lib/localEncounter";
import { persistCompletedAttemptToServer } from "../src/lib/persistence/completedAttemptClient";

const values = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  },
});
setLocalEncounterUserScope("reconciliation-user");

const completedAt = "2026-07-20T14:30:00.000Z";
const summary: CompletedEncounterAttempt = {
  attemptId: "stable-attempt-1",
  caseId: "case-01",
  conversationHistory: [
    { id: "s1", role: "student", text: "Where does it hurt?", timestamp: completedAt },
    { id: "p1", role: "patient", text: "My lower-left tooth hurts.", timestamp: completedAt },
  ],
  coveredFacts: ["pain-location"],
  coveredChecklistItems: ["location"],
  encounterEvents: [{ type: "finish_consultation_clicked", timestamp: completedAt }],
  examinationsViewed: [],
  savedAt: completedAt,
  lifecycleStatus: "completed",
  facultyRubricScore: { percentage: 88, passStatus: "pass" } as never,
  metadata: { createdAt: completedAt, updatedAt: completedAt, completedAt },
  persistence: { status: "pending-sync", attempts: 0, updatedAt: completedAt },
};
writeCompletedEncounterAttempt(summary);

const refreshed = readCompletedEncounterAttempt(summary.caseId, summary.attemptId);
assert.equal(refreshed?.persistence.status, "pending-sync");
assert.equal(refreshed?.attemptId, summary.attemptId);

const serverAttempts = new Set<string>();
let serverCreates = 0;
let artifactWrites = 0;
Object.assign(globalThis, {
  fetch: async (url: string, init?: RequestInit) => {
    if (url.endsWith("/reconcile")) {
      const request = JSON.parse(String(init?.body)) as { document: { attemptId: string } };
      const duplicate = serverAttempts.has(request.document.attemptId);
      if (!duplicate) {
        serverAttempts.add(request.document.attemptId);
        serverCreates += 1;
      }
      return Response.json({
        success: true,
        encounterId: "server-encounter-1",
        duplicate,
      });
    }
    artifactWrites += 1;
    return Response.json({ success: true });
  },
});

const [first, coalesced] = await Promise.all([
  persistCompletedAttemptToServer(summary),
  persistCompletedAttemptToServer(summary),
]);
assert.equal(first.persistence.status, "synced");
assert.equal(coalesced.attemptId, first.attemptId);
assert.equal(first.attemptId, summary.attemptId);
assert.equal(first.metadata?.completedAt, completedAt);
assert.equal(first.facultyRubricScore?.percentage, 88);
assert.equal(serverCreates, 1);
assert.equal(artifactWrites, 1);

await persistCompletedAttemptToServer(first);
assert.equal(serverCreates, 1, "repeated reconciliation is idempotent on attemptId");
assert.equal(artifactWrites, 2, "artifact upsert remains safe to repeat");

const conflictSummary: CompletedEncounterAttempt = {
  ...summary,
  attemptId: "conflict-attempt",
  serverEncounterId: "newer-server-encounter",
};
writeCompletedEncounterAttempt(conflictSummary);
Object.assign(globalThis, {
  fetch: async (url: string) =>
    url.endsWith("/reconcile")
      ? Response.json({ error: "reconciliation_conflict" }, { status: 409 })
      : Response.json({ success: true }),
});
await assert.rejects(() => persistCompletedAttemptToServer(conflictSummary));
assert.equal(
  readCompletedEncounterAttempt("case-01", "conflict-attempt")?.persistence.status,
  "conflict",
);

console.log("Completion reconciliation validation passed.");
