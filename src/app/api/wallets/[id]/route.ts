import { eq } from "drizzle-orm";
import { db } from "@/db";
import { walletNetworks, wallets } from "@/db/schema";
import { notFound, ok, route } from "@/lib/http";
import { disconnectWallet, listWallets } from "@/services/wallets";
import { getCreditView } from "@/services/credit";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "required" }, async ({ auth, params }) => {
  const walletId = params.id;
  const rows = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!rows[0] || rows[0].userId !== auth!.userId) throw notFound(`Wallet ${walletId} was not found.`);
  const networkRows = await db.select().from(walletNetworks).where(eq(walletNetworks.walletId, walletId));
  return ok({
    wallet: {
      id: rows[0].id,
      address: rows[0].address,
      label: rows[0].label,
      family: rows[0].family,
      status: rows[0].status,
      isDemo: rows[0].isDemo,
      scenarioKey: rows[0].scenarioKey,
      createdAt: rows[0].createdAt.getTime(),
      networks: networkRows.filter((n) => n.enabled).map((n) => n.networkKey),
    },
    credit: await getCreditView(walletId),
  });
});

export const DELETE = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, params }) => {
  await disconnectWallet(auth!.userId, params.id);
  return ok({ wallets: await listWallets(auth!.userId) });
});
