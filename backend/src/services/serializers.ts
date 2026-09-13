/**
 * API serialization.
 *
 * The frontend never computes available credit, utilization, evidence or credit
 * increases. Every number it displays is produced here from persisted backend
 * state. Money is exposed as integer cents plus a display value; technical
 * identifiers are exposed verbatim so they can be rendered in a monospace face.
 */
import { centsToUsd, formatUsd } from "@/lib/money";
import type {
  AttestationRow,
  CreditAccountRow,
  CreditDecisionRow,
  EconomicEventRow,
  EvidenceEvaluationRow,
  EvidenceFactorRow,
  JobRow,
} from "@/db/schema";
import type { JobSnapshot, JobStep, JobStepRecord } from "@/domain/types";

export interface MoneyDto {
  cents: number;
  usd: number;
  display: string;
}

export function money(cents: number): MoneyDto {
  return { cents, usd: centsToUsd(cents), display: formatUsd(cents) };
}

export function serializeEvent(row: EconomicEventRow, attestation?: AttestationRow | null) {
  return {
    id: row.id,
    walletId: row.walletId,
    chainKey: row.chainKey,
    chainId: row.chainId,
    blockHeight: row.blockHeight,
    txHash: row.txHash,
    logIndex: row.logIndex,
    timestamp: row.timestampMs,
    timestampIso: new Date(row.timestampMs).toISOString(),
    type: row.type,
    from: row.from,
    to: row.to,
    asset: row.asset,
    assetDecimals: row.assetDecimals,
    amountRaw: row.amountRaw,
    amount: money(row.amountUsdCents),
    protocol: row.protocol,
    verified: row.verified,
    sequence: row.sequence,
    credited: row.creditedAt !== null,
    attestationId: row.attestationId,
    attestation: attestation ? serializeAttestation(attestation) : null,
    metadata: row.metadata as Record<string, unknown>,
    interpretation: interpretEvent(row),
  };
}

/** Human-readable economic interpretation shown on the evidence detail screen. */
export function interpretEvent(row: EconomicEventRow): string {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const label = typeof meta.counterpartyLabel === "string" ? meta.counterpartyLabel : null;
  const note = typeof meta.note === "string" ? meta.note : null;
  const amount = money(row.amountUsdCents).display;
  const base: Record<string, string> = {
    FUNDING: `Capital inflow of ${amount} from ${label ?? row.from}.`,
    TRANSFER: `Value transfer of ${amount} ${row.to === "" ? "" : ""}to ${label ?? row.to}.`,
    SWAP: `Asset exchange of ${amount} via ${row.protocol ?? "an on-chain router"}.`,
    DEPOSIT: `Deposit of ${amount} into ${row.protocol ?? "a protocol"}.`,
    BORROW: `Borrowed ${amount} from ${row.protocol ?? "a lending market"}.`,
    REPAY: `Repaid ${amount} to ${row.protocol ?? "a lending market"}.`,
    WITHDRAW: `Withdrew ${amount} from ${row.protocol ?? "a protocol"}.`,
    STAKE: `Staked ${amount} with ${row.protocol ?? "a staking protocol"}.`,
    PAYMENT: `Payment of ${amount} to ${label ?? row.to}.`,
    REWARD: `Reward of ${amount} from ${row.protocol ?? "a protocol"}.`,
  };
  const sentence = base[row.type] ?? `${row.type} of ${amount}.`;
  return note ? `${sentence} ${note}` : sentence;
}

