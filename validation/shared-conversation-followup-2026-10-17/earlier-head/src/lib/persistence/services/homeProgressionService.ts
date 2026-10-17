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
  findActiveByUserAndCase(
    userId: string,
    caseId: string,
  ): Promise<ActiveEncounter | null>;
};

export class HomeProgressionService {
  constructor(
    private readonly attempts: HomeProgressionRepositoryContract,
    private readonly encounters: HomeEncounterRepositoryContract,
    private readonly caseIds: readonly string[],
  ) {}

  async getProgression(userId: string) {
    const [attempts, activeEncountersByCase] = await Promise.all([
      this.attempts.listByUser(userId),
      Promise.all(
        this.caseIds.map((caseId) =>
          this.encounters.findActiveByUserAndCase(userId, caseId),
        ),
      ),
    ]);
    const activeEncounters = activeEncountersByCase
      .filter((encounter): encounter is ActiveEncounter => Boolean(encounter))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    const activeEncounter = activeEncounters[0] ?? null;
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
        activeEncounters: activeEncounters.map(toActiveEncounterResponse),
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
        activeEncounters: [],
        completedCases,
        currentStatus: "recommend" as const,
      };
    }
    return {
      recommendedCase: null,
      activeEncounter: null,
      activeEncounters: [],
      completedCases,
      currentStatus: "complete" as const,
    };
  }
}

function toActiveEncounterResponse(encounter: ActiveEncounter) {
  return {
    id: encounter.id,
    caseId: encounter.caseId,
    updatedAt: encounter.updatedAt.toISOString(),
  };
}
