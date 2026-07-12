import "server-only";

import { completedAttemptRepository } from "@/lib/persistence/repositories/completedAttemptRepository";
import { encounterRepository } from "@/lib/persistence/repositories/encounterRepository";
import { CompletedAttemptService } from "@/lib/persistence/services/completedAttemptService";

export const completedAttemptService = new CompletedAttemptService(
  completedAttemptRepository,
  encounterRepository,
);
