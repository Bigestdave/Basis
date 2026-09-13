import { ok, route } from "@/lib/http";
import { forbidden } from "@/lib/errors";
import { getJob } from "@/services/jobs";
import { serializeJob } from "@/services/serializers";
import { getCreditView } from "@/services/credit";
import { getLatestEvaluation } from "@/services/evidence";

export const dynamic = "force-dynamic";

/**
 * Polling endpoint for the Build Credit state machine. Returns status, progress,
 * per-step detail and — once COMPLETED — the resulting credit decision payload
 * so the result screen renders an actual backend decision.
 */
export const GET = route({ auth: "required" }, async ({ auth, params }) => {
  const job = await getJob(params.id);
  if (job.walletId && job.walletId !== auth!.walletId) {
    throw forbidden("That job belongs to a different wallet.");
  }
  const reference = (job.resultReference ?? null) as Record<string, unknown> | null;
  const completed = job.status === "COMPLETED" && job.walletId === auth!.walletId;

  return ok({
    job: serializeJob(job),
    result: completed
      ? {
          evaluationId: reference?.evaluationId ?? null,
          decisionId: reference?.decisionId ?? null,
          evidence: await getLatestEvaluation(auth!.walletId!),
          credit: await getCreditView(auth!.walletId!),
          summary: reference,
        }
      : null,
  });
});
