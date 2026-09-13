import { ok, route } from "@/lib/http";
import { listJobs } from "@/services/jobs";
import { serializeJob } from "@/services/serializers";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "required" }, async ({ auth, url }) => {
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const rows = await listJobs(auth!.walletId!, Number.isFinite(limit) ? limit : 20);
  return ok({ jobs: rows.map(serializeJob) });
});
