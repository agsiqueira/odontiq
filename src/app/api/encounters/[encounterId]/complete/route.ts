import { requireAppUser } from "@/lib/requireAppUser";
import {
  EncounterNotFoundError,
} from "@/lib/persistence/services/encounterService";
import { encounterService } from "@/lib/persistence/services/encounters";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ encounterId: string }> },
) {
  const { encounterId } = await context.params;
  const user = await requireAppUser();

  try {
    const encounter = await encounterService.completeEncounter(user.id, encounterId);
    return Response.json({
      id: encounter.id,
      caseId: encounter.caseId,
      status: encounter.status,
      version: encounter.version,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
    });
  } catch (error) {
    if (error instanceof EncounterNotFoundError) {
      return Response.json({ error: "encounter_not_found" }, { status: 404 });
    }
    throw error;
  }
}
