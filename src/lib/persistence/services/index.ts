import "server-only";

import { userRepository } from "@/lib/persistence/repositories/userRepository";
import { UserService } from "@/lib/persistence/services/userService";
import { databaseCircuitBreaker } from "@/lib/persistence/services/databaseCircuit";

export const userService = new UserService(
  userRepository,
  databaseCircuitBreaker,
);
