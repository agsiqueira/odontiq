import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildEncounterDocument } from "../src/lib/encounter/encounterDocumentBuilder";
import {
  EncounterSyncConflictError,
  EncounterSyncService,
} from "../src/lib/persistence/services/encounterSyncService";
import type { EncounterDocument } from "../src/lib/encounter/encounterDocument";

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function document(updatedAt: string, message = "Initial message") {
  return buildEncounterDocument({
    serverEncounterId: "encounter-1",
    caseId: "case-01",
    encounterVersion: 1,
    messages: [
      {
        id: "message-1",
        role: "student",
        text: message,
        timestamp: updatedAt,
      },
    ],
    examinationIds: [],
    lifecycleEvents: [],
    disclosedFacts: [],
    coveredChecklistItemIds: [],
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt,
  });
}

async function main() {
  let serverRevision = 1;
  let serverDocument: EncounterDocument | undefined;
  let saves = 0;
  let networkUnavailable = false;
  const transport = {
    async load() {
      return {
        revision: serverRevision,
        document: serverDocument ?? null,
      };
    },
    async save(input: {
      revision: number;
      document: EncounterDocument;
    }) {
      saves += 1;
      if (networkUnavailable) throw new Error("network_unavailable");
      if (input.revision !== serverRevision) {
        throw new EncounterSyncConflictError();
      }
      serverRevision += 1;
      serverDocument = {
        ...input.document,
        encounterVersion: serverRevision,
      };
      return { revision: serverRevision };
    },
  };
  const service = new EncounterSyncService({
    encounterId: "encounter-1",
    revision: 1,
    debounceMs: 10,
    retryMs: 1_000,
    transport,
  });

  service.schedule(document("2026-07-12T10:01:00.000Z"));
  assert.equal(saves, 0, "scheduled changes must be debounced");
  await delay(30);
  assert.equal(saves, 1, "initial debounced save must persist");
  assert.equal(service.getState().revision, 2);

  service.schedule(document("2026-07-12T10:02:00.000Z", "Updated message"));
  service.schedule(document("2026-07-12T10:02:00.000Z", "Updated message"));
  await delay(30);
  assert.equal(saves, 2, "identical meaningful updates must save once");
  assert.equal(serverDocument?.messages[0]?.text, "Updated message");
  const refreshedDocument = JSON.parse(
    JSON.stringify(serverDocument),
  ) as EncounterDocument;
  assert.deepEqual(refreshedDocument, serverDocument);
  const refreshedService = new EncounterSyncService({
    encounterId: "encounter-1",
    revision: serverRevision,
    transport,
  });
  assert.deepEqual(
    await refreshedService.load(),
    serverDocument,
    "refresh must restore the latest synchronized document",
  );

  networkUnavailable = true;
  await assert.rejects(() =>
    service.flush(document("2026-07-12T10:03:00.000Z", "Offline message")),
  );
  assert.equal(service.getState().status, "network-error");
  assert.equal(service.getState().pending, true);
  assert.equal(serverDocument?.messages[0]?.text, "Updated message");
  networkUnavailable = false;
  await service.retry();
  assert.equal(serverDocument?.messages[0]?.text, "Offline message");
  assert.equal(service.getState().status, "synced");

  const staleService = new EncounterSyncService({
    encounterId: "encounter-1",
    revision: 1,
    debounceMs: 10,
    transport,
  });
  const beforeConflict = JSON.stringify(serverDocument);
  await assert.rejects(
    () =>
      staleService.flush(
        document("2026-07-12T10:04:00.000Z", "Stale overwrite"),
      ),
    EncounterSyncConflictError,
  );
  assert.equal(staleService.getState().status, "conflict");
  assert.equal(JSON.stringify(serverDocument), beforeConflict);

  const finalDocument = document(
    "2026-07-12T10:05:00.000Z",
    "Final learner message",
  );
  await service.flush(finalDocument);
  assert.equal(serverDocument?.messages[0]?.text, "Final learner message");
  assert.equal(service.getState().pending, false);

  const route = await readFile(
    "src/app/api/encounters/[encounterId]/route.ts",
    "utf8",
  );
  const encounterComponent = await readFile(
    "src/components/EncounterExperience.tsx",
    "utf8",
  );
  assert(route.includes("export async function GET"));
  assert(route.includes("export async function PATCH"));
  assert(route.includes("status: 409"));
  const completion = encounterComponent.slice(
    encounterComponent.indexOf("const completeConsultation"),
    encounterComponent.indexOf("const requestFinishConsultation"),
  );
  assert(completion.indexOf("syncService.flush") < completion.indexOf("/complete"));

  service.destroy();
  refreshedService.destroy();
  staleService.destroy();
  console.log("Encounter-sync validation passed.");
}

void main();
