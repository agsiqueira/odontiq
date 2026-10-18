import "server-only";

import { readinessRepository } from "@/lib/persistence/repositories/readinessRepository";
import { ReadinessService } from "@/lib/persistence/services/readinessService";
import { databaseCircuitBreaker } from "@/lib/persistence/services/databaseCircuit";

export const readinessService = new ReadinessService(
  readinessRepository,
  databaseCircuitBreaker,
);
