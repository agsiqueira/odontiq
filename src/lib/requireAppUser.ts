import "server-only";

import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { resolveAppUserByClerkId } from "@/lib/resolveAppUser";

export async function requireAppUser() {
  const clerkAuth = await auth();

  if (!clerkAuth.userId) {
    return clerkAuth.redirectToSignIn();
  }

  return resolveAppUserByClerkId(db.user, clerkAuth.userId);
}
