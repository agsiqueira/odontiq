import { getCaseById } from "@/lib/cases";
import { requireAppUser } from "@/lib/requireAppUser";
import { encounterService } from "@/lib/persistence/services/encounters";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseId =
    body && typeof body === "object" && "caseId" in body
      ? (body as { caseId?: unknown }).caseId
      : undefined;
  if (typeof caseId !== "string" || !getCaseById(caseId)) {
    return Response.json({ error: "invalid_case" }, { status: 400 });
  }

  const fresh = Boolean(
    body && typeof body === "object" && "fresh" in body &&
      (body as { fresh?: unknown }).fresh === true,
  );

  const user = await requireAppUser();
  const encounter = fresh
    ? await encounterService.startFreshEncounter(user.id, caseId)
    : await encounterService.getOrCreateActiveEncounter(user.id, caseId);

  return Response.json({ ...toEncounterResponse(encounter), fresh });
}

function toEncounterResponse(encounter: {
  id: string;
  caseId: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: encounter.id,
    caseId: encounter.caseId,
    status: encounter.status,
    version: encounter.version,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
  };
}
