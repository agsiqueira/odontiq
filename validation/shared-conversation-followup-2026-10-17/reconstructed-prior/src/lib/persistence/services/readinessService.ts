export type ReadinessRepositoryContract = {
  checkDatabaseConnection(): Promise<void>;
};

export class ReadinessService {
  constructor(
    private readonly readiness: ReadinessRepositoryContract,
    private readonly circuit = new DatabaseCircuitBreaker(),
  ) {}

  checkDatabaseConnection() {
    return executeIdempotentDatabaseRead({
      operation: () => this.readiness.checkDatabaseConnection(),
      circuit: this.circuit,
    });
  }
}
import {
  DatabaseCircuitBreaker,
  executeIdempotentDatabaseRead,
} from "../databaseResilience";
