/** BASIS domain models. These mirror the shapes a real backend would return. */

export type NetworkId =
  | "ethereum"
  | "base"
  | "creditcoin"
  | "solana"
  | "polygon"
  | "arbitrum"
  | "optimism";

export type ChainType = "EVM" | "L1" | "L2";

export type ConnectionState = "connected" | "available" | "syncing" | "unavailable";

export interface Network {
  id: NetworkId;
  name: string;
  symbol: string;
  chainType: ChainType;
  status: ConnectionState;
  lastActivity: string | null;
  blockTime?: string;
  gasPrice?: string;
  totalTransactions?: string;
  description?: string;
  verifiedActivity?: number;
}

export type AssetId = "usdc" | "eth" | "sol" | "btc" | "usdt" | "dai" | "other";

export interface Asset {
  id: AssetId;
  name: string;
  symbol: string;
  balance: number | null;
  value: number;
  change24h: number;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  username: string;
  memberSince: string;
  accountType: "Verified" | "Unverified";
}

export interface Wallet {
  address: string;
  shortAddress: string;
  label: string;
  connected: boolean;
  provider: "MetaMask" | "WalletConnect" | "Coinbase Wallet";
  lastConnected: string;
  primaryNetwork: NetworkId;
  totalBalance: number;
  change24hValue: number;
  change24hPct: number;
}

export type EconomicEventType =
  | "received"
  | "sent"
  | "swapped"
  | "deposit"
  | "withdraw"
  | "borrow"
  | "repay"
  | "credit"
  | "staking"
  | "payment";

export type EventCategory =
  | "deposits"
  | "withdrawals"
  | "swaps"
  | "borrow-repay"
  | "credit"
  | "other";

export interface EconomicEvent {
  id: string;
  type: EconomicEventType;
  category: EventCategory;
  title: string;
  subtitle: string;
  assetId: AssetId;
  assetSymbol: string;
  amount: number;
  amountUsd: number;
  network: NetworkId;
  date: string; // ISO
  time: string;
  verified: boolean;
  counterparty?: string;
  protocol?: string;
  proof: Proof;
}

export interface Proof {
  block: number;
  txHash: string;
  event: string;
  from: string;
  to: string;
  attestation: string;
  attestedAt: string;
  attestor: "Attestcoin";
}

export type EvidenceCategory =
  | "defi"
  | "payments"
  | "transfers"
  | "staking"
  | "wallet-balance"
  | "other";

export interface EvidenceItem {
  id: string;
  type: string;
  source: string;
  sourceKind: string;
  sourceNetwork: NetworkId;
  category: EvidenceCategory;
  amountLabel: string;
  amountUsd: number;
  positive: boolean;
  date: string;
  time: string;
  status: "verified" | "pending" | "failed";
  eventId: string;
}

export interface EvidenceBreakdown {
  category: EvidenceCategory;
  label: string;
  pct: number;
  value: number;
  color: string;
}

export interface EvidenceSource {
  id: string;
  name: string;
  network: NetworkId | "aave" | "uniswap";
  activities: number;
  value: number;
}

export interface EvidenceSummary {
  totalVerified: number;
  change: number;
  changePct: number;
  verificationPct: number;
  sourceCount: number;
  strength: "Strong" | "Moderate" | "Weak";
  verifiedEvents: number;
  fundingSources: number;
  counterparties: number;
  protocols: number;
  breakdown: EvidenceBreakdown[];
  topSources: EvidenceSource[];
}

export interface CreditAccount {
  limit: number;
  borrowed: number;
  available: number;
  utilization: number;
  tier: "Starter" | "Standard" | "Prime";
  apr: number;
  changeValue: number;
  changePct: number;
  history: { label: string; value: number }[];
}

export type CreditTxType = "credit-increase" | "borrow" | "repay";

export interface CreditTransaction {
  id: string;
  type: CreditTxType;
  label: string;
  details: string;
  amount: number;
  date: string;
}

export interface CreditDecision {
  previousLimit: number;
  newLimit: number;
  delta: number;
  verifiedEvents: number;
  fundingSources: number;
  counterparties: number;
  protocols: number;
  checks: { label: string; count: number }[];
}

export type VerificationStepState = "pending" | "running" | "done" | "failed";

export interface VerificationStep {
  id: string;
  label: string;
  detail: string;
  state: VerificationStepState;
}

export type BuildCreditPhase =
  | "idle"
  | "wallet"
  | "networks"
  | "analyzing"
  | "verifying"
  | "evaluating"
  | "result"
  | "error";

export interface FarmTestTx {
  id: number;
  from: string;
  to: string;
  label: string;
  asset: string;
  amount: string;
  evidenceGain: number;
  creditGain: number;
  note: string;
}

export interface FarmTestScenario {
  id: "manufactured" | "organic";
  name: string;
  description: string;
  transactions: FarmTestTx[];
  verdictTitle: string;
  verdictBody: string;
  signals: { label: string; state: "bad" | "good" }[];
  evidenceStrength: "Weak" | "Strong";
}

export type ToastKind = "success" | "info" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

export type RouteId =
  | "home"
  | "credit"
  | "borrow"
  | "repay"
  | "activity"
  | "evidence"
  | "wallets"
  | "connect-wallet"
  | "networks"
  | "settings"
  | "build-credit"
  | "credit-result"
  | "farm-test";
