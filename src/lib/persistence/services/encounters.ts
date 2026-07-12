import "server-only";

import {
  ActiveEncounterAlreadyExistsError,
  encounterRepository,
} from "@/lib/persistence/repositories/encounterRepository";
import { EncounterService } from "@/lib/persistence/services/encounterService";

export const encounterService = new EncounterService(
  encounterRepository,
  (error) => error instanceof ActiveEncounterAlreadyExistsError,
);
