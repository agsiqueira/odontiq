export type GenerationOwnershipResult<T> =
  | { status: "in-progress" }
  | { status: "complete"; value: T };

export async function runWithGenerationOwnership<T>({
  claim,
  generate,
  releaseAfterFailure,
}: {
  claim: () => Promise<boolean>;
  generate: () => Promise<T>;
  releaseAfterFailure: (error: unknown) => Promise<void>;
}): Promise<GenerationOwnershipResult<T>> {
  if (!(await claim())) return { status: "in-progress" };
  try {
    return { status: "complete", value: await generate() };
  } catch (error) {
    await releaseAfterFailure(error).catch(() => undefined);
    throw error;
  }
}

export function isGenerationLeaseActive({
  status,
  startedAt,
  now,
  leaseMs,
}: {
  status: string;
  startedAt: Date | string | null;
  now: number;
  leaseMs: number;
}) {
  if (status !== "IN_PROGRESS" || !startedAt) return false;
  const timestamp =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  return Number.isFinite(timestamp) && now - timestamp < leaseMs;
}

export function getGenerationDisposition({
  artifactsValid,
  status,
  startedAt,
  now,
  leaseMs,
}: {
  artifactsValid: boolean;
  status: string;
  startedAt: Date | string | null;
  now: number;
  leaseMs: number;
}): "complete" | "in-progress" | "claim" {
  if (artifactsValid) return "complete";
  return isGenerationLeaseActive({ status, startedAt, now, leaseMs })
    ? "in-progress"
    : "claim";
}

export async function waitForGenerationCompletion<T extends { status: string }>({
  load,
  sleep,
  isCancelled,
  maxChecks,
}: {
  load: () => Promise<T>;
  sleep: () => Promise<void>;
  isCancelled: () => boolean;
  maxChecks: number;
}): Promise<T | null> {
  for (let check = 0; check < maxChecks && !isCancelled(); check += 1) {
    await sleep();
    if (isCancelled()) return null;
    const result = await load();
    if (result.status === "complete") return result;
    if (result.status === "failed" || result.status === "pending") {
      throw new Error("server_report_generation_failed");
    }
  }
  if (isCancelled()) return null;
  throw new Error("server_report_generation_timeout");
}
