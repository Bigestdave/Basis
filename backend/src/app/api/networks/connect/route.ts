import { z } from "zod";
import { ok, route } from "@/lib/http";
import { listNetworks, selectNetworks } from "@/services/wallets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletId: z.string().min(3).max(120).optional(),
  chainKeys: z.array(z.string().min(2).max(64)).min(1).max(12),
});

export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body }) => {
  const input = await body(bodySchema);
  const walletId = input.walletId ?? auth!.walletId!;
  if (walletId !== auth!.walletId) {
    // Allow selecting networks for another wallet owned by the same user only.
    const { listWallets } = await import("@/services/wallets");
    const owned = await listWallets(auth!.userId);
    if (!owned.some((w) => w.id === walletId)) {
      const { forbidden } = await import("@/lib/errors");
      throw forbidden("That wallet does not belong to this session.");
    }
  }
  await selectNetworks(walletId, input.chainKeys);
  return ok({ walletId, networks: await listNetworks() });
});
