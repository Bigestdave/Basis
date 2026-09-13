import { z } from "zod";
import { ok, route } from "@/lib/http";
import { runFarmTest } from "@/services/farm-test";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scenario: z.enum(["manufactured", "genuine"]),
});

/**
 * Runs a deterministic scenario through the real pipeline and returns the
 * backend-owned result: activityCount, economic evidence, creditBefore,
 * creditIncrease, creditAfter and the explanations. No frontend arithmetic.
 */
export const POST = route({ auth: "none", rateLimit: "mutation" }, async ({ body, ip, auth }) => {
  const input = await body(bodySchema);
  const result = await runFarmTest({ scenarioKey: input.scenario, userId: auth?.userId ?? null, ipAddress: ip });
  return ok(result, { status: 201 });
});
