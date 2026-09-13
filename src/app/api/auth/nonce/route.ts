import { z } from "zod";
import { ok, route } from "@/lib/http";
import { issueNonce } from "@/services/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  address: z.string().min(3).max(128),
  origin: z.string().max(256).optional(),
});

export const POST = route({ auth: "none", rateLimit: "auth" }, async ({ body, ip, url }) => {
  const input = await body(bodySchema);
  const origin = input.origin ?? url.origin;
  const result = await issueNonce({ address: input.address, origin, ip });
  return ok(result, { status: 201 });
});
