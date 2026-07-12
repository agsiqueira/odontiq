import { requireAppUser } from "@/lib/requireAppUser";
import { reportsService } from "@/lib/persistence/services/reports";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAppUser();
  return Response.json(await reportsService.getDashboard(user.id));
}
