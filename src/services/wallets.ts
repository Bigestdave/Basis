/**
 * Wallet and network management.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditAccounts, networks, sessions, users, walletConnections, walletNetworks, wallets } from "@/db/schema";
import { APP_MODE, CHAINS, chainRpcUrl } from "@/lib/config";
import { AppError, notFound } from "@/lib/errors";
import { deterministicId, isEvmAddress, normalizeAddress } from "@/lib/deterministic";
import { getProvidersForWallet } from "@/providers";
import { demoScenarioForAddress } from "@/providers/demo/fixtures";
import { ensureCreditAccount, walletIdForAddress, userIdForAddress } from "./auth";
import { audit } from "./audit";
import { money } from "./serializers";

export async function listWallets(userId: string) {
  const rows = await db
    .select({ wallet: wallets, account: creditAccounts })
    .from(wallets)
    .leftJoin(creditAccounts, eq(creditAccounts.walletId, wallets.id))
    .where(eq(wallets.userId, userId))
    .orderBy(desc(wallets.createdAt));

  return Promise.all(
    rows.map(async (row) => {
      const selected = await db
        .select({ networkKey: walletNetworks.networkKey, enabled: walletNetworks.enabled })
        .from(walletNetworks)
        .where(eq(walletNetworks.walletId, row.wallet.id));
      const account = row.account;
      const available = account ? Math.max(0, account.creditLimitUsdCents - account.borrowedUsdCents) : 0;
      return {
        id: row.wallet.id,
        address: row.wallet.address,
        label: row.wallet.label,
        family: row.wallet.family,
        status: row.wallet.status,
        isDemo: row.wallet.isDemo,
        scenarioKey: row.wallet.scenarioKey,
        createdAt: row.wallet.createdAt.getTime(),
        networks: selected.map((s) => s.networkKey),
        credit: account
          ? {
              creditLimit: money(account.creditLimitUsdCents),
              borrowed: money(account.borrowedUsdCents),
              available: money(available),
              utilization: account.creditLimitUsdCents > 0 ? Math.round((account.borrowedUsdCents / account.creditLimitUsdCents) * 10_000) / 10_000 : 0,
              status: account.status,
            }
          : null,
      };
    }),
  );
}

export interface ConnectWalletInput {
  userId: string;
  address: string;
  label?: string | null;
  chainKeys?: string[];
  sessionId?: string | null;
  ipAddress?: string | null;
}

export async function connectWallet(input: ConnectWalletInput) {
  const address = normalizeAddress(input.address);
  if (!isEvmAddress(address)) {
    throw new AppError("wallet_unsupported", "Only EVM addresses can be connected at this time.");
  }
  const scenario = demoScenarioForAddress(address);
  const walletId = scenario ? `wal_demo_${scenario.key}` : walletIdForAddress(address);
  const userId = scenario ? scenario && input.userId ? input.userId : userIdForAddress(address) : input.userId;

  await db
    .insert(users)
    .values({ id: userId, mode: scenario ? "demo" : APP_MODE, label: scenario?.label ?? null })
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(wallets)
    .values({
      id: walletId,
      userId,
      address,
      family: "evm",
      label: input.label ?? scenario?.label ?? "Connected wallet",
      isDemo: Boolean(scenario),
      scenarioKey: scenario?.key ?? null,
      status: "CONNECTED",
    })
    .onConflictDoUpdate({ target: wallets.id, set: { status: "CONNECTED", userId, updatedAt: new Date() } });

  const chainKeys = input.chainKeys?.length ? input.chainKeys : scenario?.chainKeys ?? ["ethereum-sepolia"];
  for (const chainKey of chainKeys) {
    await db
      .insert(walletConnections)
      .values({
        id: deterministicId("connection", walletId, chainKey),
        walletId,
        userId,
        chainKey,
        signerType: scenario ? "demo-hmac" : "eip191",
        status: "ACTIVE",
      })
      .onConflictDoUpdate({
        target: [walletConnections.walletId, walletConnections.chainKey],
        set: { status: "ACTIVE", connectedAt: new Date(), disconnectedAt: null },
      });
    await db
      .insert(walletNetworks)
      .values({ id: deterministicId("connection", walletId, chainKey), walletId, networkKey: chainKey, enabled: true })
      .onConflictDoUpdate({ target: [walletNetworks.walletId, walletNetworks.networkKey], set: { enabled: true } });
  }

  await ensureCreditAccount(walletId, userId, scenario?.startingCreditLimitUsdCents ?? 0, scenario?.startingBorrowedUsdCents ?? 0);

  if (input.sessionId) {
    await db.update(sessions).set({ walletId }).where(eq(sessions.id, input.sessionId));
  }

  const bundle = await getProvidersForWallet(Boolean(scenario));
  await audit({
    action: "wallet.connected",
    userId,
    walletId,
    referenceId: walletId,
    ipAddress: input.ipAddress,
    metadata: { address, chainKeys, provider: bundle.chainData.descriptor.id },
  });

  return { walletId, address, isDemo: Boolean(scenario), scenarioKey: scenario?.key ?? null, chainKeys };
}

export async function disconnectWallet(userId: string, walletId: string) {
  const rows = await db.select().from(wallets).where(and(eq(wallets.id, walletId), eq(wallets.userId, userId))).limit(1);
  if (!rows[0]) throw notFound(`Wallet ${walletId} was not found for this session.`);
  await db.update(walletConnections).set({ status: "DISCONNECTED", disconnectedAt: new Date() }).where(eq(walletConnections.walletId, walletId));
  await db.update(wallets).set({ status: "DISCONNECTED", updatedAt: new Date() }).where(eq(wallets.id, walletId));
  await db.update(sessions).set({ walletId: null }).where(and(eq(sessions.walletId, walletId), eq(sessions.userId, userId)));
  await audit({ action: "wallet.disconnected", userId, walletId, referenceId: walletId });
  return { disconnected: true, walletId };
}

export async function listNetworks() {
  const stored = await db.select().from(networks);
  const storedByKey = new Map(stored.map((n) => [n.key, n]));
  return CHAINS.map((chain) => {
    const row = storedByKey.get(chain.key);
    return {
      key: chain.key,
      chainId: chain.chainId,
      name: chain.name,
      family: chain.family,
      enabled: row ? row.enabled : chain.enabledInDemo,
      rpcConfigured: chain.family === "evm" ? Boolean(chainRpcUrl(chain)) : Boolean(process.env[chain.rpcEnvVar]),
      attestcoinChainKey: row?.attestcoinChainKey ?? chain.knownAttestcoinChainKey,
      selected: false,
      explorerTxTemplate: chain.blockExplorerTx ? chain.blockExplorerTx("{txHash}") : null,
    };
  });
}

export async function selectNetworks(walletId: string, chainKeys: string[]) {
  const known = new Set(CHAINS.map((c) => c.key));
  for (const key of chainKeys) {
    if (!known.has(key)) {
      throw new AppError("chain_unsupported", `Network "${key}" is not supported by BASIS.`, {
        details: { supported: [...known] },
      });
    }
  }
  await db.update(walletNetworks).set({ enabled: false }).where(eq(walletNetworks.walletId, walletId));
  for (const chainKey of chainKeys) {
    await db
      .insert(walletNetworks)
      .values({ id: deterministicId("connection", walletId, chainKey), walletId, networkKey: chainKey, enabled: true })
      .onConflictDoUpdate({ target: [walletNetworks.walletId, walletNetworks.networkKey], set: { enabled: true, selectedAt: new Date() } });
  }
  await audit({ action: "network.connected", walletId, referenceId: walletId, metadata: { chainKeys } });
  return { walletId, chainKeys };
}

export async function enabledChainKeys(walletId: string): Promise<string[]> {
  const rows = await db
    .select({ networkKey: walletNetworks.networkKey })
    .from(walletNetworks)
    .where(and(eq(walletNetworks.walletId, walletId), eq(walletNetworks.enabled, true)));
  if (rows.length > 0) return rows.map((r) => r.networkKey);
  const walletRows = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  const scenario = walletRows[0]?.scenarioKey ? demoScenarioForAddress(walletRows[0].address) : undefined;
  return scenario?.chainKeys ?? ["ethereum-sepolia"];
}
