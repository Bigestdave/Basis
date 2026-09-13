/**
 * Build Credit pipeline.
 *
 *   SYNC_WALLET -> FETCH_TRANSACTIONS -> BUILD_PROOFS -> ATTEST_EVENTS
 *     -> NORMALIZE_EVENTS -> BUILD_EVIDENCE -> EVALUATE -> CREDIT_DECISION
 *     -> CREDIT_UPDATE
 *
 * Every step is independently runnable, independently testable, and idempotent:
 * re-running the pipeline over the same chain data creates no duplicate raw
 * transactions, no duplicate economic events, no duplicate evaluations and no
 * duplicate credit. Demo and live mode execute this exact same function; only
 * the injected providers differ.
 */
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  attestations,
  creditAccounts,
  creditDecisions,
  creditTransactions,
  economicEvents,
  evidenceEvaluations,
  evidenceEventLinks,
  evidenceFactors,
  rawLogs,
  rawTransactions,
  walletNetworks,
} from "@/db/schema";
import { creditConfig, EVIDENCE_ENGINE_VERSION } from "@/lib/config";
import { deterministicId, normalizeAddress, sha256Hex } from "@/lib/deterministic";
import { AppError } from "@/lib/errors";
import { normalizeActivity } from "@/domain/normalizer";
import { evaluateEvidence } from "@/domain/evidence/engine";
import { decideCredit } from "@/domain/credit/engine";
import { projectAccount } from "@/domain/credit/account";
import type { EconomicEvent, EvidenceResult, JobStep } from "@/domain/types";
import type { AttestationVerification, RawChainLog, RawChainTransaction } from "@/providers/types";
import { getProvidersForWallet } from "@/providers";
import { ensureCreditAccount } from "./auth";
import { audit } from "./audit";

export interface PipelineContext {
  walletId: string;
  userId: string;
  address: string;
  isDemo: boolean;
  chainKeys: string[];
  jobId?: string | null;
  ipAddress?: string | null;
}

export interface StepReport {
  step: JobStep;
  detail?: string;
  metrics?: Record<string, number | string | boolean>;
}

export type StepReporter = (report: StepReport) => Promise<void> | void;

export interface PipelineResult {
  walletId: string;
  rawTransactionCount: number;
  newRawTransactionCount: number;
  attested: { verified: number; pending: number; failed: number };
  eventCount: number;
  newEventCount: number;
  staleEventCount: number;
  eligibleEventCount: number;
  evaluationId: string | null;
  decisionId: string | null;
  evidence: EvidenceResult | null;
  decision: {
    previousLimitUsdCents: number;
    creditIncreaseUsdCents: number;
    newLimitUsdCents: number;
    availableUsdCents: number;
    utilization: number;
    awarded: boolean;
    blockedBy: string[];
    guardrailNotes: string[];
    evidenceScore: number;
    strength: string;
    settled: boolean;
    settlementReference: string | null;
  } | null;
  account: {
    creditLimitUsdCents: number;
    borrowedUsdCents: number;
    availableUsdCents: number;
    utilization: number;
  } | null;
  duplicateEvaluation: boolean;
}

const rawTxId = (chainKey: string, txHash: string) => `rtx_${sha256Hex(`${chainKey}|${txHash.toLowerCase()}`).slice(0, 32)}`;
const rawLogId = (chainKey: string, txHash: string, logIndex: number) =>
  `rlg_${sha256Hex(`${chainKey}|${txHash.toLowerCase()}|${logIndex}`).slice(0, 32)}`;
const attestationIdFor = (provider: string, chainKey: string, txHash: string) =>
  `atc_${sha256Hex(`${provider}|${chainKey}|${txHash.toLowerCase()}`).slice(0, 32)}`;

