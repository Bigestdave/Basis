/**
 * Canonical BASIS domain objects.
 *
 * The whole product is organised around this chain:
 *
 *   BLOCKCHAIN EVENT -> ATTESTCOIN VERIFIED EVENT -> ECONOMIC EVENT
 *     -> EVIDENCE -> EVIDENCE EVALUATION -> CREDIT DECISION -> CREDIT ACCOUNT
 */
import type { UsdCents } from "@/lib/money";

/** Economic event primitives. Only these contribute to evidence. */
export const EVENT_TYPES = [
  "FUNDING",
  "TRANSFER",
  "SWAP",
  "DEPOSIT",
  "BORROW",
  "REPAY",
  "WITHDRAW",
  "STAKE",
  "PAYMENT",
  "REWARD",
] as const;

export type EconomicEventType = (typeof EVENT_TYPES)[number];

/** Action families used by Economic Diversity so similar acts don't double count. */
export const ACTION_FAMILIES = {
  FUNDING: ["FUNDING"],
  TRANSFER: ["TRANSFER"],
  SWAP: ["SWAP"],
  DEPOSIT: ["DEPOSIT", "STAKE"],
  CREDIT: ["BORROW", "REPAY"],
  WITHDRAW: ["WITHDRAW"],
  PAYMENT: ["PAYMENT"],
  REWARD: ["REWARD"],
} as const;

export type ActionFamily = keyof typeof ACTION_FAMILIES;

export function familyOf(type: EconomicEventType): ActionFamily {
  return (Object.keys(ACTION_FAMILIES) as ActionFamily[]).find((family) =>
    (ACTION_FAMILIES[family] as readonly string[]).includes(type),
  ) as ActionFamily;
}

/** Canonical economic event — the central data object of BASIS. */
export interface EconomicEvent {
  id: string;
  walletId: string;
  chainKey: string;
  chainId: number | null;
  blockHeight: number;
  txHash: string;
  logIndex: number;
  timestamp: number;
  type: EconomicEventType;
  from: string;
  to: string;
  asset: string;
  assetDecimals: number;
  amountRaw: string;
  amountUsdCents: UsdCents;
  protocol: string | null;
  attestationId: string | null;
  verified: boolean;
  /** Ordering index within the wallet's timeline (0-based, chronological). */
  sequence: number;
  metadata: EconomicEventMetadata;
}

export interface EconomicEventMetadata {
  /** Address that ultimately funded this wallet's capital for this event. */
  fundingSource?: string | null;
  /** Cluster the funding source belongs to (same hub => same cluster). */
  fundingSourceCluster?: string | null;
  /** Protocol/contract label, e.g. `aave-v3`, `uniswap-v3`. */
  protocolVersion?: string | null;
  /** Free-form note for the evidence detail view. */
  note?: string | null;
  /** Hops between an independent origin and this wallet (>=1). */
  fundingDepth?: number | null;
  /** True when the counterparty is part of the wallet's own cluster. */
  internalCounterparty?: boolean;
  /** USD price snapshot used for the conversion. */
  priceUsd?: number;
  /** Set when the event is one half of a detected A->B->A cycle. */
  cycleId?: string | null;
  [key: string]: unknown;
}

/** Attestcoin verification object associated with an event. */
export interface Attestation {
  id: string;
  provider: "attestcoin" | "demo";
  chainKey: string;
  /** USC/Attestcoin chain key (source chain identity on Creditcoin). */
  attestcoinChainKey: number | null;
  sourceTxHash: string;
  blockHeight: number;
  txIndex: number | null;
  verified: boolean;
  status: AttestationStatus;
  /** Encoded transaction bytes handed to the BlockProver precompile. */
  txBytes: string | null;
  merkleRoot: string | null;
  merkleSiblings: number;
  continuityLowerEndpointDigest: string | null;
  continuityRoots: number;
  /** Precompile used for verification (0x..0FD2). */
  verifier: string | null;
  verifiedAt: number | null;
  error: string | null;
  proofReference: string | null;
  metadata: Record<string, unknown>;
}

export type AttestationStatus =
  | "PENDING"
  | "AWAITING_ATTESTATION"
  | "PROOF_GENERATED"
  | "VERIFIED"
  | "FAILED";

/** One scored dimension with a human-readable reason. */
export interface EvidenceFactor {
  key: string;
  label: string;
  value: number;
  explanation: string;
  signals: Record<string, number | string | boolean>;
}

export interface EvidenceDimensions {
  capitalIndependence: EvidenceFactor;
  economicDiversity: EvidenceFactor;
  behavioralCoherence: EvidenceFactor;
}

export interface EvidenceResult {
  engineVersion: string;
  dimensions: EvidenceDimensions;
  capitalIndependence: number;
  economicDiversity: number;
  behavioralCoherence: number;
  /** S = C^0.45 * D^0.30 * Q^0.25 */
  evidenceScore: number;
  /** Consumer-facing band instead of a raw float. */
  strength: EvidenceStrength;
  eventCount: number;
  verifiedEventCount: number;
  volumeUsdCents: UsdCents;
  contributingEventIds: string[];
  evidenceHash: string;
  supportingSignals: Record<string, number>;
  evaluatedAt: number;
}

