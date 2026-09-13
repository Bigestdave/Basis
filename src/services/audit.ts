/**
 * Audit trail for financially meaningful state changes.
 *
 * Never throws: an audit failure must not roll back a credit decision, but it
 * must be visible in the logs.
 */
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { deterministicId } from "@/lib/deterministic";

export type AuditAction =
  | "wallet.connected"
  | "wallet.disconnected"
  | "wallet.verified"
  | "network.connected"
  | "auth.nonce_issued"
  | "auth.signature_verified"
  | "auth.session_created"
  | "auth.session_revoked"
  | "auth.demo_sign"
  | "evidence.sync_started"
  | "evidence.events_ingested"
  | "evidence.attested"
  | "evidence.evaluated"
  | "credit.decision_created"
  | "credit.limit_updated"
  | "credit.settlement_attempted"
  | "credit.borrow_created"
  | "credit.repayment_created"
  | "farm_test.run"
  | "job.created"
  | "job.completed"
  | "job.failed";

export interface AuditInput {
  action: AuditAction;
  userId?: string | null;
  walletId?: string | null;
  referenceId?: string | null;
  result?: "success" | "failure" | "blocked";
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

export async function audit(input: AuditInput): Promise<string> {
  const id = deterministicId(
    "audit",
    input.action,
    input.walletId ?? "-",
    input.referenceId ?? "-",
    Date.now(),
    Math.round(performance.now() * 1000),
  );
  try {
    await db.insert(auditLogs).values({
      id,
      action: input.action,
      userId: input.userId ?? null,
      walletId: input.walletId ?? null,
      referenceId: input.referenceId ?? null,
      result: input.result ?? "success",
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("[basis] audit write failed", { action: input.action, error: (err as Error).message });
  }
  return id;
}

export async function recentAuditLog(walletId: string, limit = 50) {
  const { auditLogs: table } = await import("@/db/schema");
  const { desc, eq } = await import("drizzle-orm");
  return db.select().from(table).where(eq(table.walletId, walletId)).orderBy(desc(table.createdAt)).limit(limit);
}
