/**
 * Deterministic database seed module.
 *
 * Populates networks, assets, protocols, demo users, demo wallets,
 * credit accounts and Farm Test scenarios, then ingests, attests and
 * normalises evidence through the real pipeline.
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  assets,
  creditAccounts,
  economicEvents,
  farmTestScenarios,
  networks,
  protocols,
  users,
  wallets,
  creditDecisions,
  creditTransactions,
  evidenceEvaluations,
  evidenceEventLinks,
  evidenceFactors,
  borrowPositions,
  repayments,
} from "./schema";
import { CHAINS, chainRpcUrl, creditConfig } from "../lib/config";
import { deterministicId } from "../lib/deterministic";
import {
  DEMO_ASSETS,
  DEMO_SCENARIO_KEYS,
  DEMO_SCENARIOS,
  FARM_SCENARIO_KEYS,
  FARM_SCENARIO_MAP,
  farmWalletAddress,
  materializeScenario,
} from "../providers/demo/fixtures";
import { ensureCreditAccount } from "../services/auth";
import { syncWalletEvidence, runBuildCreditPipeline } from "../services/pipeline";
import { borrow } from "../services/credit";

export async function seedNetworks(): Promise<void> {
  for (const chain of CHAINS) {
    await db
      .insert(networks)
      .values({
        id: deterministicId("network", chain.key),
        key: chain.key,
        chainId: chain.chainId,
        name: chain.name,
        family: chain.family,
        attestcoinChainKey: chain.knownAttestcoinChainKey,
        rpcConfigured: Boolean(chainRpcUrl(chain)),
        enabled: true,
        explorerTxTemplate: chain.blockExplorerTx ? chain.blockExplorerTx("{txHash}") : null,
      })
      .onConflictDoUpdate({
        target: networks.key,
        set: {
          chainId: chain.chainId,
          name: chain.name,
          family: chain.family,
          attestcoinChainKey: chain.knownAttestcoinChainKey,
          rpcConfigured: Boolean(chainRpcUrl(chain)),
        },
      });
  }
}

export async function seedAssets(): Promise<void> {
  const rows: { symbol: string; chainKey: string; decimals: number; priceUsd: number; contractAddress: string }[] = [];
  for (const chainKey of ["ethereum-sepolia", "base-sepolia", "ethereum", "base"]) {
    for (const [key, asset] of Object.entries(DEMO_ASSETS)) {
      rows.push({
        symbol: asset.symbol,
        chainKey,
        decimals: asset.decimals,
        priceUsd: asset.priceUsd,
        contractAddress: key === "ETH" ? "native" : deterministicId("asset", chainKey, key).slice(0, 42),
      });
    }
  }
  for (const row of rows) {
    await db
      .insert(assets)
      .values({ id: deterministicId("asset", row.chainKey, row.symbol, row.contractAddress), ...row })
      .onConflictDoUpdate({
        target: [assets.symbol, assets.chainKey, assets.contractAddress],
        set: { priceUsd: row.priceUsd, decimals: row.decimals },
      });
  }
}

export async function seedProtocols(): Promise<void> {
  const list = [
    { key: "uniswap-v3", name: "Uniswap v3", category: "dex" },
    { key: "aave-v3", name: "Aave v3", category: "lending" },
    { key: "lido", name: "Lido", category: "staking" },
    { key: "compound-v3", name: "Compound v3", category: "lending" },
    { key: "curve", name: "Curve", category: "dex" },
    { key: "morpho", name: "Morpho", category: "lending" },
    { key: "across", name: "Across Bridge", category: "bridge" },
  ];
  for (const p of list) {
    await db
      .insert(protocols)
      .values({
        id: deterministicId("protocol", p.key),
        key: p.key,
        name: p.name,
        category: p.category,
        chainKeys: ["ethereum-sepolia", "base-sepolia"] as never,
      })
      .onConflictDoUpdate({ target: protocols.key, set: { name: p.name, category: p.category } });
  }
}

export async function seedDemoAccounts(): Promise<void> {
  for (const key of DEMO_SCENARIO_KEYS) {
    const fixture = DEMO_SCENARIOS[key];
    const materialized = materializeScenario(key);
    await db
      .insert(users)
      .values({ id: materialized.userId, mode: "demo", label: `BASIS Demo — ${fixture.label}` })
      .onConflictDoUpdate({ target: users.id, set: { label: `BASIS Demo — ${fixture.label}`, lastSeenAt: new Date() } });
    await db
      .insert(wallets)
      .values({
        id: materialized.walletId,
        userId: materialized.userId,
        address: materialized.address,
        family: "evm",
        label: fixture.label,
        isDemo: true,
        scenarioKey: fixture.key,
        status: "CONNECTED",
      })
      .onConflictDoUpdate({
        target: wallets.id,
        set: { userId: materialized.userId, address: materialized.address, status: "CONNECTED", label: fixture.label },
      });
    await ensureCreditAccount(materialized.walletId, materialized.userId, 0, 0);
  }
}

export async function seedFarmScenarios(): Promise<void> {
  for (const key of FARM_SCENARIO_KEYS) {
    const fixtureKey = FARM_SCENARIO_MAP[key];
    const fixture = DEMO_SCENARIOS[fixtureKey];
    const materialized = materializeScenario(fixtureKey);
    await db
      .insert(farmTestScenarios)
      .values({
        key,
        label: key === "manufactured" ? "Manufactured activity" : "Genuine activity",
        description: fixture.description,
        narrative: fixture.narrative,
        expectation: fixture.expectation,
        fixtureKey,
        walletId: null,
        activityCount: materialized.events.length,
        volumeUsdCents: materialized.volumeUsdCents,
      })
      .onConflictDoUpdate({
        target: farmTestScenarios.key,
        set: {
          description: fixture.description,
          narrative: fixture.narrative,
          activityCount: materialized.events.length,
          volumeUsdCents: materialized.volumeUsdCents,
        },
      });
  }
}

export async function ingestDemoEvidence(): Promise<void> {
  for (const key of DEMO_SCENARIO_KEYS) {
    const materialized = materializeScenario(key);
    await syncWalletEvidence({
      walletId: materialized.walletId,
      userId: materialized.userId,
      address: materialized.address,
      isDemo: true,
      chainKeys: [...materialized.fixture.chainKeys],
      ipAddress: "seed",
    });
  }
}

async function resetDerivedState(walletId: string) {
  const evaluations = await db.select({ id: evidenceEvaluations.id }).from(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, walletId));
  if (evaluations.length > 0) {
    await db.delete(evidenceEventLinks).where(eq(evidenceEventLinks.walletId, walletId));
    const { inArray } = await import("drizzle-orm");
    await db.delete(evidenceFactors).where(inArray(evidenceFactors.evaluationId, evaluations.map((e) => e.id)));
  }
  await db.delete(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, walletId));
  await db.delete(creditDecisions).where(eq(creditDecisions.walletId, walletId));
  await db.delete(creditTransactions).where(eq(creditTransactions.walletId, walletId));
  await db.delete(repayments).where(eq(repayments.walletId, walletId));
  await db.delete(borrowPositions).where(eq(borrowPositions.walletId, walletId));
  await db.update(economicEvents).set({ creditedAt: null, lastEvaluationId: null }).where(eq(economicEvents.walletId, walletId));
  await db
    .update(creditAccounts)
    .set({ creditLimitUsdCents: 0, borrowedUsdCents: 0, totalAwardedUsdCents: 0, totalRepaidUsdCents: 0, evaluationCount: 0, lastEvaluatedAt: null, version: 0 })
    .where(eq(creditAccounts.walletId, walletId));
}

export async function seedCreditedScenario(): Promise<void> {
  const key = "proof-detail" as const;
  const materialized = materializeScenario(key);
  await resetDerivedState(materialized.walletId);
  const result = await runBuildCreditPipeline({
    walletId: materialized.walletId,
    userId: materialized.userId,
    address: materialized.address,
    isDemo: true,
    chainKeys: [...materialized.fixture.chainKeys],
    ipAddress: "seed",
  });

  const decision = result.decision;
  if (decision && decision.awarded && decision.newLimitUsdCents > 30_000) {
    try {
      await borrow({
        walletId: materialized.walletId,
        userId: materialized.userId,
        address: materialized.address,
        isDemo: true,
        amountUsd: 300,
        idempotencyKey: `seed-borrow:${materialized.walletId}`,
        ipAddress: "seed",
      });
    } catch {
      // borrow skipped if error
    }
  }
}

export async function seedInitialData(): Promise<void> {
  console.log("[DB Seed] Starting initial database seed...");
  await seedNetworks();
  await seedAssets();
  await seedProtocols();
  await seedDemoAccounts();
  await seedFarmScenarios();
  await ingestDemoEvidence();
  await seedCreditedScenario();
  console.log("[DB Seed] Initial database seed completed!");
}
