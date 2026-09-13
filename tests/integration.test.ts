/**
 * End-to-end integration test against a real PostgreSQL database in APP_MODE=demo.
 *
 * Run: npx tsx --test tests/integration.test.ts
 *
 *   LOGIN -> CONNECT DEMO WALLET -> BUILD CREDIT -> VERIFY -> EVALUATE
 *     -> CREDIT DECISION -> CREDIT LIMIT UPDATED -> BORROW -> REPAY
 *     -> ACTIVITY UPDATED
 *
 * No external blockchain service is contacted at any point.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  creditAccounts,
  creditDecisions,
  creditTransactions,
  economicEvents,
  evidenceEvaluations,
  borrowPositions,
  repayments,
} from "../src/db/schema";
import { creditConfig } from "../src/lib/config";
import { materializeScenario } from "../src/providers/demo/fixtures";
import { demoSign, issueNonce, verifySignatureAndCreateSession } from "../src/services/auth";
import { connectWallet, enabledChainKeys, listNetworks } from "../src/services/wallets";
import { runBuildCreditPipeline } from "../src/services/pipeline";
import { borrow, getCreditView, repay } from "../src/services/credit";
import { listActivity, listEventsForEvidence, getEventDetail, getLatestEvaluation } from "../src/services/evidence";
import { runFarmTest } from "../src/services/farm-test";

const strong = materializeScenario("strong-history");

async function resetStrongWallet() {
  await db.delete(creditTransactions).where(eq(creditTransactions.walletId, strong.walletId));
  await db.delete(repayments).where(eq(repayments.walletId, strong.walletId));
  await db.delete(borrowPositions).where(eq(borrowPositions.walletId, strong.walletId));
  await db.delete(creditDecisions).where(eq(creditDecisions.walletId, strong.walletId));
  await db.delete(evidenceEvaluations).where(eq(evidenceEvaluations.walletId, strong.walletId));
  await db.update(economicEvents).set({ creditedAt: null, lastEvaluationId: null }).where(eq(economicEvents.walletId, strong.walletId));
  await db
    .update(creditAccounts)
    .set({ creditLimitUsdCents: 0, borrowedUsdCents: 0, totalAwardedUsdCents: 0, totalRepaidUsdCents: 0, evaluationCount: 0, lastEvaluatedAt: null, version: 0 })
    .where(eq(creditAccounts.walletId, strong.walletId));
}

describe("BASIS end-to-end demo flow", () => {
  let session: Awaited<ReturnType<typeof verifySignatureAndCreateSession>>;

  before(async () => {
    await resetStrongWallet();
  });

  after(async () => {
    await pool.end().catch(() => {});
  });

  test("1. login: nonce -> signature -> verified session", async () => {
    const nonce = await issueNonce({ address: strong.address, origin: "http://localhost:3000", ip: "test" });
    assert.ok(nonce.message.includes(strong.address));
    assert.ok(nonce.message.includes(nonce.nonce));

    const signed = await demoSign({ address: strong.address, message: nonce.message });
    assert.match(signed.signature, /^0x[0-9a-f]{64}$/);

    session = await verifySignatureAndCreateSession({
      address: strong.address,
      signature: signed.signature,
      nonce: nonce.nonce,
      ip: "test",
      userAgent: "integration-test",
    });
    assert.equal(session.walletId, strong.walletId);
    assert.equal(session.isDemoWallet, true);
    assert.ok(session.sessionToken.length >= 32);
  });

  test("2. a replayed nonce is rejected", async () => {
    const nonce = await issueNonce({ address: strong.address, origin: "http://localhost:3000", ip: "test" });
    const signed = await demoSign({ address: strong.address, message: nonce.message });
    await verifySignatureAndCreateSession({ address: strong.address, signature: signed.signature, nonce: nonce.nonce, ip: "test" });
    await assert.rejects(
      () => verifySignatureAndCreateSession({ address: strong.address, signature: signed.signature, nonce: nonce.nonce, ip: "test" }),
      /already been used/,
    );
  });

  test("3. a forged signature is rejected", async () => {
    const nonce = await issueNonce({ address: strong.address, origin: "http://localhost:3000", ip: "test" });
    await assert.rejects(
      () =>
        verifySignatureAndCreateSession({
          address: strong.address,
          signature: `0x${"ab".repeat(32)}`,
          nonce: nonce.nonce,
          ip: "test",
        }),
      /does not match the demo signer|Signature/,
    );
  });

  test("4. connect demo wallet and select networks", async () => {
    const connected = await connectWallet({
      userId: session.userId,
      address: strong.address,
      chainKeys: [...strong.fixture.chainKeys],
      sessionId: session.sessionToken,
      ipAddress: "test",
    });
    assert.equal(connected.walletId, strong.walletId);
    assert.deepEqual(connected.chainKeys, [...strong.fixture.chainKeys]);

    const chains = await enabledChainKeys(strong.walletId);
    assert.ok(chains.includes("ethereum-sepolia"));
    const networks = await listNetworks();
    assert.ok(networks.length >= 4);
  });

  test("5. build credit: verify -> evaluate -> decision -> limit updated", async () => {
    const steps: string[] = [];
    const result = await runBuildCreditPipeline(
      {
        walletId: strong.walletId,
        userId: strong.userId,
        address: strong.address,
        isDemo: true,
        chainKeys: [...strong.fixture.chainKeys],
        ipAddress: "test",
      },
      { reporter: ({ step }) => void steps.push(step) },
    );

    assert.deepEqual(steps, [
      "SYNC_WALLET",
      "FETCH_TRANSACTIONS",
      "BUILD_PROOFS",
      "ATTEST_EVENTS",
      "NORMALIZE_EVENTS",
      "BUILD_EVIDENCE",
      "EVALUATE",
      "CREDIT_DECISION",
      "CREDIT_UPDATE",
    ]);

    assert.equal(result.eventCount, 11);
    assert.equal(result.attested.verified, 11);
    assert.ok(result.evidence);
    assert.equal(result.evidence!.strength, "strong");
    assert.ok(result.decision?.awarded, `expected credit to be awarded, blockedBy=${result.decision?.blockedBy.join(",")}`);
    assert.equal(result.decision!.previousLimitUsdCents, 0);
    assert.equal(result.decision!.newLimitUsdCents, result.decision!.creditIncreaseUsdCents);
    assert.equal(
      result.decision!.creditIncreaseUsdCents,
      Math.round(creditConfig.maxBatchIncreaseUsdCents * result.evidence!.evidenceScore),
    );
    assert.ok(result.decision!.creditIncreaseUsdCents > 400_000 && result.decision!.creditIncreaseUsdCents < 440_000);
    assert.ok(result.evaluationId && result.decisionId);
  });

  test("6. the decision is persisted with its evidence hash and explanations", async () => {
    const evaluation = await getLatestEvaluation(strong.walletId);
    assert.ok(evaluation);
    assert.equal(evaluation!.strength, "strong");
    assert.ok(evaluation!.evidenceHash.length === 64);
    const factors = evaluation!.factors as unknown as { key: string; explanation: string }[];
    assert.equal(factors.length, 3);
    for (const factor of factors) assert.ok(factor.explanation.length > 20, `${factor.key} needs an explanation`);

    const view = await getCreditView(strong.walletId);
    assert.equal(view.account!.creditLimit.cents, evaluation!.eventCount > 0 ? view.account!.creditLimit.cents : 0);
    assert.ok(view.account!.creditLimit.cents > 400_000);
    assert.equal(view.latestDecision!.awarded, true);
    assert.equal(view.transactions.filter((t) => t.kind === "AWARD").length, 1);
  });

  test("7. re-running the pipeline cannot award credit twice", async () => {
    const before = (await getCreditView(strong.walletId)).account!.creditLimit.cents;
    const result = await runBuildCreditPipeline({
      walletId: strong.walletId,
      userId: strong.userId,
      address: strong.address,
      isDemo: true,
      chainKeys: [...strong.fixture.chainKeys],
      ipAddress: "test",
    });
    const after = (await getCreditView(strong.walletId)).account!.creditLimit.cents;
    assert.equal(after, before, "credit limit must not change on a duplicate run");
    assert.equal(result.decision?.awarded, false);
    assert.ok(
      (result.decision?.blockedBy ?? []).some((g) => ["no_new_events", "duplicate_evidence_hash", "cooldown_active"].includes(g)),
      `unexpected guardrails: ${result.decision?.blockedBy.join(",")}`,
    );
  });

  test("8. borrow draws against available credit and updates the account", async () => {
    const before = (await getCreditView(strong.walletId)).account!;
    const draw = await borrow({
      walletId: strong.walletId,
      userId: strong.userId,
      address: strong.address,
      isDemo: true,
      amountUsd: 500,
      idempotencyKey: "integration-borrow-1",
      ipAddress: "test",
    });
    assert.equal(draw.amount.cents, 50_000);
    const after = draw.credit.account!;
    assert.equal(after.borrowed.cents, before.borrowed.cents + 50_000);
    assert.equal(after.available.cents, before.available.cents - 50_000);
    assert.equal(after.creditLimit.cents, before.creditLimit.cents);
    assert.ok(after.utilization > 0);
    assert.equal(draw.settlement.settled, true);
  });

  test("9. over-borrowing is rejected by the backend", async () => {
    const account = (await getCreditView(strong.walletId)).account!;
    await assert.rejects(
      () =>
        borrow({
          walletId: strong.walletId,
          userId: strong.userId,
          address: strong.address,
          isDemo: true,
          amountUsd: account.available.usd + 1,
          ipAddress: "test",
        }),
      /available/,
    );
  });

  test("10. a duplicated idempotency key cannot double-spend", async () => {
    await assert.rejects(
      () =>
        borrow({
          walletId: strong.walletId,
          userId: strong.userId,
          address: strong.address,
          isDemo: true,
          amountUsd: 10,
          idempotencyKey: "integration-borrow-1",
          ipAddress: "test",
        }),
      /already been processed/,
    );
  });

  test("11. repay reduces the balance and restores available credit", async () => {
    const before = (await getCreditView(strong.walletId)).account!;
    const result = await repay({
      walletId: strong.walletId,
      userId: strong.userId,
      address: strong.address,
      isDemo: true,
      amountUsd: 200,
      idempotencyKey: "integration-repay-1",
      ipAddress: "test",
    });
    const after = result.credit.account!;
    assert.equal(after.borrowed.cents, before.borrowed.cents - 20_000);
    assert.equal(after.available.cents, before.available.cents + 20_000);
    assert.equal(after.creditLimit.cents, before.creditLimit.cents);
  });

  test("12. over-repaying is rejected", async () => {
    const account = (await getCreditView(strong.walletId)).account!;
    await assert.rejects(
      () =>
        repay({
          walletId: strong.walletId,
          userId: strong.userId,
          address: strong.address,
          isDemo: true,
          amountUsd: account.borrowed.usd + 1,
          ipAddress: "test",
        }),
      /exceeds the outstanding balance/,
    );
  });

  test("13. activity reflects the same economic events, plus credit movements", async () => {
    const activity = await listActivity({ walletId: strong.walletId, limit: 50 });
    assert.equal(activity.items.length, 11);
    assert.ok(activity.items.every((item) => item.verified));

    const events = await listEventsForEvidence(strong.walletId);
    assert.equal(events.length, 11);

    const detail = await getEventDetail(strong.walletId, events[0].id);
    assert.ok(detail.txHash.startsWith("0x"));
    assert.ok(detail.blockHeight > 0);
    assert.ok(detail.attestation, "event must expose its Attestcoin verification object");
    assert.equal(detail.attestation!.verified, true);
    assert.ok(detail.attestation!.merkleRoot);
    assert.ok(detail.attestation!.proofReference);
    assert.ok(detail.interpretation.length > 10);

    const view = await getCreditView(strong.walletId);
    assert.equal(view.transactions.filter((t) => t.kind === "BORROW").length, 1);
    assert.equal(view.transactions.filter((t) => t.kind === "REPAY").length, 1);
    assert.equal(view.positions.length, 1);
    assert.equal(view.positions[0].outstanding.cents, 30_000);
  });

  test("14. Farm Test: manufactured vs genuine produce different outcomes", async () => {
    const manufactured = await runFarmTest({ scenarioKey: "manufactured", ipAddress: "test" });
    const genuine = await runFarmTest({ scenarioKey: "genuine", ipAddress: "test" });

    assert.equal(manufactured.activityCount, 6);
    assert.equal(manufactured.volumeUsdCents, 60_000);
    assert.equal(manufactured.creditIncreaseUsdCents, 0);
    assert.equal(manufactured.awarded, false);
    assert.match(manufactured.headline, /activity/i);

    assert.equal(genuine.activityCount, 11);
    assert.equal(genuine.awarded, true);
    assert.ok(genuine.creditIncreaseUsdCents > 400_000);
    assert.equal(genuine.creditBeforeUsdCents, 0);
    assert.equal(genuine.creditAfterUsdCents, genuine.creditIncreaseUsdCents);

    assert.ok(genuine.evidence.evidenceScore > manufactured.evidence.evidenceScore * 8);
    assert.ok(genuine.evidence.capitalIndependence > manufactured.evidence.capitalIndependence);
    assert.ok(genuine.evidence.economicDiversity > manufactured.evidence.economicDiversity);
    assert.ok(genuine.evidence.behavioralCoherence > manufactured.evidence.behavioralCoherence);
    assert.ok(manufactured.evidence.explanations.capitalIndependence.length > 20);
    assert.ok(manufactured.evidence.explanations.behavioralCoherence.length > 20);
  });

  test("15. Farm Test runs are reproducible", async () => {
    const first = await runFarmTest({ scenarioKey: "manufactured", ipAddress: "test" });
    const second = await runFarmTest({ scenarioKey: "manufactured", ipAddress: "test" });
    assert.equal(first.evidence.evidenceScore, second.evidence.evidenceScore);
    assert.equal(first.creditIncreaseUsdCents, second.creditIncreaseUsdCents);
  });

  test("16. an unknown Farm Test scenario is rejected", async () => {
    await assert.rejects(() => runFarmTest({ scenarioKey: "not-a-scenario" }), /Unknown Farm Test scenario/);
  });
});
