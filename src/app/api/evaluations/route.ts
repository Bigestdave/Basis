import { ok, route } from "@/lib/http";
import { listEvaluations } from "@/services/evidence";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "required" }, async ({ auth, url }) => {
  const limit = Number(url.searchParams.get("limit") ?? 20);
  return ok({ evaluations: await listEvaluations(auth!.walletId!, Number.isFinite(limit) ? limit : 20) });
});
