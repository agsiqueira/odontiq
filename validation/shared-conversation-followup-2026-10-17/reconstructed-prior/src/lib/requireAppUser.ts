import "server-only";

import { auth } from "@clerk/nextjs/server";

import { userService } from "@/lib/persistence/services";

export async function requireAppUser() {
  const clerkAuth = await auth();

  if (!clerkAuth.userId) {
    return clerkAuth.redirectToSignIn();
  }

  return userService.resolveAuthenticatedUser(clerkAuth.userId);
}
