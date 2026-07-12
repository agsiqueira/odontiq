import { requireAppUser } from "@/lib/requireAppUser";
import {
  ReportAttemptNotFoundError,
} from "@/lib/persistence/services/reportsService";
import { reportsService } from "@/lib/persistence/services/reports";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await context.params;
  const user = await requireAppUser();
  try {
    return Response.json(await reportsService.getReport(user.id, attemptId));
  } catch (error) {
    if (error instanceof ReportAttemptNotFoundError) {
      return Response.json({ error: "report_not_found" }, { status: 404 });
    }
    throw error;
  }
}
