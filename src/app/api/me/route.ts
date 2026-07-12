import { requireAppUser } from "@/lib/requireAppUser";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAppUser();

  return Response.json({
    id: user.id,
    clerkUserId: user.clerkUserId,
    createdAt: user.createdAt,
  });
}
