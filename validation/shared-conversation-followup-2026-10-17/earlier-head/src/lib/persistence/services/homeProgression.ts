import "server-only";

import { completedAttemptRepository } from "@/lib/persistence/repositories/completedAttemptRepository";
import { encounterRepository } from "@/lib/persistence/repositories/encounterRepository";
import { HomeProgressionService } from "@/lib/persistence/services/homeProgressionService";
import { CASES } from "@/lib/cases";

export const homeProgressionService = new HomeProgressionService(
  completedAttemptRepository,
  encounterRepository,
  CASES.map((patientCase) => patientCase.id),
);
