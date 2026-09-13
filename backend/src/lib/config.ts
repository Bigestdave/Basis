/**
 * Central runtime configuration.
 *
 * Everything that can vary between DEMO and LIVE mode is resolved here so that
 * no other module reads `process.env` directly. Business logic never branches on
 * mode: only the provider registry does (see `src/providers/index.ts`).
 */

export type AppMode = "demo" | "live";

function readMode(): AppMode {
  const raw = (process.env.APP_MODE ?? "demo").trim().toLowerCase();
  return raw === "live" || raw === "production" || raw === "testnet" ? "live" : "demo";
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function float(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback = ""): string {
  const raw = process.env[name];
  return raw && raw.length > 0 ? raw : fallback;
}

export const APP_MODE: AppMode = readMode();
export const IS_DEMO = APP_MODE === "demo";
export const IS_LIVE = APP_MODE === "live";

/** Session signing key. Required in live mode; derived (insecurely) in demo. */
export const SESSION_SECRET: string =
  str("SESSION_SECRET") || (IS_DEMO ? "basis-demo-insecure-session-secret" : "");

if (IS_LIVE && !str("SESSION_SECRET")) {
  // Fail loudly rather than silently running with an unsigned session.
  throw new Error("SESSION_SECRET is required when APP_MODE=live");
}

export const SESSION_COOKIE_NAME = "basis_session";
export const SESSION_TTL_MS = int("SESSION_TTL_MS", 1000 * 60 * 60 * 12);
export const NONCE_TTL_MS = int("AUTH_NONCE_TTL_MS", 1000 * 60 * 5);

/** Bump when the evidence engine maths change so old evaluations are not reused. */
export const EVIDENCE_ENGINE_VERSION = "1.0.0";
export const CREDIT_ENGINE_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Credit engine configuration                                                */
/* -------------------------------------------------------------------------- */

export const creditConfig = {
  /** A single evidence evaluation can raise the limit by at most this amount. */
  maxBatchIncreaseUsdCents: int("CREDIT_MAX_BATCH_INCREASE_USD", 5_000) * 100,
  /** Hard ceiling on the credit limit regardless of evidence. */
  absoluteLimitCapUsdCents: int("CREDIT_ABSOLUTE_CAP_USD", 50_000) * 100,
  /** Evidence below this produces a zero-increase decision (recorded, not awarded). */
  minEvidenceThreshold: float("CREDIT_MIN_EVIDENCE_THRESHOLD", 0.1),
  /** Minimum time between two *credited* evaluations for the same wallet. */
  evaluationCooldownMs: int("CREDIT_EVALUATION_COOLDOWN_MS", 60_000),
  /** Events older than this are stale and cannot produce credit. */
  staleEventMaxAgeMs: int("CREDIT_STALE_EVENT_MAX_AGE_DAYS", 730) * 24 * 60 * 60 * 1000,
  /** Guard against unbounded evaluation payloads. */
  maxEventsPerEvaluation: int("CREDIT_MAX_EVENTS_PER_EVALUATION", 500),
  /** Minimum distinct verified events required before any credit is considered. */
  minEventsForCredit: int("CREDIT_MIN_EVENTS", 3),
} as const;

/* -------------------------------------------------------------------------- */
/* Evidence engine configuration                                              */
/* -------------------------------------------------------------------------- */

/** S = C^0.45 x D^0.30 x Q^0.25 — the geometric weighting is intentional. */
export const evidenceExponents = {
  capitalIndependence: 0.45,
  economicDiversity: 0.3,
  behavioralCoherence: 0.25,
} as const;

export const evidenceConfig = {
  /** A funding inflow below this share of total inflow is not an "independent source". */
  minFundingSourceShare: float("EVIDENCE_MIN_FUNDING_SHARE", 0.05),
  /** Absolute floor (USD cents) for a funding source to count. */
  minFundingSourceUsdCents: int("EVIDENCE_MIN_FUNDING_USD", 10) * 100,
  /** Funding depth beyond which no extra credit is given. */
  maxFundingDepth: 3,
  // NOTE: dimension saturation constants live in `EVIDENCE_WEIGHTS`
  // (src/domain/evidence/dimensions.ts) so the calibration table is in one place.
  /** Inter-event gap buckets used for timing entropy (seconds). */
  timingBucketsSec: [60, 600, 3_600, 21_600, 86_400, 604_800] as readonly number[],
  /** A repay this soon after a borrow is treated as a manufactured motif. */
  instantRepayWindowMs: int("EVIDENCE_INSTANT_REPAY_WINDOW_MS", 10 * 60 * 1000),
  /** Two events closer than this are treated as batched/scripted. */
  scriptedGapMs: int("EVIDENCE_SCRIPTED_GAP_MS", 5 * 1000),
} as const;

/* -------------------------------------------------------------------------- */
/* Chains                                                                     */
/* -------------------------------------------------------------------------- */

export interface ChainDefinition {
  /** Canonical BASIS chain key, e.g. `ethereum-sepolia`. */
  key: string;
  /** EVM chain id (null for non-EVM chains). */
  chainId: number | null;
  name: string;
  family: "evm" | "solana" | "substrate";
  rpcEnvVar: string;
  blockExplorerTx?: (hash: string) => string;
  /**
   * Attestcoin/USC chain key. Only values confirmed against official
   * documentation are hardcoded; anything else is resolved at runtime from the
   * ChainInfo precompile (`0x...0FD3`) by matching `chainId`.
   */
  knownAttestcoinChainKey: number | null;
  enabledInDemo: boolean;
}

export const CHAINS: readonly ChainDefinition[] = [
  {
    key: "ethereum-sepolia",
    chainId: 11155111,
    name: "Ethereum Sepolia",
    family: "evm",
    rpcEnvVar: "SEPOLIA_RPC_URL",
    blockExplorerTx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
    // Confirmed in official USC docs: chainKey 1 == Ethereum Sepolia on CC3/USC testnet.
    knownAttestcoinChainKey: 1,
    enabledInDemo: true,
  },
  {
    key: "ethereum",
    chainId: 1,
    name: "Ethereum Mainnet",
    family: "evm",
    rpcEnvVar: "ETHEREUM_RPC_URL",
    blockExplorerTx: (h) => `https://etherscan.io/tx/${h}`,
    knownAttestcoinChainKey: null,
    enabledInDemo: true,
  },
  {
    key: "base-sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    family: "evm",
    rpcEnvVar: "BASE_SEPOLIA_RPC_URL",
    blockExplorerTx: (h) => `https://sepolia.basescan.org/tx/${h}`,
    knownAttestcoinChainKey: null,
    enabledInDemo: true,
  },
  {
    key: "base",
    chainId: 8453,
    name: "Base",
    family: "evm",
    rpcEnvVar: "BASE_RPC_URL",
    blockExplorerTx: (h) => `https://basescan.org/tx/${h}`,
    knownAttestcoinChainKey: null,
    enabledInDemo: true,
  },
  {
    key: "creditcoin-testnet",
    chainId: 102031,
    name: "Creditcoin CC3 Testnet",
    family: "substrate",
    rpcEnvVar: "CREDITCOIN_RPC_URL",
    blockExplorerTx: (h) => `https://creditcoin-testnet.blockscout.com/tx/${h}`,
    knownAttestcoinChainKey: null,
    enabledInDemo: true,
  },
] as const;

export function chainByKey(key: string): ChainDefinition | undefined {
  return CHAINS.find((c) => c.key === key);
}

export function chainByChainId(chainId: number): ChainDefinition | undefined {
  return CHAINS.find((c) => c.chainId === chainId);
}

export const demoChainKeys = ["ethereum-sepolia", "base-sepolia", "creditcoin-testnet"] as const;

/* -------------------------------------------------------------------------- */
/* Attestcoin (USC)                                                           */
/* -------------------------------------------------------------------------- */

export const attestcoinConfig = {
  /** Creditcoin RPC used to reach the BlockProver / ChainInfo precompiles. */
  rpcUrl: str("ATTESTCOIN_RPC_URL", "https://rpc.cc3-testnet.creditcoin.network"),
  /** USC proof-generation service. */
  proverUrl: str("ATTESTCOIN_PROVER_URL", "https://prover.cc3-testnet.creditcoin.network"),
  blockProverAddress: str(
    "ATTESTCOIN_BLOCK_PROVER_ADDRESS",
    "0x0000000000000000000000000000000000000FD2",
  ),
  chainInfoAddress: str(
    "ATTESTCOIN_CHAIN_INFO_ADDRESS",
    "0x0000000000000000000000000000000000000fd3",
  ),
  /** How long to wait for the attestors to attest a source block (ms). */
  attestationTimeoutMs: int("ATTESTCOIN_ATTESTATION_TIMEOUT_MS", 15 * 60 * 1000),
  attestationPollMs: int("ATTESTCOIN_ATTESTATION_POLL_MS", 15_000),
  requestTimeoutMs: int("ATTESTCOIN_REQUEST_TIMEOUT_MS", 15_000),
  enabled: IS_LIVE && str("ATTESTCOIN_ENABLED", "true") !== "false",
};

/* -------------------------------------------------------------------------- */
/* Creditcoin                                                                 */
/* -------------------------------------------------------------------------- */

export const creditcoinConfig = {
  rpcUrl: str("CREDITCOIN_RPC_URL", "https://rpc.cc3-testnet.creditcoin.network"),
  chainId: int("CREDITCOIN_CHAIN_ID", 102031),
  /**
   * Address of the BASIS credit ledger contract deployed on Creditcoin.
   * Creditcoin itself does not ship a canonical "credit account" contract, so
   * the on-chain credit state lives in a BASIS-owned contract. When this is not
   * configured the CreditcoinProvider operates in read-only/mirror mode and
   * reports `onchain: false` instead of pretending to have settled.
   */
  ledgerAddress: str("CREDITCOIN_LEDGER_ADDRESS"),
  /** Private key of the settlement account. NEVER exposed to the client. */
  settlementPrivateKey: str("CREDITCOIN_SETTLEMENT_PRIVATE_KEY"),
  enabled: IS_LIVE && str("CREDITCOIN_ENABLED", "true") !== "false",
};

export const chainRpcUrl = (chain: ChainDefinition): string | null => str(chain.rpcEnvVar) || null;

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export const jobConfig = {
  /** Per-step simulated work window in demo mode (ms) so progress is observable. */
  demoStepDelayMs: int("JOB_DEMO_STEP_DELAY_MS", 450),
  stepTimeoutMs: int("JOB_STEP_TIMEOUT_MS", 120_000),
  jobTimeoutMs: int("JOB_TIMEOUT_MS", 15 * 60 * 1000),
  reaperIntervalMs: int("JOB_REAPER_INTERVAL_MS", 60_000),
};

export const rateLimitConfig = {
  windowMs: int("RATE_LIMIT_WINDOW_MS", 60_000),
  authMax: int("RATE_LIMIT_AUTH_MAX", 20),
  mutationMax: int("RATE_LIMIT_MUTATION_MAX", 60),
  readMax: int("RATE_LIMIT_READ_MAX", 300),
};

export const serverInfo = {
  appMode: APP_MODE,
  evidenceEngineVersion: EVIDENCE_ENGINE_VERSION,
  creditEngineVersion: CREDIT_ENGINE_VERSION,
  creditConfig,
  attestcoin: {
    enabled: attestcoinConfig.enabled,
    proverUrl: attestcoinConfig.proverUrl,
    rpcUrl: attestcoinConfig.rpcUrl,
    blockProverAddress: attestcoinConfig.blockProverAddress,
    chainInfoAddress: attestcoinConfig.chainInfoAddress,
  },
  creditcoin: {
    enabled: creditcoinConfig.enabled,
    rpcUrl: creditcoinConfig.rpcUrl,
    chainId: creditcoinConfig.chainId,
    ledgerConfigured: creditcoinConfig.ledgerAddress.length > 0,
    ledgerAddress: creditcoinConfig.ledgerAddress || null,
  },
} as const;
