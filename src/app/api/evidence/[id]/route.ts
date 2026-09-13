import { ok, route } from "@/lib/http";
import { getEventDetail } from "@/services/evidence";

export const dynamic = "force-dynamic";

/**
 * Evidence detail for a single economic event: network, block, transaction,
 * from/to, asset, amount, timestamp, verification status, the Attestcoin proof
 * reference and the economic interpretation. Never a hardcoded object.
 */
export const GET = route({ auth: "required" }, async ({ auth, params }) => {
  return ok(await getEventDetail(auth!.walletId!, params.id));
});
