import { db } from "@/db";
import { sql } from "drizzle-orm";
import { serverInfo } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      service: "basis-backend",
      appMode: serverInfo.appMode,
      evidenceEngineVersion: serverInfo.evidenceEngineVersion,
      creditEngineVersion: serverInfo.creditEngineVersion,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        service: "basis-backend",
        appMode: serverInfo.appMode,
        database: "unreachable",
        error: err instanceof Error ? err.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
