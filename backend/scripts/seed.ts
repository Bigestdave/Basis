/**
 * Deterministic database seed.
 *
 * Run with:  npx tsx scripts/seed.ts
 *
 * Creates everything the demo needs — networks, assets, protocols, demo users,
 * demo wallets, credit accounts and Farm Test scenarios — and then ingests,
 * attests and normalises the seeded economic events through the REAL pipeline,
 * so the demo never contains a value the engine did not produce.
 *
 * For the "Attestcoin proof detail" scenario it additionally runs the full
 * evaluation + credit decision + a borrow, so that screen shows a genuine
 * engine-derived credit state rather than a hardcoded number.
 *
 * Safe to re-run: every write is an upsert keyed on deterministic ids.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  assets,
  creditAccounts,
  economicEvents,
  farmTestScenarios,
  networks,
  protocols,
  users,
  wallets,
} from "../src/db/schema";
import { CHAINS, chainRpcUrl, creditConfig } from "../src/lib/config";
import { deterministicId } from "../src/lib/deterministic";
import {
  DEMO_ASSETS,
  DEMO_SCENARIO_KEYS,
  DEMO_SCENARIOS,
  FARM_SCENARIO_KEYS,
  FARM_SCENARIO_MAP,
  farmWalletAddress,
  farmWalletId,
  materializeScenario,
} from "../src/providers/demo/fixtures";
import { ensureCreditAccount } from "../src/services/auth";
import { syncWalletEvidence, runBuildCreditPipeline } from "../src/services/pipeline";
import { borrow } from "../src/services/credit";
import { runFarmTest } from "../src/services/farm-test";

const DEMO_NOW = Date.UTC(2026, 1, 20, 12, 0, 0);

async function seedNetworks() {
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
        set: { chainId: chain.chainId, name: chain.name, family: chain.family, attestcoinChainKey: chain.knownAttestcoinChainKey, rpcConfigured: Boolean(chainRpcUrl(chain)) },
      });
  }
  console.log(`  networks: ${CHAINS.length}`);
}

async function seedAssets() {
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
      .onConflictDoUpdate({ target: [assets.symbol, assets.chainKey, assets.contractAddress], set: { priceUsd: row.priceUsd, decimals: row.decimals } });
  }
  console.log(`  assets: ${rows.length}`);
}

async function seedProtocols() {
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
      .values({ id: deterministicId("protocol", p.key), key: p.key, name: p.name, category: p.category, chainKeys: ["ethereum-sepolia", "base-sepolia"] as never })
      .onConflictDoUpdate({ target: protocols.key, set: { name: p.name, category: p.category } });
  }
  console.log(`  protocols: ${list.length}`);
}

async function seedDemoAccounts() {
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
      .onConflictDoUpdate({ target: wallets.id, set: { userId: materialized.userId, address: materialized.address, status: "CONNECTED", label: fixture.label } });
    await ensureCreditAccount(materialized.walletId, materialized.userId, 0, 0);
  }
  console.log(`  demo accounts: ${DEMO_SCENARIO_KEYS.length}`);
}

async function seedFarmScenarios() {
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
        // The sandbox wallet is created on first run by `runFarmTest`, which
        // then stamps it here. Kept null at seed time to respect the FK.
        walletId: null,
        activityCount: materialized.events.length,
        volumeUsdCents: materialized.volumeUsdCents,
      })
      .onConflictDoUpdate({
        target: farmTestScenarios.key,
        set: { description: fixture.description, narrative: fixture.narrative, activityCount: materialized.events.length, volumeUsdCents: materialized.volumeUsdCents },
      });
  }
  console.log(`  farm scenarios: ${FARM_SCENARIO_KEYS.length} (${farmWalletAddress("manufactured").slice(0, 10)}…, ${farmWalletAddress("genuine").slice(0, 10)}…)`);
}

/** Ingest + attest + normalise every demo scenario, without awarding credit. */
async function ingestDemoEvidence() {
  for (const key of DEMO_SCENARIO_KEYS) {
    const materialized = materializeScenario(key);
    const result = await syncWalletEvidence({
      walletId: materialized.walletId,
      userId: materialized.userId,
      address: materialized.address,
      isDemo: true,
      chainKeys: [...materialized.fixture.chainKeys],
      ipAddress: "seed",
    });
    console.log(
      `  ${key.padEnd(26)} events=${String(result.eventCount).padStart(2)} verified=${String(result.attested.verified).padStart(2)} pending=${String(result.attested.pending).padStart(2)}`,
    );
  }
}

/**
 * Clear derived state for one wallet so the seed is safely re-runnable: raw facts
 * and normalised events are kept, but every evaluation, decision and credit
 * movement is removed and events become eligible again.
 */
async function resetDerivedState(walletId: string) {
  const { creditDecisions, creditTransactions, evidenceEvaluations, evidenceEventLinks, evidenceFactors, borrowPositions, repayments } =
    await import("../src/db/schema");
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

/**
 * Scenario E ships with an existing, engine-derived credit state: run the real
 * pipeline to award credit, then take a real draw against it.
 */
async function seedCreditedScenario() {
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
  console.log(
    `  ${key.padEnd(26)} evidenceScore=${decision?.evidenceScore.toFixed(4)} increase=$${((decision?.creditIncreaseUsdCents ?? 0) / 100).toFixed(2)} limit=$${((decision?.newLimitUsdCents ?? 0) / 100).toFixed(2)}`,
  );

  if (decision && decision.awarded && decision.newLimitUsdCents > 30_000) {
    try {
      const draw = await borrow({
        walletId: materialized.walletId,
        userId: materialized.userId,
        address: materialized.address,
        isDemo: true,
        amountUsd: 300,
        idempotencyKey: `seed-borrow:${materialized.walletId}`,
        ipAddress: "seed",
      });
      console.log(`  ${key.padEnd(26)} seeded borrow $300.00 -> position ${draw.positionId}`);
    } catch (err) {
      console.log(`  ${key.padEnd(26)} borrow skipped: ${(err as Error).message}`);
    }
  }
}

async function main() {
  console.log("BASIS seed");
  console.log(`  mode=${process.env.APP_MODE ?? "demo"} now=${new Date(DEMO_NOW).toISOString()}`);
  console.log(`  credit: maxBatchIncrease=$${creditConfig.maxBatchIncreaseUsdCents / 100} threshold=${creditConfig.minEvidenceThreshold}`);

  await seedNetworks();
  await seedAssets();
  await seedProtocols();
  await seedDemoAccounts();
  await seedFarmScenarios();
  await ingestDemoEvidence();
  await seedCreditedScenario();

  const eventCount = await db.select({ id: economicEvents.id }).from(economicEvents);
  const accountCount = await db.select({ id: creditAccounts.id }).from(creditAccounts).where(eq(creditAccounts.provider, "demo"));
  console.log(`  totals: ${eventCount.length} economic events, ${accountCount.length} credit accounts`);
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
