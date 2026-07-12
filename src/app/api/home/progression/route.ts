import { requireAppUser } from "@/lib/requireAppUser";
import { homeProgressionService } from "@/lib/persistence/services/homeProgression";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAppUser();
  return Response.json(await homeProgressionService.getProgression(user.id));
}
