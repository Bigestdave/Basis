import { z } from "zod";
import { ok, route } from "@/lib/http";
import { listActivity } from "@/services/evidence";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  type: z.string().max(32).optional(),
  chainKey: z.string().max(64).optional(),
  verifiedOnly: z.enum(["true", "false"]).optional(),
});

/**
 * Activity is sourced from the backend and is the SAME EconomicEvent data that
 * powers Home recent activity, the Activity page, Evidence and the Farm Test.
 */
export const GET = route({ auth: "required" }, async ({ auth, url }) => {
  const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const result = await listActivity({
    walletId: auth!.walletId!,
    limit: query.limit ?? 50,
    type: query.type,
    chainKey: query.chainKey,
    verifiedOnly: query.verifiedOnly === "true",
  });
  return ok(result);
});
