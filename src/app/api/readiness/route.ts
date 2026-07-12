import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const missingConfiguration = ["DATABASE_URL", "DIRECT_URL"].filter(
    (name) => !process.env[name],
  );
  if (missingConfiguration.length > 0) {
    return Response.json(
      {
        status: "not-ready",
        reason: "missing-database-configuration",
        missing: missingConfiguration,
      },
      { status: 503 },
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ready", database: "reachable" }, { status: 200 });
  } catch {
    return Response.json(
      { status: "not-ready", reason: "database-unavailable" },
      { status: 503 },
    );
  }
}
