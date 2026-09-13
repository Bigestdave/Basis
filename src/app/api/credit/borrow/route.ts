import { z } from "zod";
import { ok, route } from "@/lib/http";
import { borrow } from "@/services/credit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountUsd: z.number().positive().max(1_000_000),
  idempotencyKey: z.string().min(4).max(160).optional().nullable(),
});

export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body, ip }) => {
  const input = await body(bodySchema);
  const result = await borrow({
    walletId: auth!.walletId!,
    userId: auth!.userId,
    address: auth!.address!,
    isDemo: auth!.isDemoWallet,
    amountUsd: input.amountUsd,
    idempotencyKey: input.idempotencyKey ?? null,
    ipAddress: ip,
  });
  return ok(result, { status: 201 });
});
