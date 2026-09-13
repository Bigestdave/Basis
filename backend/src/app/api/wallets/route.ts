import { z } from "zod";
import { ok, route } from "@/lib/http";
import { connectWallet, listWallets } from "@/services/wallets";

export const dynamic = "force-dynamic";

const connectSchema = z.object({
  address: z.string().min(3).max(128),
  label: z.string().max(120).optional().nullable(),
  chainKeys: z.array(z.string().min(2).max(64)).max(12).optional(),
});

export const GET = route({ auth: "required" }, async ({ auth }) => ok({ wallets: await listWallets(auth!.userId) }));

/**
 * Associates an already-authenticated wallet with the session. Ownership was
 * proved at /api/auth/verify; this only records the connection and networks.
 */
export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body, ip }) => {
  const input = await body(connectSchema);
  const result = await connectWallet({
    userId: auth!.userId,
    address: input.address,
    label: input.label ?? null,
    chainKeys: input.chainKeys,
    sessionId: auth!.sessionId,
    ipAddress: ip,
  });
  return ok({ ...result, wallets: await listWallets(auth!.userId) }, { status: 201 });
});
