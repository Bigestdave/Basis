import { ok, route } from "@/lib/http";
import { getEvaluation } from "@/services/evidence";

export const dynamic = "force-dynamic";

/** Full evaluation record: dimensions, explanations, contributing events, decision. */
export const GET = route({ auth: "required" }, async ({ auth, params }) => {
  return ok(await getEvaluation(auth!.walletId!, params.id));
});