export type EvidenceStrength = "none" | "limited" | "moderate" | "strong";

export interface CreditDecisionInput {
  evidenceScore: number;
  currentLimitUsdCents: UsdCents;
  borrowedUsdCents: UsdCents;
  eventCount: number;
  verifiedEventCount: number;
  lastCreditedEvaluationAt: number | null;
  now: number;
  evidenceHashAlreadyCredited: boolean;
  newEventCount: number;
  staleEventCount: number;
}

export interface CreditDecisionResult {
  creditIncreaseUsdCents: UsdCents;
  previousLimitUsdCents: UsdCents;
  newLimitUsdCents: UsdCents;
  availableUsdCents: UsdCents;
  utilization: number;
  awarded: boolean;
  blockedBy: CreditGuardrail[];
  guardrailNotes: string[];
  /** Fraction of the theoretical maximum that was actually awarded. */
  efficiency: number;
}

export type CreditGuardrail =
  | "below_min_evidence_threshold"
  | "insufficient_events"
  | "cooldown_active"
  | "duplicate_evidence_hash"
  | "no_new_events"
  | "stale_events_excluded"
  | "absolute_cap_reached"
  | "max_batch_increase_applied";

export interface CreditAccountSnapshot {
  id: string;
  walletId: string;
  creditLimitUsdCents: UsdCents;
  borrowedUsdCents: UsdCents;
  availableUsdCents: UsdCents;
  utilization: number;
  status: CreditAccountStatus;
  totalAwardedUsdCents: UsdCents;
  totalRepaidUsdCents: UsdCents;
  evaluationCount: number;
  lastEvaluatedAt: number | null;
  updatedAt: number;
  onchain: boolean;
  onchainReference: string | null;
  provider: string;
}

export type CreditAccountStatus = "ACTIVE" | "RESTRICTED" | "CLOSED";

export interface CreditTransaction {
  id: string;
  accountId: string;
  walletId: string;
  kind: "AWARD" | "BORROW" | "REPAY" | "ADJUST";
  amountUsdCents: UsdCents;
  balanceAfterUsdCents: UsdCents;
  borrowedAfterUsdCents: UsdCents;
  limitAfterUsdCents: UsdCents;
  referenceId: string | null;
  idempotencyKey: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface BorrowPosition {
  id: string;
  walletId: string;
  accountId: string;
  principalUsdCents: UsdCents;
  outstandingUsdCents: UsdCents;
  openedAt: number;
  closedAt: number | null;
  status: "OPEN" | "REPAID";
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export const JOB_STEPS = [
  "SYNC_WALLET",
  "FETCH_TRANSACTIONS",
  "BUILD_PROOFS",
  "ATTEST_EVENTS",
  "NORMALIZE_EVENTS",
  "BUILD_EVIDENCE",
  "EVALUATE",
  "CREDIT_DECISION",
  "CREDIT_UPDATE",
] as const;

export type JobStep = (typeof JOB_STEPS)[number];

export const JOB_STATUSES = [
  "QUEUED",
  "SYNCING",
  "FETCHING",
  "VERIFYING",
  "NORMALIZING",
  "EVALUATING",
  "DECIDING",
  "COMPLETED",
  "FAILED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** Maps a pipeline step onto the coarse status the UI displays. */
export const STEP_STATUS: Record<JobStep, JobStatus> = {
  SYNC_WALLET: "SYNCING",
  FETCH_TRANSACTIONS: "FETCHING",
  BUILD_PROOFS: "VERIFYING",
  ATTEST_EVENTS: "VERIFYING",
  NORMALIZE_EVENTS: "NORMALIZING",
  BUILD_EVIDENCE: "EVALUATING",
  EVALUATE: "EVALUATING",
  CREDIT_DECISION: "DECIDING",
  CREDIT_UPDATE: "DECIDING",
};

export interface JobStepRecord {
  step: JobStep;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";
  startedAt: number | null;
  finishedAt: number | null;
  detail: string | null;
  metrics: Record<string, number | string | boolean>;
}

export interface JobSnapshot {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  walletId: string | null;
  userId: string | null;
  currentStep: JobStep | null;
  steps: JobStepRecord[];
  error: string | null;
  errorCode: string | null;
  resultReference: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------------------------------------------------------- */
/* Farm Test                                                                  */
/* -------------------------------------------------------------------------- */

export interface FarmTestScenarioSummary {
  key: string;
  label: string;
  description: string;
  narrative: string;
  activityCount: number;
  volumeUsdCents: UsdCents;
  expectation: string;
}

export interface FarmTestResult {
  scenarioKey: string;
  label: string;
  activityCount: number;
  verifiedActivityCount: number;
  volumeUsdCents: UsdCents;
  evidence: {
    evidenceScore: number;
    strength: EvidenceStrength;
    capitalIndependence: number;
    economicDiversity: number;
    behavioralCoherence: number;
    explanations: Record<string, string>;
  };
  creditBeforeUsdCents: UsdCents;
  creditIncreaseUsdCents: UsdCents;
  creditAfterUsdCents: UsdCents;
  awarded: boolean;
  blockedBy: CreditGuardrail[];
  headline: string;
  detail: string;
  evaluationId: string | null;
  decisionId: string | null;
  jobId: string | null;
  events: EconomicEvent[];
}
