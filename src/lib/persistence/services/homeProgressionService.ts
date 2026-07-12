type ProgressionAttempt = {
  caseId: string;
  generationStatus: string;
  integrityStatus: string;
  percentage: number | null;
  passed: boolean;
};

type ActiveEncounter = {
  id: string;
  caseId: string;
  updatedAt: Date;
};

export type HomeProgressionRepositoryContract = {
  listByUser(userId: string): Promise<ProgressionAttempt[]>;
};

export type HomeEncounterRepositoryContract = {
  findLatestActiveByUser(userId: string): Promise<ActiveEncounter | null>;
};

export class HomeProgressionService {
  constructor(
    private readonly attempts: HomeProgressionRepositoryContract,
    private readonly encounters: HomeEncounterRepositoryContract,
    private readonly caseIds: readonly string[],
  ) {}

  async getProgression(userId: string) {
    const [attempts, activeEncounter] = await Promise.all([
      this.attempts.listByUser(userId),
      this.encounters.findLatestActiveByUser(userId),
    ]);
    const completedCases = this.caseIds.filter((caseId) =>
      attempts.some(
        (attempt) =>
          attempt.caseId === caseId &&
          attempt.generationStatus === "COMPLETE" &&
          attempt.integrityStatus === "VALID" &&
          attempt.passed &&
          attempt.percentage !== null &&
          attempt.percentage >= 84,
      ),
    );

    if (activeEncounter) {
      return {
        recommendedCase: null,
        activeEncounter: {
          id: activeEncounter.id,
          caseId: activeEncounter.caseId,
          updatedAt: activeEncounter.updatedAt.toISOString(),
        },
        completedCases,
        currentStatus: "resume" as const,
      };
    }
    const recommended = this.caseIds.find(
      (caseId) => !completedCases.includes(caseId),
    );
    if (recommended) {
      return {
        recommendedCase: {
          caseId: recommended,
          action: attempts.some((attempt) => attempt.caseId === recommended)
            ? ("retry" as const)
            : ("start" as const),
        },
        activeEncounter: null,
        completedCases,
        currentStatus: "recommend" as const,
      };
    }
    return {
      recommendedCase: null,
      activeEncounter: null,
      completedCases,
      currentStatus: "complete" as const,
    };
  }
}
