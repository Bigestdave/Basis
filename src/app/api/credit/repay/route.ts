import { z } from "zod";
import { ok, route } from "@/lib/http";
import { repay } from "@/services/credit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountUsd: z.number().positive().max(1_000_000),
  positionId: z.string().min(3).max(120).optional().nullable(),
  idempotencyKey: z.string().min(4).max(160).optional().nullable(),
});

export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body, ip }) => {
  const input = await body(bodySchema);
  const result = await repay({
    walletId: auth!.walletId!,
    userId: auth!.userId,
    address: auth!.address!,
    isDemo: auth!.isDemoWallet,
    amountUsd: input.amountUsd,
    positionId: input.positionId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    ipAddress: ip,
  });
  return ok(result, { status: 201 });
});
