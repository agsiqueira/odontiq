export type ReadinessRepositoryContract = {
  checkDatabaseConnection(): Promise<void>;
};

export class ReadinessService {
  constructor(private readonly readiness: ReadinessRepositoryContract) {}

  checkDatabaseConnection() {
    return this.readiness.checkDatabaseConnection();
  }
}
