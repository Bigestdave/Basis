import { eq } from "drizzle-orm";
import { db } from "@/db";
import { walletNetworks } from "@/db/schema";
import { ok, route } from "@/lib/http";
import { listNetworks } from "@/services/wallets";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "optional" }, async ({ auth }) => {
  const networks = await listNetworks();
  if (!auth?.walletId) return ok({ networks });
  const selected = await db.select().from(walletNetworks).where(eq(walletNetworks.walletId, auth.walletId));
  const selectedKeys = new Set(selected.filter((s) => s.enabled).map((s) => s.networkKey));
  return ok({ networks: networks.map((n) => ({ ...n, selected: selectedKeys.has(n.key) })) });
});