export async function runBuildCreditPipeline(
  ctx: PipelineContext,
  options: { reporter?: StepReporter; evaluate?: boolean; fetchLimit?: number } = {},
): Promise<PipelineResult> {
  const report = options.reporter ?? (async () => {});
  const shouldEvaluate = options.evaluate ?? true;
  const bundle = await getProvidersForWallet(ctx.isDemo);

  const result: PipelineResult = {
    walletId: ctx.walletId,
    rawTransactionCount: 0,
    newRawTransactionCount: 0,
    attested: { verified: 0, pending: 0, failed: 0 },
    eventCount: 0,
    newEventCount: 0,
    staleEventCount: 0,
    eligibleEventCount: 0,
    evaluationId: null,
    decisionId: null,
    evidence: null,
    decision: null,
    account: null,
    duplicateEvaluation: false,
  };

  /* ------------------------------ SYNC_WALLET ---------------------------- */
  await ensureCreditAccount(ctx.walletId, ctx.userId);
  for (const chainKey of ctx.chainKeys) {
    await db
      .insert(walletNetworks)
      .values({ id: deterministicId("connection", ctx.walletId, chainKey), walletId: ctx.walletId, networkKey: chainKey, enabled: true })
      .onConflictDoNothing({ target: [walletNetworks.walletId, walletNetworks.networkKey] });
  }
  await report({ step: "SYNC_WALLET", detail: `Wallet ${normalizeAddress(ctx.address)} synced across ${ctx.chainKeys.length} network(s).`, metrics: { networks: ctx.chainKeys.length } });

  /* --------------------------- FETCH_TRANSACTIONS ------------------------ */
  const page = await bundle.chainData.getWalletActivity({
    walletAddress: ctx.address,
    chainKeys: ctx.chainKeys,
    limit: options.fetchLimit ?? 200,
  });
  result.rawTransactionCount = page.transactions.length;
  let newRaw = 0;
  for (const tx of page.transactions) {
    const id = rawTxId(tx.chainKey, tx.txHash);
    const inserted = await db
      .insert(rawTransactions)
      .values({
        id,
        walletId: ctx.walletId,
        chainKey: tx.chainKey,
        txHash: tx.txHash.toLowerCase(),
        blockHeight: tx.blockHeight,
        from: normalizeAddress(tx.from),
        to: tx.to ? normalizeAddress(tx.to) : null,
        valueRaw: tx.valueRaw,
        data: tx.data,
        status: tx.status,
        timestampMs: tx.timestampMs,
        metadata: { blockHash: tx.blockHash, source: page.source },
      })
      .onConflictDoNothing({ target: [rawTransactions.chainKey, rawTransactions.txHash] })
      .returning({ id: rawTransactions.id });
    if (inserted.length > 0) newRaw += 1;

    for (const log of tx.logs) {
      await db
        .insert(rawLogs)
        .values({
          id: rawLogId(tx.chainKey, tx.txHash, log.logIndex),
          rawTransactionId: id,
          chainKey: tx.chainKey,
          txHash: tx.txHash.toLowerCase(),
          logIndex: log.logIndex,
          address: normalizeAddress(log.address),
          topics: log.topics,
          data: log.data,
          decoded: (log.decoded ?? null) as never,
        })
        .onConflictDoNothing({ target: [rawLogs.chainKey, rawLogs.txHash, rawLogs.logIndex] });
    }
  }
  result.newRawTransactionCount = newRaw;
  await report({
    step: "FETCH_TRANSACTIONS",
    detail: `${page.transactions.length} raw transaction(s) fetched via ${page.source}; ${newRaw} new.`,
    metrics: { fetched: page.transactions.length, new: newRaw, source: page.source },
  });
  await audit({
    action: "evidence.events_ingested",
    userId: ctx.userId,
    walletId: ctx.walletId,
    ipAddress: ctx.ipAddress,
    metadata: { fetched: page.transactions.length, newRaw, source: page.source },
  });

  /* ------------------------------ BUILD_PROOFS --------------------------- */
  const storedTxs = await db
    .select()
    .from(rawTransactions)
    .where(eq(rawTransactions.walletId, ctx.walletId))
    .orderBy(asc(rawTransactions.timestampMs));
  const storedLogs = await db
    .select()
    .from(rawLogs)
    .where(inArray(rawLogs.chainKey, ctx.chainKeys.length > 0 ? ctx.chainKeys : storedTxs.map((t) => t.chainKey)));

  const existingAttestations = await db
    .select()
    .from(attestations)
    .where(inArray(attestations.chainKey, [...new Set(storedTxs.map((t) => t.chainKey))]));
  const attestationByTx = new Map(existingAttestations.map((a) => [`${a.chainKey}:${a.sourceTxHash.toLowerCase()}`, a]));

  const proofCandidates = storedTxs.filter((tx) => {
    const existing = attestationByTx.get(`${tx.chainKey}:${tx.txHash.toLowerCase()}`);
    return !existing || (!existing.verified && existing.status !== "FAILED");
  });
  await report({
    step: "BUILD_PROOFS",
    detail: `${proofCandidates.length} of ${storedTxs.length} transaction(s) require an inclusion proof.`,
    metrics: { totalTransactions: storedTxs.length, proofCandidates: proofCandidates.length },
  });

  /* ----------------------------- ATTEST_EVENTS --------------------------- */
  const CHUNK = 10;
  const verifications: AttestationVerification[] = [];
  for (let i = 0; i < proofCandidates.length; i += CHUNK) {
    const chunk = proofCandidates.slice(i, i + CHUNK);
    const batch = await bundle.attestation.verifyOrdering(
      chunk.map((tx) => ({
        chainKey: tx.chainKey,
        txHash: tx.txHash,
        blockHeight: tx.blockHeight,
        walletAddress: ctx.address,
        waitForAttestation: false,
      })),
    );
    verifications.push(...batch);
  }
  for (const verification of verifications) {
    if (verification.verified) result.attested.verified += 1;
    else if (verification.status === "AWAITING_ATTESTATION" || verification.status === "PENDING") result.attested.pending += 1;
    else result.attested.failed += 1;

    await db
      .insert(attestations)
      .values({
        id: attestationIdFor(verification.provider, verification.chainKey, verification.sourceTxHash),
        provider: verification.provider,
        chainKey: verification.chainKey,
        attestcoinChainKey: verification.attestcoinChainKey,
        sourceTxHash: verification.sourceTxHash.toLowerCase(),
        blockHeight: verification.blockHeight,
        txIndex: verification.txIndex,
        verified: verification.verified,
        status: verification.status,
        txBytes: verification.txBytes,
        merkleRoot: verification.merkleRoot,
        merkleSiblings: verification.merkleSiblings,
        continuityLowerEndpointDigest: verification.continuityLowerEndpointDigest,
        continuityRoots: verification.continuityRoots,
        verifier: verification.verifier,
        verifiedAt: verification.verifiedAt ? new Date(verification.verifiedAt) : null,
        error: verification.error,
        proofReference: verification.proofReference,
        metadata: verification.metadata,
      })
      .onConflictDoUpdate({
        target: [attestations.provider, attestations.chainKey, attestations.sourceTxHash],
        set: {
          verified: verification.verified,
          status: verification.status,
          txIndex: verification.txIndex,
          txBytes: verification.txBytes,
          merkleRoot: verification.merkleRoot,
          merkleSiblings: verification.merkleSiblings,
          continuityLowerEndpointDigest: verification.continuityLowerEndpointDigest,
          continuityRoots: verification.continuityRoots,
          verifiedAt: verification.verifiedAt ? new Date(verification.verifiedAt) : null,
          error: verification.error,
          proofReference: verification.proofReference,
          metadata: verification.metadata,
        },
      });
    attestationByTx.set(`${verification.chainKey}:${verification.sourceTxHash.toLowerCase()}`, {
      id: attestationIdFor(verification.provider, verification.chainKey, verification.sourceTxHash),
      verified: verification.verified,
      status: verification.status,
    } as never);
  }
  await report({
    step: "ATTEST_EVENTS",
    detail: `Attestcoin: ${result.attested.verified} verified, ${result.attested.pending} awaiting attestation, ${result.attested.failed} failed.`,
    metrics: { ...result.attested, provider: bundle.attestation.descriptor.id },
  });
  await audit({
    action: "evidence.attested",
    userId: ctx.userId,
    walletId: ctx.walletId,
    ipAddress: ctx.ipAddress,
    metadata: { ...result.attested, provider: bundle.attestation.descriptor.id },
  });

  /* ---------------------------- NORMALIZE_EVENTS ------------------------- */
  const logsByTx = new Map<string, RawChainLog[]>();
  for (const log of storedLogs) {
    const key = `${log.chainKey}:${log.txHash.toLowerCase()}`;
    const list = logsByTx.get(key) ?? [];
    list.push({
      logIndex: log.logIndex,
      address: log.address,
      topics: log.topics as string[],
      data: log.data ?? "0x",
      decoded: (log.decoded as never) ?? undefined,
    });
    logsByTx.set(key, list);
  }

  const assetRows = await db.select().from(assets);
  const priceByAsset = new Map(assetRows.map((a) => [`${a.symbol}:${a.chainKey}`, a.priceUsd]));

  const reconstructed: RawChainTransaction[] = storedTxs.map((tx) => ({
    chainKey: tx.chainKey,
    chainId: null,
    txHash: tx.txHash,
    blockHeight: tx.blockHeight,
    blockHash: ((tx.metadata as Record<string, unknown>)?.blockHash as string) ?? null,
    from: tx.from,
    to: tx.to,
    valueRaw: tx.valueRaw,
    data: tx.data ?? "0x",
    status: tx.status as RawChainTransaction["status"],
    timestampMs: tx.timestampMs,
    logs: (logsByTx.get(`${tx.chainKey}:${tx.txHash.toLowerCase()}`) ?? []).sort((a, b) => a.logIndex - b.logIndex),
  }));

  const normalized = normalizeActivity({
    walletId: ctx.walletId,
    walletAddress: ctx.address,
    transactions: reconstructed,
    resolvePrice: ({ asset, chainKey }) => priceByAsset.get(`${asset}:${chainKey}`) ?? priceByAsset.get(`${asset}:*`) ?? 0,
  });

  let newEvents = 0;
  for (const event of normalized.events) {
    const attestation = attestationByTx.get(`${event.chainKey}:${event.txHash.toLowerCase()}`);
    const verified = Boolean(attestation?.verified);
    const inserted = await db
      .insert(economicEvents)
      .values({
        id: event.id,
        walletId: event.walletId,
        chainKey: event.chainKey,
        chainId: event.chainId,
        blockHeight: event.blockHeight,
        txHash: event.txHash.toLowerCase(),
        logIndex: event.logIndex,
        timestampMs: event.timestamp,
        type: event.type,
        from: event.from,
        to: event.to,
        asset: event.asset,
        assetDecimals: event.assetDecimals,
        amountRaw: event.amountRaw,
        amountUsdCents: event.amountUsdCents,
        protocol: event.protocol,
        attestationId: attestation?.id ?? null,
        verified,
        sequence: event.sequence,
        metadata: event.metadata as never,
      })
      .onConflictDoNothing({
        target: [economicEvents.walletId, economicEvents.chainKey, economicEvents.txHash, economicEvents.logIndex, economicEvents.type],
      })
      .returning({ id: economicEvents.id });
    if (inserted.length > 0) newEvents += 1;
    // Re-sync verification state on every run (attestations arrive later).
    await db
      .update(economicEvents)
      .set({ verified, attestationId: attestation?.id ?? null, sequence: event.sequence })
      .where(and(eq(economicEvents.id, event.id), eq(economicEvents.verified, false)));
  }
  result.eventCount = normalized.events.length;
  result.newEventCount = newEvents;
  await report({
    step: "NORMALIZE_EVENTS",
    detail: `${normalized.events.length} economic event(s) normalised (${newEvents} new); ${normalized.skipped.length} raw log(s) carried no economic meaning.`,
    metrics: { events: normalized.events.length, new: newEvents, skipped: normalized.skipped.length },
  });

  /* ----------------------------- BUILD_EVIDENCE -------------------------- */
  const allEvents = await db
    .select()
    .from(economicEvents)
    .where(eq(economicEvents.walletId, ctx.walletId))
    .orderBy(asc(economicEvents.timestampMs), asc(economicEvents.sequence));
  result.eventCount = allEvents.length;

  const now = Date.now();
  const staleCutoff = now - creditConfig.staleEventMaxAgeMs;
  const eligible: EconomicEvent[] = [];
  let staleCount = 0;
  for (const row of allEvents) {
    if (!row.verified) continue;
    if (row.timestampMs < staleCutoff) {
      staleCount += 1;
      continue;
    }
    if (row.creditedAt !== null) continue; // already produced credit — never again
    eligible.push(rowToEvent(row));
  }
  result.staleEventCount = staleCount;
  result.eligibleEventCount = eligible.length;

  if (!shouldEvaluate) {
    await report({ step: "BUILD_EVIDENCE", detail: "Sync-only run: evidence build skipped.", metrics: { skipped: true } });
    result.account = await readAccount(ctx.walletId);
    return result;
  }

  const evidence = evaluateEvidence({
    walletId: ctx.walletId,
    walletAddress: ctx.address,
    events: eligible,
    now,
  });
  result.evidence = stripGraph(evidence);
  await report({
    step: "BUILD_EVIDENCE",
    detail: `Evidence graph built: ${eligible.length} eligible event(s), ${evidence.graph.nodes.length} nodes, ${evidence.graph.edges.length} edges, ${evidence.graph.cycles.length} cycle(s).`,
    metrics: {
      eligible: eligible.length,
      stale: staleCount,
      nodes: evidence.graph.nodes.length,
      edges: evidence.graph.edges.length,
      cycles: evidence.graph.cycles.length,
    },
  });

  /* -------------------------------- EVALUATE ----------------------------- */
  const existingEvaluation = await db
    .select()
    .from(evidenceEvaluations)
    .where(and(eq(evidenceEvaluations.walletId, ctx.walletId), eq(evidenceEvaluations.evidenceHash, evidence.evidenceHash)))
    .limit(1);

  let evaluationId: string;
  if (existingEvaluation[0]) {
    evaluationId = existingEvaluation[0].id;
    result.duplicateEvaluation = true;
    await report({ step: "EVALUATE", detail: "Identical evidence already evaluated; reusing the existing evaluation.", metrics: { duplicate: true } });
  } else {
    evaluationId = deterministicId("evaluation", ctx.walletId, evidence.evidenceHash);
    await db.insert(evidenceEvaluations).values({
      id: evaluationId,
      walletId: ctx.walletId,
      userId: ctx.userId,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      evidenceScore: evidence.evidenceScore,
      capitalIndependence: evidence.capitalIndependence,
      economicDiversity: evidence.economicDiversity,
      behavioralCoherence: evidence.behavioralCoherence,
      strength: evidence.strength,
      eventCount: evidence.eventCount,
      verifiedEventCount: evidence.verifiedEventCount,
      volumeUsdCents: evidence.volumeUsdCents,
      evidenceHash: evidence.evidenceHash,
      contributingEventIds: evidence.contributingEventIds,
      excludedEventIds: allEvents.filter((e) => !eligible.some((x) => x.id === e.id)).map((e) => e.id),
      dimensions: {
        capitalIndependence: evidence.dimensions.capitalIndependence,
        economicDiversity: evidence.dimensions.economicDiversity,
        behavioralCoherence: evidence.dimensions.behavioralCoherence,
      } as never,
      signals: evidence.supportingSignals as never,
      status: "COMPLETED",
      jobId: ctx.jobId ?? null,
    });

    const factors = [
      evidence.dimensions.capitalIndependence,
      evidence.dimensions.economicDiversity,
      evidence.dimensions.behavioralCoherence,
    ];
    for (let i = 0; i < factors.length; i += 1) {
      const factor = factors[i];
      await db
        .insert(evidenceFactors)
        .values({
          id: deterministicId("evaluation", evaluationId, factor.key),
          evaluationId,
          key: factor.key,
          label: factor.label,
          value: factor.value,
          explanation: factor.explanation,
          signals: factor.signals as never,
          position: i,
        })
        .onConflictDoNothing({ target: [evidenceFactors.evaluationId, evidenceFactors.key] });
    }
    for (const eventId of evidence.contributingEventIds) {
      await db
        .insert(evidenceEventLinks)
        .values({
          id: deterministicId("evaluation", evaluationId, eventId),
          evaluationId,
          eventId,
          walletId: ctx.walletId,
          kind: "contributing",
        })
        .onConflictDoNothing({ target: [evidenceEventLinks.evaluationId, evidenceEventLinks.eventId] });
    }
    await report({
      step: "EVALUATE",
      detail: `Evidence score ${evidence.evidenceScore.toFixed(4)} (${evidence.strength}). C=${evidence.capitalIndependence.toFixed(4)} D=${evidence.economicDiversity.toFixed(4)} Q=${evidence.behavioralCoherence.toFixed(4)}.`,
      metrics: { evidenceScore: evidence.evidenceScore, strength: evidence.strength },
    });
    await audit({
      action: "evidence.evaluated",
      userId: ctx.userId,
      walletId: ctx.walletId,
      referenceId: evaluationId,
      ipAddress: ctx.ipAddress,
      metadata: { evidenceScore: evidence.evidenceScore, strength: evidence.strength, events: eligible.length },
    });
  }
  result.evaluationId = evaluationId;

  /* ---------------------------- CREDIT_DECISION -------------------------- */
  const accountRows = await db.select().from(creditAccounts).where(eq(creditAccounts.walletId, ctx.walletId)).limit(1);
  const account = accountRows[0];
  if (!account) throw new AppError("credit_account_missing", "Credit account could not be resolved for this wallet.");

  const existingDecision = await db
    .select()
    .from(creditDecisions)
    .where(and(eq(creditDecisions.walletId, ctx.walletId), eq(creditDecisions.evidenceHash, evidence.evidenceHash)))
    .limit(1);

  const lastCredited = await db
    .select()
    .from(creditDecisions)
    .where(and(eq(creditDecisions.walletId, ctx.walletId), eq(creditDecisions.awarded, true)))
    .orderBy(desc(creditDecisions.createdAt))
    .limit(1);

  const decision = decideCredit({
    evidenceScore: evidence.evidenceScore,
    currentLimitUsdCents: account.creditLimitUsdCents,
    borrowedUsdCents: account.borrowedUsdCents,
    eventCount: eligible.length,
    verifiedEventCount: evidence.verifiedEventCount,
    lastCreditedEvaluationAt: lastCredited[0]?.createdAt.getTime() ?? null,
    now,
    evidenceHashAlreadyCredited: Boolean(existingDecision[0]),
    newEventCount: eligible.length,
    staleEventCount: staleCount,
  });

  let decisionId: string;
  if (existingDecision[0]) {
    decisionId = existingDecision[0].id;
  } else {
    decisionId = deterministicId("decision", ctx.walletId, evidence.evidenceHash);
    await db
      .insert(creditDecisions)
      .values({
        id: decisionId,
        accountId: account.id,
        walletId: ctx.walletId,
        userId: ctx.userId,
        evaluationId,
        evidenceHash: evidence.evidenceHash,
        evidenceScore: evidence.evidenceScore,
        strength: evidence.strength,
        previousLimitUsdCents: decision.previousLimitUsdCents,
        creditIncreaseUsdCents: decision.creditIncreaseUsdCents,
        newLimitUsdCents: decision.newLimitUsdCents,
        availableUsdCents: decision.availableUsdCents,
        utilization: decision.utilization,
        awarded: decision.awarded,
        blockedBy: decision.blockedBy as never,
        guardrailNotes: decision.guardrailNotes as never,
        efficiency: decision.efficiency,
        jobId: ctx.jobId ?? null,
      })
      .onConflictDoNothing({ target: [creditDecisions.walletId, creditDecisions.evidenceHash] });
  }
  result.decisionId = decisionId;

  await report({
    step: "CREDIT_DECISION",
    detail: decision.awarded
      ? `Credit decision: +$${(decision.creditIncreaseUsdCents / 100).toFixed(2)} (limit $${(decision.previousLimitUsdCents / 100).toFixed(2)} → $${(decision.newLimitUsdCents / 100).toFixed(2)}).`
      : `Credit decision: no increase. ${decision.guardrailNotes[0] ?? "Guardrail applied."}`,
    metrics: { awarded: decision.awarded, increaseCents: decision.creditIncreaseUsdCents, blockedBy: decision.blockedBy.join(",") },
  });

  /* ----------------------------- CREDIT_UPDATE --------------------------- */
  let settled = false;
  let settlementReference: string | null = null;

  if (decision.awarded) {
    await db
      .update(creditAccounts)
      .set({
        creditLimitUsdCents: decision.newLimitUsdCents,
        totalAwardedUsdCents: account.totalAwardedUsdCents + decision.creditIncreaseUsdCents,
        evaluationCount: account.evaluationCount + 1,
        lastEvaluatedAt: new Date(now),
        updatedAt: new Date(now),
        version: account.version + 1,
      })
      .where(and(eq(creditAccounts.id, account.id), eq(creditAccounts.version, account.version)));

    await db
      .insert(creditTransactions)
      .values({
        id: deterministicId("txn", decisionId),
        accountId: account.id,
        walletId: ctx.walletId,
        userId: ctx.userId,
        kind: "AWARD",
        amountUsdCents: decision.creditIncreaseUsdCents,
        limitAfterUsdCents: decision.newLimitUsdCents,
        borrowedAfterUsdCents: account.borrowedUsdCents,
        balanceAfterUsdCents: decision.availableUsdCents,
        referenceId: decisionId,
        idempotencyKey: `award:${decisionId}`,
        metadata: { evaluationId, evidenceHash: evidence.evidenceHash, evidenceScore: evidence.evidenceScore } as never,
      })
      .onConflictDoNothing({ target: creditTransactions.idempotencyKey });

    await db
      .update(economicEvents)
      .set({ creditedAt: new Date(now), lastEvaluationId: evaluationId })
      .where(and(eq(economicEvents.walletId, ctx.walletId), isNull(economicEvents.creditedAt), inArray(economicEvents.id, eligible.map((e) => e.id))));

    await db.update(evidenceEvaluations).set({ credited: true }).where(eq(evidenceEvaluations.id, evaluationId));

    const settlement = await bundle.credit.updateCreditLimit(
      {
        walletId: ctx.walletId,
        walletAddress: ctx.address,
        userId: ctx.userId,
        accountId: account.id,
        mode: bundle.mode,
      },
      { newLimitUsdCents: decision.newLimitUsdCents, decisionId, evidenceHash: evidence.evidenceHash },
    );
    settled = settlement.settled;
    settlementReference = settlement.reference;

    await db
      .update(creditDecisions)
      .set({ onchain: settlement.settled, onchainReference: settlement.reference })
      .where(eq(creditDecisions.id, decisionId));
    await db
      .update(creditAccounts)
      .set({ onchain: settlement.settled, onchainReference: settlement.reference, provider: settlement.provider })
      .where(eq(creditAccounts.id, account.id));

    await audit({ action: "credit.decision_created", userId: ctx.userId, walletId: ctx.walletId, referenceId: decisionId, ipAddress: ctx.ipAddress, metadata: { increaseCents: decision.creditIncreaseUsdCents } });
    await audit({ action: "credit.limit_updated", userId: ctx.userId, walletId: ctx.walletId, referenceId: account.id, ipAddress: ctx.ipAddress, metadata: { newLimitCents: decision.newLimitUsdCents } });
    await audit({
      action: "credit.settlement_attempted",
      userId: ctx.userId,
      walletId: ctx.walletId,
      referenceId: settlementReference,
      result: settlement.settled ? "success" : "blocked",
      metadata: settlement.detail,
    });

    await report({
      step: "CREDIT_UPDATE",
      detail: `Credit account updated. Settlement rail: ${settlement.provider} (${settlement.settled ? `settled ${settlement.reference}` : "not settled on-chain"}).`,
      metrics: { settled: settlement.settled, reference: settlement.reference ?? "" },
    });
  } else {
    await audit({
      action: "credit.decision_created",
      userId: ctx.userId,
      walletId: ctx.walletId,
      referenceId: decisionId,
      result: "blocked",
      ipAddress: ctx.ipAddress,
      metadata: { blockedBy: decision.blockedBy },
    });
    await report({
      step: "CREDIT_UPDATE",
      detail: `No credit awarded: ${decision.blockedBy.join(", ") || "guardrail applied"}.`,
      metrics: { awarded: false, blockedBy: decision.blockedBy.join(",") },
    });
  }

  const projected = projectAccount({
    creditLimitUsdCents: decision.newLimitUsdCents,
    borrowedUsdCents: account.borrowedUsdCents,
  });
  result.decision = {
    previousLimitUsdCents: decision.previousLimitUsdCents,
    creditIncreaseUsdCents: decision.creditIncreaseUsdCents,
    newLimitUsdCents: decision.newLimitUsdCents,
    availableUsdCents: projected.availableUsdCents,
    utilization: projected.utilization,
    awarded: decision.awarded,
    blockedBy: decision.blockedBy,
    guardrailNotes: decision.guardrailNotes,
    evidenceScore: evidence.evidenceScore,
    strength: evidence.strength,
    settled,
    settlementReference,
  };
  result.account = projected;
  return result;
}

