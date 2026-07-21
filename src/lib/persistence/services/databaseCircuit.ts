import "server-only";

import { DatabaseCircuitBreaker } from "../databaseResilience";

export const databaseCircuitBreaker = new DatabaseCircuitBreaker();
