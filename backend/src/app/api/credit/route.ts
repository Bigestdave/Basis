import { ok, route } from "@/lib/http";
import { getCreditView } from "@/services/credit";
import { getLatestEvaluation } from "@/services/evidence";

export const dynamic = "force-dynamic";

/**
 * Credit state, produced entirely by the backend:
 * limit, borrowed, available, utilization, latest decision and history.
 * The frontend must not recompute any of these values.
 */
export const GET = route({ auth: "required" }, async ({ auth }) => {
  const [credit, evidence] = await Promise.all([
    getCreditView(auth!.walletId!),
    getLatestEvaluation(auth!.walletId!),
  ]);
  return ok({
    ...credit,
    evidence: evidence
      ? {
          id: evidence.id,
          evidenceScore: evidence.evidenceScore,
          strength: evidence.strength,
          strengthLabel: evidence.strengthLabel,
          capitalIndependence: evidence.capitalIndependence,
          economicDiversity: evidence.economicDiversity,
          behavioralCoherence: evidence.behavioralCoherence,
          factors: evidence.factors,
          createdAt: evidence.createdAt,
        }
      : null,
  });
});
