type AppUser = {
  id: string;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

type AppUserStore = {
  upsert(args: {
    where: { clerkUserId: string };
    update: Record<string, never>;
    create: { clerkUserId: string };
  }): Promise<AppUser>;
};

export function resolveAppUserByClerkId(
  users: AppUserStore,
  clerkUserId: string,
) {
  return users.upsert({
    where: { clerkUserId },
    update: {},
    create: { clerkUserId },
  });
}
