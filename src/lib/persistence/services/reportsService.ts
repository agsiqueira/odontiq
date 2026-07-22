type DashboardAttempt = {
  attemptId: string;
  caseId: string;
  generationStatus: string;
  integrityStatus: string;
  percentage: number | null;
  passed: boolean;
  completedAt: Date | null;
};

type ReportAttempt = DashboardAttempt & {
  generationStartedAt?: Date | null;
  generationError?: string | null;
  encounter: { encounterData: unknown };
  facultyEvaluation: { data: unknown } | null;
  facultyScore: { data: unknown } | null;
  facultyReport: { data: unknown } | null;
};

export type ReportsRepositoryContract = {
  listByUser(userId: string): Promise<DashboardAttempt[]>;
  findOwnedByAttemptId(
    userId: string,
    attemptId: string,
  ): Promise<ReportAttempt | null>;
};

export class ReportAttemptNotFoundError extends Error {}

export class ReportsService {
  constructor(private readonly attempts: ReportsRepositoryContract) {}

  async getDashboard(userId: string) {
    const attempts = await this.attempts.listByUser(userId);
    const newestByCase = new Map<string, DashboardAttempt>();
    for (const attempt of attempts) {
      if (!newestByCase.has(attempt.caseId)) {
        newestByCase.set(attempt.caseId, attempt);
      }
    }
    return [...newestByCase.values()].map((attempt) => ({
      caseId: attempt.caseId,
      latestAttemptId: attempt.attemptId,
      generationStatus: attempt.generationStatus,
      integrityStatus: attempt.integrityStatus,
      percentage: attempt.percentage,
      passed: attempt.passed,
      completedAt: attempt.completedAt?.toISOString() ?? null,
    }));
  }

  async getReport(userId: string, attemptId: string) {
    const attempt = await this.attempts.findOwnedByAttemptId(userId, attemptId);
    if (!attempt) throw new ReportAttemptNotFoundError();
    const encounterDocument = isEncounterDocument(attempt.encounter.encounterData)
      ? attempt.encounter.encounterData
      : undefined;

    return {
      caseId: attempt.caseId,
      generationStatus: attempt.generationStatus,
      integrityStatus: attempt.integrityStatus,
      generationStartedAt: attempt.generationStartedAt?.toISOString() ?? null,
      generationError: attempt.generationError ?? null,
      evaluation: attempt.facultyEvaluation?.data ?? null,
      score: attempt.facultyScore?.data ?? null,
      report: attempt.facultyReport?.data ?? null,
      transcript: encounterDocument?.messages.map((message) => ({ ...message })) ?? [],
    };
  }
}
import { isEncounterDocument } from "../../encounter/encounterDocument";
