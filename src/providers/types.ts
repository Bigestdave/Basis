/**
 * Provider abstractions.
 *
 * The four seams between BASIS and the outside world. Demo and live
 * implementations satisfy the *same* interface, so no business logic, engine or
 * API route ever branches on mode — only the registry in `src/providers/index.ts`
 * does. Adding a chain, swapping Attestcoin, or replacing the credit rail means
 * writing one adapter, not touching the product.
 */
import type { AppMode } from "@/lib/config";
import type {
  AttestationStatus,
  EconomicEvent,
  EconomicEventMetadata,
  EconomicEventType,
} from "@/domain/types";

export interface ProviderDescriptor {
  id: string;
  mode: AppMode;
  kind: "chain-data" | "attestation" | "credit" | "signer";
  /** True when the provider can actually reach its upstream dependency. */
  available: boolean;
  /** Honest description of what is and is not wired up. */
  notes: string;
  detail: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Chain data                                                                 */
/* -------------------------------------------------------------------------- */

export interface ChainDescriptor {
  key: string;
  chainId: number | null;
  name: string;
  family: "evm" | "solana" | "substrate";
  rpcConfigured: boolean;
  attestcoinChainKey: number | null;
}

export interface RawChainLog {
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  /** Decoded economic meaning, when the adapter can determine it. */
  decoded?: DecodedLog;
}

export interface DecodedLog {
  type: EconomicEventType;
  asset: string;
  assetDecimals: number;
  amountRaw: string;
  priceUsd: number;
  from: string;
  to: string;
  protocol: string | null;
  metadata?: EconomicEventMetadata;
}

export interface RawChainTransaction {
  chainKey: string;
  chainId: number | null;
  txHash: string;
  blockHeight: number;
  blockHash: string | null;
  from: string;
  to: string | null;
  valueRaw: string;
  data: string;
  status: "SUCCESS" | "REVERTED" | "UNKNOWN";
  timestampMs: number;
  logs: RawChainLog[];
}

export interface WalletActivityQuery {
  walletAddress: string;
  chainKeys: string[];
  fromMs?: number;
  toMs?: number;
  limit?: number;
  cursor?: string;
}

export interface WalletActivityPage {
  transactions: RawChainTransaction[];
  nextCursor: string | null;
  chainKeys: string[];
  fetchedAt: number;
  source: string;
}

export interface LogFilter {
  chainKey: string;
  address?: string;
  topics?: (string | null)[];
  fromBlock?: number;
  toBlock?: number;
}

export interface FundingGraphHint {
  address: string;
  cluster: string;
  fundedBy: string | null;
  depth: number;
}

export interface ChainDataProvider {
  readonly descriptor: ProviderDescriptor;
  getSupportedChains(): Promise<ChainDescriptor[]>;
  /** getTransactions(wallet) — the primary ingest entry point. */
  getWalletActivity(query: WalletActivityQuery): Promise<WalletActivityPage>;
  getTransaction(chainKey: string, txHash: string): Promise<RawChainTransaction | null>;
  getReceipt(chainKey: string, txHash: string): Promise<{
    txHash: string;
    blockHeight: number;
    status: "SUCCESS" | "REVERTED" | "UNKNOWN";
    logs: RawChainLog[];
  } | null>;
  getBlock(chainKey: string, blockHeight: number): Promise<{
    height: number;
    hash: string;
    timestampMs: number;
  } | null>;
  getTimestamp(chainKey: string, blockHeight: number): Promise<number | null>;
  getLogs(filter: LogFilter): Promise<RawChainLog[]>;
  getTokenTransfers(query: WalletActivityQuery): Promise<RawChainTransaction[]>;
  /**
   * Best-effort 1..n hop funding graph used by Capital Independence in live
   * mode. Returns [] when the adapter cannot resolve it (degrades gracefully).
   */
  getFundingGraph(walletAddress: string, chainKeys: string[], maxDepth: number): Promise<FundingGraphHint[]>;
}

/* -------------------------------------------------------------------------- */
/* Attestation (Attestcoin / USC)                                             */
/* -------------------------------------------------------------------------- */

export interface AttestationRequest {
  eventId?: string;
  chainKey: string;
  txHash: string;
  blockHeight: number;
  walletAddress: string;
  /** When true the provider should wait for the attestors instead of failing. */
  waitForAttestation?: boolean;
}

export interface AttestationVerification {
  id: string;
  provider: "attestcoin" | "demo";
  chainKey: string;
  attestcoinChainKey: number | null;
  sourceTxHash: string;
  blockHeight: number;
  txIndex: number | null;
  verified: boolean;
  status: AttestationStatus;
  txBytes: string | null;
  merkleRoot: string | null;
  merkleSiblings: number;
  continuityLowerEndpointDigest: string | null;
  continuityRoots: number;
  verifier: string | null;
  verifiedAt: number | null;
  error: string | null;
  proofReference: string | null;
  metadata: Record<string, unknown>;
}

export interface AttestationProvider {
  readonly descriptor: ProviderDescriptor;
  /** Verify a single cross-chain fact. */
  verifyEvent(request: AttestationRequest): Promise<AttestationVerification>;
  /**
   * Verify a batch sharing one continuity proof — the ordering/continuity check
   * that lets BASIS reason about sequence rather than isolated transactions.
   */
  verifyOrdering(requests: AttestationRequest[]): Promise<AttestationVerification[]>;
  getVerification(chainKey: string, txHash: string): Promise<AttestationVerification | null>;
  /** Chains Attestcoin currently attests, resolved from the ChainInfo precompile. */
  getSupportedChains?(): Promise<{ chainKey: number; chainId: number; chainName: string }[]>;
}

/* -------------------------------------------------------------------------- */
/* Credit settlement (Creditcoin)                                             */
/* -------------------------------------------------------------------------- */

export interface CreditContext {
  walletId: string;
  walletAddress: string;
  userId: string;
  accountId: string;
  mode: AppMode;
}

export interface SettlementResult {
  /** True only when state was actually written to the settlement rail. */
  settled: boolean;
  reference: string | null;
  provider: string;
  chainKey: string | null;
  detail: Record<string, unknown>;
}

export interface CreditProvider {
  readonly descriptor: ProviderDescriptor;
  getAccount(context: CreditContext): Promise<{
    creditLimitUsdCents: number;
    borrowedUsdCents: number;
    onchain: boolean;
    reference: string | null;
  } | null>;
  getCreditLimit(context: CreditContext): Promise<number>;
  updateCreditLimit(
    context: CreditContext,
    input: { newLimitUsdCents: number; decisionId: string; evidenceHash: string },
  ): Promise<SettlementResult>;
  borrow(
    context: CreditContext,
    input: { amountUsdCents: number; positionId: string; transactionId: string },
  ): Promise<SettlementResult>;
  repay(
    context: CreditContext,
    input: { amountUsdCents: number; repaymentId: string; transactionId: string; positionId?: string | null },
  ): Promise<SettlementResult>;
}

/* -------------------------------------------------------------------------- */
/* Signature verification (wallet authentication)                             */
/* -------------------------------------------------------------------------- */

export interface SignatureVerificationRequest {
  address: string;
  message: string;
  signature: string;
  chainKey?: string;
}

export interface SignatureVerificationResult {
  valid: boolean;
  recoveredAddress: string | null;
  signerType: "eip191" | "eip1271" | "demo-hmac";
  reason?: string;
}

export interface SignatureVerifier {
  readonly descriptor: ProviderDescriptor;
  verify(request: SignatureVerificationRequest): Promise<SignatureVerificationResult>;
  /**
   * Demo-mode only: produces a signature for a simulated wallet so the *same*
   * verification code path runs. Throws in live mode.
   */
  signDemo?(input: { address: string; message: string }): Promise<{ signature: string; signerType: string }>;
}

/* -------------------------------------------------------------------------- */

/** Normalised event as produced by a chain adapter before persistence. */
export interface NormalizedEventDraft {
  chainKey: string;
  chainId: number | null;
  blockHeight: number;
  txHash: string;
  logIndex: number;
  timestampMs: number;
  type: EconomicEventType;
  from: string;
  to: string;
  asset: string;
  assetDecimals: number;
  amountRaw: string;
  amountUsdCents: number;
  protocol: string | null;
  sequence: number;
  metadata: EconomicEventMetadata;
}

export type { EconomicEvent };
