import "server-only";

import { readinessRepository } from "@/lib/persistence/repositories/readinessRepository";
import { ReadinessService } from "@/lib/persistence/services/readinessService";

export const readinessService = new ReadinessService(readinessRepository);
