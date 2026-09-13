import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceEvaluations, users, wallets } from "@/db/schema";
import { ok, route } from "@/lib/http";
import { listWallets } from "@/services/wallets";
import { getCreditView } from "@/services/credit";
import { getLatestEvaluation } from "@/services/evidence";
import { serializeEvaluation } from "@/services/serializers";

export const dynamic = "force-dynamic";

/** Aggregated bootstrapping payload for the authenticated session. */
export const GET = route({ auth: "required" }, async ({ auth }) => {
  const userRows = await db.select().from(users).where(eq(users.id, auth!.userId)).limit(1);
  const walletRows = await db.select().from(wallets).where(eq(wallets.userId, auth!.userId)).orderBy(desc(wallets.createdAt));
  const evaluationRows = auth!.walletId
    ? await db.select().from(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, auth!.walletId)).orderBy(desc(evidenceEvaluations.createdAt)).limit(1)
    : [];

  const [walletList, credit, latestEvidence] = await Promise.all([
    listWallets(auth!.userId),
    auth!.walletId ? getCreditView(auth!.walletId) : Promise.resolve(null),
    auth!.walletId ? getLatestEvaluation(auth!.walletId) : Promise.resolve(null),
  ]);

  return ok({
    user: {
      id: auth!.userId,
      mode: userRows[0]?.mode ?? auth!.mode,
      label: userRows[0]?.label ?? null,
      createdAt: userRows[0]?.createdAt.getTime() ?? null,
    },
    session: { id: auth!.sessionId, mode: auth!.mode },
    wallet: auth!.walletId
      ? { id: auth!.walletId, address: auth!.address, isDemo: auth!.isDemoWallet }
      : null,
    wallets: walletList,
    allWallets: walletRows.map((w) => ({ id: w.id, address: w.address, label: w.label, isDemo: w.isDemo, scenarioKey: w.scenarioKey, status: w.status })),
    credit,
    evidence: latestEvidence ?? (evaluationRows[0] ? serializeEvaluation(evaluationRows[0]) : null),
  });
});