async function readAccount(walletId: string) {
  const rows = await db.select().from(creditAccounts).where(eq(creditAccounts.walletId, walletId)).limit(1);
  if (!rows[0]) return null;
  return projectAccount({
    creditLimitUsdCents: rows[0].creditLimitUsdCents,
    borrowedUsdCents: rows[0].borrowedUsdCents,
  });
}

export function rowToEvent(row: {
  id: string;
  walletId: string;
  chainKey: string;
  chainId: number | null;
  blockHeight: number;
  txHash: string;
  logIndex: number;
  timestampMs: number;
  type: string;
  from: string;
  to: string;
  asset: string;
  assetDecimals: number;
  amountRaw: string;
  amountUsdCents: number;
  protocol: string | null;
  attestationId: string | null;
  verified: boolean;
  sequence: number;
  metadata: unknown;
}): EconomicEvent {
  return {
    id: row.id,
    walletId: row.walletId,
    chainKey: row.chainKey,
    chainId: row.chainId,
    blockHeight: row.blockHeight,
    txHash: row.txHash,
    logIndex: row.logIndex,
    timestamp: row.timestampMs,
    type: row.type as EconomicEvent["type"],
    from: row.from,
    to: row.to,
    asset: row.asset,
    assetDecimals: row.assetDecimals,
    amountRaw: row.amountRaw,
    amountUsdCents: row.amountUsdCents,
    protocol: row.protocol,
    attestationId: row.attestationId,
    verified: row.verified,
    sequence: row.sequence,
    metadata: (row.metadata ?? {}) as EconomicEvent["metadata"],
  };
}

function stripGraph(evidence: EvidenceResult & { graph?: unknown }): EvidenceResult {
  const { graph: _graph, ...rest } = evidence as EvidenceResult & { graph?: unknown };
  return rest;
}

/** Sync without evaluating — used by /api/evidence/sync and the seeder. */
export async function syncWalletEvidence(ctx: PipelineContext, reporter?: StepReporter) {
  return runBuildCreditPipeline(ctx, { reporter, evaluate: false });
}

export { gte };
