import { ok, route } from "@/lib/http";
import { getLatestEvaluation, listEvaluations, listEventsForEvidence } from "@/services/evidence";
import { getCreditView } from "@/services/credit";

export const dynamic = "force-dynamic";

/**
 * Evidence overview: every normalised economic event for the wallet, the latest
 * evaluation with its three dimensions and explanations, and the credit decision
 * that evaluation produced.
 */
export const GET = route({ auth: "required" }, async ({ auth, url }) => {
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const [events, latest, evaluations, credit] = await Promise.all([
    listEventsForEvidence(auth!.walletId!, Number.isFinite(limit) ? limit : 100),
    getLatestEvaluation(auth!.walletId!),
    listEvaluations(auth!.walletId!, 10),
    getCreditView(auth!.walletId!),
  ]);

  const verified = events.filter((e) => e.verified);
  return ok({
    events,
    summary: {
      eventCount: events.length,
      verifiedCount: verified.length,
      pendingCount: events.length - verified.length,
      volumeCents: events.reduce((acc, e) => acc + e.amount.cents, 0),
      creditedCount: events.filter((e) => e.credited).length,
    },
    latest,
    evaluations,
    credit: credit.account,
    strengthLabel: latest?.strengthLabel ?? "No verified evidence yet",
    empty: events.length === 0,
  });
});
