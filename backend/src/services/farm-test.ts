/**
 * Farm Test.
 *
 * Two deterministic scenarios run through the *real* pipeline: identical
 * normalizer, identical evidence engine, identical credit engine and identical
 * guardrails. The backend owns the result — the frontend only renders it.
 *
 *   manufactured : six transactions, $600 of volume, one counterparty, circular
 *   genuine      : independently funded, diverse, coherent economic history
 *
 * Each run resets its sandbox wallet first, so results are reproducible and a
 * Farm Test can never mutate a user's real credit account.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attestations,
  borrowPositions,
  creditAccounts,
  creditDecisions,
  creditTransactions,
  economicEvents,
  evidenceEvaluations,
  evidenceEventLinks,
  evidenceFactors,
  farmTestRuns,
  farmTestScenarios,
  jobs,
  rawLogs,
  rawTransactions,
  repayments,
  users,
  wallets,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { deterministicId } from "@/lib/deterministic";
import { centsToUsd, sum } from "@/lib/money";
import {
  DEMO_SCENARIOS,
  FARM_SCENARIO_KEYS,
  FARM_SCENARIO_MAP,
  farmWalletAddress,
  farmWalletId,
  materializeScenario,
  type FarmScenarioKey,
} from "@/providers/demo/fixtures";
import { executeJob } from "./jobs";
import { audit } from "./audit";
import { money } from "./serializers";

export function isFarmScenarioKey(value: string): value is FarmScenarioKey {
  return (FARM_SCENARIO_KEYS as readonly string[]).includes(value);
}

export async function listFarmScenarios() {
  const stored = await db.select().from(farmTestScenarios);
  if (stored.length > 0) {
    return stored.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      narrative: row.narrative,
      expectation: row.expectation,
      activityCount: row.activityCount,
      volume: money(row.volumeUsdCents),
      walletId: row.walletId,
    }));
  }
  return FARM_SCENARIO_KEYS.map((key) => {
    const fixture = DEMO_SCENARIOS[FARM_SCENARIO_MAP[key]];
    const materialized = materializeScenario(FARM_SCENARIO_MAP[key]);
    return {
      key,
      label: key === "manufactured" ? "Manufactured activity" : "Genuine activity",
      description: fixture.description,
      narrative: fixture.narrative,
      expectation: fixture.expectation,
      activityCount: materialized.events.length,
      volume: money(materialized.volumeUsdCents),
      walletId: farmWalletId(key),
    };
  });
}

export interface FarmTestRunInput {
  scenarioKey: string;
  userId?: string | null;
  ipAddress?: string | null;
}

export async function runFarmTest(input: FarmTestRunInput) {
  if (!isFarmScenarioKey(input.scenarioKey)) {
    throw new AppError("validation_error", `Unknown Farm Test scenario "${input.scenarioKey}".`, {
      details: { available: [...FARM_SCENARIO_KEYS] },
    });
  }
  const scenarioKey = input.scenarioKey;
  const fixtureKey = FARM_SCENARIO_MAP[scenarioKey];
  const fixture = DEMO_SCENARIOS[fixtureKey];
  const walletId = farmWalletId(scenarioKey);
  const address = farmWalletAddress(scenarioKey);
  const userId = input.userId ?? `usr_farm_${scenarioKey}`;
  const accountId = deterministicId("account", walletId);

  // ---- Reset the sandbox so every run is deterministic --------------------
  // Scoped strictly to this sandbox wallet: a Farm Test can never touch another
  // wallet's facts, evidence or credit state.
  const priorRaw = await db.select({ txHash: rawTransactions.txHash, chainKey: rawTransactions.chainKey }).from(rawTransactions).where(eq(rawTransactions.walletId, walletId));
  const priorEvaluations = await db.select({ id: evidenceEvaluations.id }).from(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, walletId));

  await db.delete(farmTestRuns).where(eq(farmTestRuns.scenarioKey, scenarioKey));
  await db.delete(evidenceEventLinks).where(eq(evidenceEventLinks.walletId, walletId));
  if (priorEvaluations.length > 0) {
    await db.delete(evidenceFactors).where(inArray(evidenceFactors.evaluationId, priorEvaluations.map((e) => e.id)));
  }
  await db.delete(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, walletId));
  await db.delete(creditDecisions).where(eq(creditDecisions.walletId, walletId));
  await db.delete(creditTransactions).where(eq(creditTransactions.walletId, walletId));
  await db.delete(repayments).where(eq(repayments.walletId, walletId));
  await db.delete(borrowPositions).where(eq(borrowPositions.walletId, walletId));
  await db.delete(economicEvents).where(eq(economicEvents.walletId, walletId));
  if (priorRaw.length > 0) {
    await db.delete(rawLogs).where(inArray(rawLogs.txHash, priorRaw.map((r) => r.txHash)));
    await db
      .delete(attestations)
      .where(inArray(attestations.sourceTxHash, priorRaw.map((r) => r.txHash)));
  }
  await db.delete(rawTransactions).where(eq(rawTransactions.walletId, walletId));
  await db.delete(jobs).where(eq(jobs.walletId, walletId));

  await db.insert(users).values({ id: userId, mode: "demo", label: `Farm Test (${scenarioKey})` }).onConflictDoNothing({ target: users.id });
  await db
    .insert(wallets)
    .values({ id: walletId, userId, address, family: "evm", label: `Farm Test — ${fixture.label}`, isDemo: true, scenarioKey: fixtureKey, status: "CONNECTED" })
    .onConflictDoUpdate({ target: wallets.id, set: { userId, address, status: "CONNECTED", updatedAt: new Date() } });
  await db
    .insert(creditAccounts)
    .values({ id: accountId, walletId, userId, creditLimitUsdCents: 0, borrowedUsdCents: 0, provider: "demo", version: 0 })
    .onConflictDoUpdate({
      target: creditAccounts.id,
      set: { creditLimitUsdCents: 0, borrowedUsdCents: 0, totalAwardedUsdCents: 0, totalRepaidUsdCents: 0, evaluationCount: 0, lastEvaluatedAt: null, version: 0, updatedAt: new Date() },
    });

  // ---- Run the real pipeline synchronously through a real job -------------
  const jobId = deterministicId("job", "FARM_TEST", walletId, scenarioKey, Date.now().toString());
  await db.insert(farmTestScenarios).values({
    key: scenarioKey,
    label: scenarioKey === "manufactured" ? "Manufactured activity" : "Genuine activity",
    description: fixture.description,
    narrative: fixture.narrative,
    expectation: fixture.expectation,
    fixtureKey,
    walletId,
    activityCount: fixture.events.length,
    volumeUsdCents: sum(materializeScenario(fixtureKey).events.map((e) => e.amountUsdCents)),
  }).onConflictDoUpdate({ target: farmTestScenarios.key, set: { walletId, activityCount: fixture.events.length, description: fixture.description } });

  await db.insert(jobs).values({
    id: jobId,
    type: "BUILD_CREDIT",
    status: "QUEUED",
    progress: 0,
    walletId,
    userId,
    payload: { farmTest: true, scenarioKey } as never,
    steps: [] as never,
  });

  await executeJob(
    jobId,
    {
      walletId,
      userId,
      address,
      isDemo: true,
      chainKeys: [...fixture.chainKeys],
      jobId,
      ipAddress: input.ipAddress ?? null,
    },
    "BUILD_CREDIT",
  );
  const evaluationRowsAfter = await db
    .select()
    .from(evidenceEvaluations)
    .where(eq(evidenceEvaluations.walletId, walletId))
    .limit(1);
  const decisionRows = await db.select().from(creditDecisions).where(eq(creditDecisions.walletId, walletId)).limit(1);
  const accountRows = await db.select().from(creditAccounts).where(eq(creditAccounts.id, accountId)).limit(1);
  const eventRows = await db.select().from(economicEvents).where(eq(economicEvents.walletId, walletId));

  const evaluation = evaluationRowsAfter[0] ?? null;
  const decision = decisionRows[0] ?? null;
  const account = accountRows[0] ?? null;
  if (!evaluation || !decision || !account) {
    throw new AppError("job_failed", "Farm Test pipeline did not produce an evaluation and decision.");
  }

  const dimensions = (evaluation.dimensions ?? {}) as Record<string, { value: number; explanation: string }>;
  const increaseCents = decision.creditIncreaseUsdCents;
  const activityCount = eventRows.length;
  const volumeCents = sum(eventRows.map((e) => e.amountUsdCents));

  const headline =
    scenarioKey === "manufactured"
      ? decision.awarded
        ? "More activity produced almost no credit."
        : "More activity didn't mean more credit."
      : decision.awarded
        ? "Genuine economic activity produced credit."
        : "Genuine activity was observed but did not clear the underwriting threshold.";

  const detail =
    scenarioKey === "manufactured"
      ? `You created activity. You didn't create economic evidence. ${activityCount} transactions and $${centsToUsd(volumeCents).toFixed(2)} of volume all moved between the wallet and the single address that funded it, so capital independence, diversity and coherence all collapse.`
      : `Independently funded capital, distinct counterparties, multiple protocols and a coherent economic sequence produced an evidence score of ${evaluation.evidenceScore.toFixed(4)}, which the credit engine converted into $${centsToUsd(increaseCents).toFixed(2)} of new credit — the same engine that awarded the farmed wallet nothing.`;

  await db.insert(farmTestRuns).values({
    id: deterministicId("scenario", walletId, evaluation.id),
    scenarioKey,
    walletId,
    userId,
    evaluationId: evaluation.id,
    decisionId: decision.id,
    jobId,
    activityCount,
    evidenceScore: evaluation.evidenceScore,
    creditIncreaseUsdCents: increaseCents,
    result: { headline, detail } as never,
  });

  await audit({
    action: "farm_test.run",
    userId,
    walletId,
    referenceId: evaluation.id,
    ipAddress: input.ipAddress,
    metadata: { scenarioKey, evidenceScore: evaluation.evidenceScore, increaseCents },
  });

  return {
    scenarioKey,
    label: scenarioKey === "manufactured" ? "Manufactured activity" : "Genuine activity",
    activityCount,
    verifiedActivityCount: eventRows.filter((e) => e.verified).length,
    volumeUsdCents: volumeCents,
    evidence: {
      evidenceScore: evaluation.evidenceScore,
      strength: evaluation.strength,
      capitalIndependence: evaluation.capitalIndependence,
      economicDiversity: evaluation.economicDiversity,
      behavioralCoherence: evaluation.behavioralCoherence,
      explanations: {
        capitalIndependence: dimensions.capitalIndependence?.explanation ?? "",
        economicDiversity: dimensions.economicDiversity?.explanation ?? "",
        behavioralCoherence: dimensions.behavioralCoherence?.explanation ?? "",
      },
    },
    creditBeforeUsdCents: decision.previousLimitUsdCents,
    creditIncreaseUsdCents: increaseCents,
    creditAfterUsdCents: decision.newLimitUsdCents,
    awarded: decision.awarded,
    blockedBy: decision.blockedBy as string[],
    headline,
    detail,
    evaluationId: evaluation.id,
    decisionId: decision.id,
    jobId,
    events: eventRows.map((row) => ({
      id: row.id,
      type: row.type,
      chainKey: row.chainKey,
      blockHeight: row.blockHeight,
      txHash: row.txHash,
      timestamp: row.timestampMs,
      from: row.from,
      to: row.to,
      asset: row.asset,
      amountRaw: row.amountRaw,
      amountUsdCents: row.amountUsdCents,
      protocol: row.protocol,
      verified: row.verified,
      metadata: row.metadata as Record<string, unknown>,
    })),
  };
}


