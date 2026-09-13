import { ok, route } from "@/lib/http";
import { reapStaleJobs } from "@/services/jobs";

export const dynamic = "force-dynamic";

/**
 * Operational endpoint: clears locks from jobs whose worker died so they can be
 * retried. Safe to call from a cron/scheduler; requires an authenticated session.
 */
export const POST = route({ auth: "required", rateLimit: "mutation" }, async () => ok(await reapStaleJobs()));
