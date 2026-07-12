import "server-only";

import { completedAttemptRepository } from "@/lib/persistence/repositories/completedAttemptRepository";
import { ReportsService } from "@/lib/persistence/services/reportsService";

export const reportsService = new ReportsService(completedAttemptRepository);
