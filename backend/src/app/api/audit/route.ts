import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Audit trail for the authenticated wallet's financially meaningful actions. */
export const GET = route({ auth: "required" }, async ({ auth, url }) => {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
  if (!auth!.walletId) return ok({ items: [] });
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.walletId, auth!.walletId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return ok({
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      result: row.result,
      referenceId: row.referenceId,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.createdAt.getTime(),
    })),
  });
});
