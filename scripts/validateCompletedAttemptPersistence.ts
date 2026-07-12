import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CompletedAttemptOwnershipError,
  CompletedAttemptService,
  type CompletedAttemptPersistenceInput,
} from "../src/lib/persistence/services/completedAttemptService";
import {
  selectRetainedAttemptIds,
  shouldPreserveValidCompletedAttempt,
} from "../src/lib/persistence/repositories/completedAttemptPolicy";

type StoredAttempt = CompletedAttemptPersistenceInput & {
  userId: string;
  createdOrder: number;
};

class MemoryAttemptRepository {
  readonly attempts = new Map<string, StoredAttempt>();
  private order = 0;

  async persistBundle(input: CompletedAttemptPersistenceInput & { userId: string }) {
    const key = `${input.userId}:${input.attemptId}`;
    const existing = this.attempts.get(key);
    const preserve = shouldPreserveValidCompletedAttempt({
      generationStatus: existing?.generationStatus,
      integrityStatus: existing?.integrityStatus,
      hasEvaluation: existing?.evaluation !== undefined,
      hasScore: existing?.score !== undefined,
      hasReport: existing?.report !== undefined,
    });
    const stored = preserve
      ? existing!
      : {
          ...existing,
          ...input,
          createdOrder: existing?.createdOrder ?? ++this.order,
        };
    this.attempts.set(key, stored);

    const sameCase = [...this.attempts.entries()]
      .filter(
        ([, attempt]) =>
          attempt.userId === input.userId && attempt.caseId === input.caseId,
      )
      .sort(([, left], [, right]) => right.createdOrder - left.createdOrder);
    const keep = new Set(
      selectRetainedAttemptIds(
        key,
        sameCase.map(([attemptKey]) => attemptKey),
      ),
    );
    for (const [attemptKey] of sameCase) {
      if (!keep.has(attemptKey)) this.attempts.delete(attemptKey);
    }
    return stored;
  }
}

const encounter = {
  id: "encounter-1",
  userId: "user-1",
  caseId: "case-01",
  status: "COMPLETED",
};
const encounterRepository = {
  async findOwnedById(userId: string, encounterId: string) {
    return encounter.userId === userId && encounter.id === encounterId
      ? encounter
      : null;
  },
};

function input(
  attemptId: string,
  overrides: Partial<CompletedAttemptPersistenceInput> = {},
): CompletedAttemptPersistenceInput {
  return {
    encounterId: encounter.id,
    caseId: encounter.caseId,
    attemptId,
    generationStatus: "PENDING",
    integrityStatus: "PENDING",
    passed: false,
    ...overrides,
  };
}

async function main() {
  const repository = new MemoryAttemptRepository();
  const service = new CompletedAttemptService(repository, encounterRepository);

  await service.persistCompletion("user-1", input("attempt-1"));
  assert.equal(repository.attempts.size, 1);
  await service.persistCompletion(
    "user-1",
    input("attempt-1", { generationStatus: "IN_PROGRESS" }),
  );
  assert.equal(repository.attempts.size, 1);

  const artifacts = {
    generationStatus: "COMPLETE" as const,
    integrityStatus: "VALID" as const,
    percentage: 92,
    passed: true,
    evaluation: { status: "complete", evaluations: [1] },
    score: { percentage: 92 },
    report: { overallScore: 92 },
  };
  await service.persistCanonicalArtifacts(
    "user-1",
    input("attempt-1", artifacts),
  );
  const completed = repository.attempts.get("user-1:attempt-1");
  assert.deepEqual(completed?.evaluation, artifacts.evaluation);
  assert.deepEqual(completed?.score, artifacts.score);
  assert.deepEqual(completed?.report, artifacts.report);

  await service.persistGenerationFailure(
    "user-1",
    input("failed-attempt", {
      generationError: "technical_failure",
      integrityStatus: "INVALID",
    }),
  );
  const failed = repository.attempts.get("user-1:failed-attempt");
  assert.equal(failed?.generationStatus, "FAILED");
  assert.equal(failed?.score, undefined);
  assert.equal(failed?.report, undefined);
  await service.retryCanonicalGeneration(
    "user-1",
    input("failed-attempt", artifacts),
  );
  assert.equal(
    repository.attempts.get("user-1:failed-attempt")?.generationStatus,
    "COMPLETE",
  );

  await service.persistGenerationFailure(
    "user-1",
    input("attempt-1", {
      generationError: "stale_failure",
      integrityStatus: "INVALID",
    }),
  );
  assert.equal(
    repository.attempts.get("user-1:attempt-1")?.generationStatus,
    "COMPLETE",
  );
  assert.equal(repository.attempts.get("user-1:attempt-1")?.percentage, 92);

  await assert.rejects(
    () => service.persistCompletion("user-2", input("foreign-attempt")),
    CompletedAttemptOwnershipError,
  );

  const retentionRepository = new MemoryAttemptRepository();
  const retentionService = new CompletedAttemptService(
    retentionRepository,
    encounterRepository,
  );
  for (let index = 1; index <= 11; index += 1) {
    await retentionService.persistCompletion(
      "user-1",
      input(`retained-${index}`),
    );
  }
  const retainedCaseOne = [...retentionRepository.attempts.values()].filter(
    (attempt) => attempt.caseId === "case-01",
  );
  assert.equal(retainedCaseOne.length, 10);
  assert(!retentionRepository.attempts.has("user-1:retained-1"));
  assert(retentionRepository.attempts.has("user-1:retained-11"));

  encounter.caseId = "case-02";
  await retentionService.persistCompletion(
    "user-1",
    input("other-case", { caseId: "case-02" }),
  );
  assert.equal(
    [...retentionRepository.attempts.values()].filter(
      (attempt) => attempt.caseId === "case-01",
    ).length,
    10,
  );
  assert(retentionRepository.attempts.has("user-1:other-case"));

  const route = await readFile(
    "src/app/api/completed-attempts/[attemptId]/route.ts",
    "utf8",
  );
  const client = await readFile(
    "src/lib/persistence/completedAttemptClient.ts",
    "utf8",
  );
  assert(route.includes("requireAppUser()"));
  assert(!route.includes("input.userId"));
  assert(client.includes("odontiq") === false);

  console.log("Completed-attempt persistence validation passed.");
}

void main();
