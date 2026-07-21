export type DatabaseCircuitState = "closed" | "open" | "half-open";

type ResilienceLog = (
  level: "info" | "warn",
  message: string,
  fields: Record<string, unknown>,
) => void;

export class DatabaseCircuitOpenError extends Error {
  constructor() {
    super("database_circuit_open");
    this.name = "DatabaseCircuitOpenError";
  }
}

export class DatabaseCircuitBreaker {
  private state: DatabaseCircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private probeInFlight = false;

  constructor(
    private readonly options: {
      failureThreshold?: number;
      openDurationMs?: number;
      now?: () => number;
      log?: ResilienceLog;
    } = {},
  ) {}

  acquire() {
    if (this.state === "closed") return { halfOpenProbe: false };
    const now = this.now();
    const openDurationMs = this.options.openDurationMs ?? 30_000;
    if (this.state === "open" && now - this.openedAt >= openDurationMs) {
      this.state = "half-open";
      this.probeInFlight = true;
      this.log("info", "Database circuit entered half-open state.", {
        event: "circuit_half_open",
        elapsedMs: now - this.openedAt,
      });
      return { halfOpenProbe: true };
    }
    throw new DatabaseCircuitOpenError();
  }

  recordSuccess() {
    if (this.state !== "closed") {
      this.log("info", "Database circuit closed after successful probe.", {
        event: "circuit_closed",
      });
    }
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
  }

  recordTransientFailure() {
    this.consecutiveFailures += 1;
    if (
      this.state === "half-open" ||
      this.consecutiveFailures >= (this.options.failureThreshold ?? 3)
    ) {
      this.state = "open";
      this.openedAt = this.now();
      this.probeInFlight = false;
      this.log("warn", "Database circuit opened after connectivity failures.", {
        event: "circuit_open",
        consecutiveFailures: this.consecutiveFailures,
        openDurationMs: this.options.openDurationMs ?? 30_000,
      });
    }
  }

  recordNonTransientResult() {
    if (this.state === "half-open") this.recordSuccess();
  }

  getState() {
    return this.state;
  }

  private now() {
    return (this.options.now ?? Date.now)();
  }

  private log(
    level: "info" | "warn",
    message: string,
    fields: Record<string, unknown>,
  ) {
    (this.options.log ?? defaultLog)(level, message, fields);
  }
}

export async function executeIdempotentDatabaseRead<T>({
  operation,
  circuit,
  sleep = defaultSleep,
  now = Date.now,
  log = defaultLog,
}: {
  operation: () => Promise<T>;
  circuit: DatabaseCircuitBreaker;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => number;
  log?: ResilienceLog;
}) {
  const permit = circuit.acquire();
  const startedAt = now();
  const retryDelays = [300, 1_000] as const;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await operation();
      circuit.recordSuccess();
      return result;
    } catch (error) {
      if (!isP1001(error)) {
        circuit.recordNonTransientResult();
        throw error;
      }
      circuit.recordTransientFailure();
      if (permit.halfOpenProbe || attempt === 2) throw error;
      const delayMs = retryDelays[attempt];
      log("warn", "Retrying idempotent database read after P1001.", {
        event: "database_p1001_retry",
        retryCount: attempt + 1,
        elapsedMs: now() - startedAt,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  throw new Error("database_retry_exhausted");
}

export async function executeNonRetriedDatabaseWrite<T>({
  operation,
  circuit,
}: {
  operation: () => Promise<T>;
  circuit: DatabaseCircuitBreaker;
}) {
  circuit.acquire();
  try {
    const result = await operation();
    circuit.recordSuccess();
    return result;
  } catch (error) {
    if (isP1001(error)) circuit.recordTransientFailure();
    else circuit.recordNonTransientResult();
    throw error;
  }
}

export function isP1001(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P1001",
  );
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function defaultLog(
  level: "info" | "warn",
  message: string,
  fields: Record<string, unknown>,
) {
  console[level](message, fields);
}
