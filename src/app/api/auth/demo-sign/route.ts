import { z } from "zod";
import { ok, route } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { APP_MODE } from "@/lib/config";
import { demoSign } from "@/services/auth";
import { demoScenarioForAddress } from "@/providers/demo/fixtures";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  address: z.string().min(3).max(128),
  message: z.string().min(8).max(4096),
});

/**
 * Demo-only helper that lets a simulated BASIS wallet produce a signature for a
 * challenge, so the *real* verification path runs end to end. It refuses any
 * address that is not a BASIS demo wallet and is disabled when APP_MODE=live.
 */
export const POST = route({ auth: "none", rateLimit: "auth" }, async ({ body }) => {
  if (APP_MODE === "live") {
    throw new AppError("live_mode_only", "Demo signing is disabled in live mode. Sign with your own wallet.");
  }
  const input = await body(bodySchema);
  if (!demoScenarioForAddress(input.address)) {
    throw new AppError("demo_mode_only", "This address is not a BASIS demo wallet.");
  }
  return ok(await demoSign(input));
});