export function serializeAttestation(row: AttestationRow) {
  return {
    id: row.id,
    provider: row.provider,
    chainKey: row.chainKey,
    attestcoinChainKey: row.attestcoinChainKey,
    sourceTxHash: row.sourceTxHash,
    blockHeight: row.blockHeight,
    txIndex: row.txIndex,
    verified: row.verified,
    status: row.status,
    txBytes: row.txBytes,
    merkleRoot: row.merkleRoot,
    merkleSiblings: row.merkleSiblings,
    continuityLowerEndpointDigest: row.continuityLowerEndpointDigest,
    continuityRoots: row.continuityRoots,
    verifier: row.verifier,
    verifiedAt: row.verifiedAt ? row.verifiedAt.getTime() : null,
    error: row.error,
    proofReference: row.proofReference,
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function serializeFactor(row: EvidenceFactorRow) {
  return {
    key: row.key,
    label: row.label,
    value: row.value,
    explanation: row.explanation,
    signals: row.signals as Record<string, unknown>,
  };
}

export function serializeEvaluation(row: EvidenceEvaluationRow, factors: EvidenceFactorRow[] = []) {
  return {
    id: row.id,
    walletId: row.walletId,
    engineVersion: row.engineVersion,
    evidenceScore: row.evidenceScore,
    strength: row.strength,
    strengthLabel: strengthLabel(row.strength),
    capitalIndependence: row.capitalIndependence,
    economicDiversity: row.economicDiversity,
    behavioralCoherence: row.behavioralCoherence,
    eventCount: row.eventCount,
    verifiedEventCount: row.verifiedEventCount,
    volume: money(row.volumeUsdCents),
    evidenceHash: row.evidenceHash,
    contributingEventIds: row.contributingEventIds as string[],
    excludedEventIds: row.excludedEventIds as string[],
    factors: factors.length > 0 ? factors.map(serializeFactor) : Object.values((row.dimensions ?? {}) as Record<string, unknown>),
    signals: row.signals as Record<string, unknown>,
    status: row.status,
    credited: row.credited,
    jobId: row.jobId,
    createdAt: row.createdAt.getTime(),
  };
}

export function strengthLabel(strength: string): string {
  switch (strength) {
    case "strong":
      return "Strong economic evidence";
    case "moderate":
      return "Moderate economic evidence";
    case "limited":
      return "Limited economic evidence";
    default:
      return "No verified evidence yet";
  }
}

export function serializeDecision(row: CreditDecisionRow) {
  return {
    id: row.id,
    wallet: row.walletId,
    walletId: row.walletId,
    accountId: row.accountId,
    evaluationId: row.evaluationId,
    evidenceHash: row.evidenceHash,
    evidenceScore: row.evidenceScore,
    strength: row.strength,
    strengthLabel: strengthLabel(row.strength),
    previousLimit: money(row.previousLimitUsdCents),
    creditIncrease: money(row.creditIncreaseUsdCents),
    newLimit: money(row.newLimitUsdCents),
    available: money(row.availableUsdCents),
    utilization: row.utilization,
    awarded: row.awarded,
    blockedBy: row.blockedBy as string[],
    guardrailNotes: row.guardrailNotes as string[],
    efficiency: row.efficiency,
    onchain: row.onchain,
    onchainReference: row.onchainReference,
    createdAt: row.createdAt.getTime(),
    // Legacy-compatible flat fields some clients expect.
    previousLimitUsdCents: row.previousLimitUsdCents,
    creditIncreaseUsdCents: row.creditIncreaseUsdCents,
    newLimitUsdCents: row.newLimitUsdCents,
  };
}

export function serializeAccount(row: CreditAccountRow) {
  const available = Math.max(0, row.creditLimitUsdCents - row.borrowedUsdCents);
  const utilization = row.creditLimitUsdCents > 0 ? row.borrowedUsdCents / row.creditLimitUsdCents : 0;
  return {
    id: row.id,
    walletId: row.walletId,
    creditLimit: money(row.creditLimitUsdCents),
    borrowed: money(row.borrowedUsdCents),
    available: money(available),
    utilization: Math.round(utilization * 10_000) / 10_000,
    utilizationPercent: Math.round(utilization * 1000) / 10,
    status: row.status,
    totalAwarded: money(row.totalAwardedUsdCents),
    totalRepaid: money(row.totalRepaidUsdCents),
    evaluationCount: row.evaluationCount,
    lastEvaluatedAt: row.lastEvaluatedAt ? row.lastEvaluatedAt.getTime() : null,
    updatedAt: row.updatedAt.getTime(),
    provider: row.provider,
    onchain: row.onchain,
    onchainReference: row.onchainReference,
  };
}

export function serializeJob(row: JobRow): JobSnapshot {
  return {
    id: row.id,
    type: row.type,
    status: row.status as JobSnapshot["status"],
    progress: row.progress,
    walletId: row.walletId,
    userId: row.userId,
    currentStep: (row.currentStep as JobStep | null) ?? null,
    steps: (row.steps as JobStepRecord[]) ?? [],
    error: row.error,
    errorCode: row.errorCode,
    resultReference: (row.resultReference as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export function serializeActivity(rows: EconomicEventRow[]) {
  return rows.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const isInflow = row.to !== row.from && Boolean(meta.directionIn ?? false);
    return {
      id: row.id,
      type: row.type,
      chainKey: row.chainKey,
      timestamp: row.timestampMs,
      timestampIso: new Date(row.timestampMs).toISOString(),
      amount: money(row.amountUsdCents),
      asset: row.asset,
      protocol: row.protocol,
      counterparty: typeof meta.counterpartyLabel === "string" ? meta.counterpartyLabel : row.protocol ?? row.from,
      counterpartyAddress: isInflow ? row.from : row.to,
      txHash: row.txHash,
      blockHeight: row.blockHeight,
      verified: row.verified,
      status: row.verified ? "VERIFIED" : "PENDING",
      credited: row.creditedAt !== null,
      description: interpretEvent(row),
    };
  });
}
