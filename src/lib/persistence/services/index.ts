import "server-only";

import { userRepository } from "@/lib/persistence/repositories/userRepository";
import { UserService } from "@/lib/persistence/services/userService";

export const userService = new UserService(userRepository);
