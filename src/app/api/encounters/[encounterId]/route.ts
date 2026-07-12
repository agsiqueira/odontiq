import { isEncounterDocument } from "@/lib/encounter/encounterDocument";
import { requireAppUser } from "@/lib/requireAppUser";
import {
  EncounterNotFoundError,
  EncounterRevisionConflictError,
} from "@/lib/persistence/services/encounterService";
import { encounterService } from "@/lib/persistence/services/encounters";

export const runtime = "nodejs";

type EncounterRouteContext = {
  params: Promise<{ encounterId: string }>;
};

export async function GET(_request: Request, context: EncounterRouteContext) {
  const { encounterId } = await context.params;
  const user = await requireAppUser();
  try {
    const encounter = await encounterService.getOwnedEncounter(user.id, encounterId);
    return Response.json({
      id: encounter.id,
      caseId: encounter.caseId,
      status: encounter.status,
      revision: encounter.version,
      version: encounter.version,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
      document: isEncounterDocument(encounter.encounterData)
        ? encounter.encounterData
        : null,
    });
  } catch (error) {
    if (error instanceof EncounterNotFoundError) {
      return Response.json({ error: "encounter_not_found" }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(request: Request, context: EncounterRouteContext) {
  const { encounterId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const revision =
    body && typeof body === "object" && "revision" in body
      ? (body as { revision?: unknown }).revision
      : undefined;
  const document =
    body && typeof body === "object" && "document" in body
      ? (body as { document?: unknown }).document
      : undefined;
  if (!Number.isInteger(revision) || !isEncounterDocument(document)) {
    return Response.json({ error: "invalid_encounter_document" }, { status: 400 });
  }

  const user = await requireAppUser();
  try {
    const encounter = await encounterService.updateEncounterDocument(
      user.id,
      encounterId,
      revision as number,
      document,
    );
    return Response.json({
      id: encounter.id,
      revision: encounter.version,
      document: encounter.encounterData,
      updatedAt: encounter.updatedAt,
    });
  } catch (error) {
    if (error instanceof EncounterRevisionConflictError) {
      return Response.json({ error: "stale_revision" }, { status: 409 });
    }
    if (error instanceof EncounterNotFoundError) {
      return Response.json({ error: "encounter_not_found" }, { status: 404 });
    }
    throw error;
  }
}
