/**
 * Deterministic demo fixtures.
 *
 * NOT static screenshots and NOT `Math.random()`. Every address, tx hash,
 * timestamp and amount below is a fixed constant, so the demo is reproducible
 * across processes, machines and restarts — and so the numbers the demo shows
 * are the numbers the real evidence engine produced from these inputs.
 *
 * Scenario A ("strong history") is deliberately seeded so that the *actual*
 * formula S = C^0.45 x D^0.30 x Q^0.25 yields roughly $4,200 of credit at
 * MAX_BATCH_INCREASE = $5,000. Nothing about the result is hardcoded.
 */
import { deterministicAddress, deterministicHex, deterministicTxHash } from "@/lib/deterministic";
import { normalizeActivity } from "@/domain/normalizer";
import type { EconomicEvent, EconomicEventType } from "@/domain/types";
import type { DecodedLog, RawChainTransaction } from "@/providers/types";

/** Fixed demo epoch: 2026-01-05T09:00:00.000Z. */
export const DEMO_EPOCH_MS = 1_767_603_600_000;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEMO_ASSETS = {
  USDC: { symbol: "USDC", decimals: 6, priceUsd: 1 },
  USDT: { symbol: "USDT", decimals: 6, priceUsd: 1 },
  ETH: { symbol: "ETH", decimals: 18, priceUsd: 2400 },
  WETH: { symbol: "WETH", decimals: 18, priceUsd: 2400 },
  STETH: { symbol: "stETH", decimals: 18, priceUsd: 2380 },
} as const;

export type DemoAssetKey = keyof typeof DEMO_ASSETS;

export const DEMO_SCENARIO_KEYS = [
  "strong-history",
  "manufactured-activity",
  "empty-wallet",
  "verification-in-progress",
  "proof-detail",
] as const;

export type DemoScenarioKey = (typeof DEMO_SCENARIO_KEYS)[number];

export interface DemoActor {
  key: string;
  address: string;
  label: string;
  cluster: string;
}

function actor(scenario: string, key: string, label: string, cluster?: string): DemoActor {
  return {
    key,
    address: deterministicAddress(`basis-demo:${scenario}:${key}`),
    label,
    cluster: cluster ?? key,
  };
}

export interface DemoEventDraft {
  /** ms offset from DEMO_EPOCH_MS */
  at: number;
  type: EconomicEventType;
  chainKey: string;
  asset: DemoAssetKey;
  amountRaw: string;
  /** Actor on the other side of the event. */
  counterparty: DemoActor;
  /** Direction of value relative to the demo wallet. */
  direction: "in" | "out";
  protocol?: string | null;
  blockHeight: number;
  logIndex?: number;
  /** Funding provenance metadata. */
  fundingSource?: DemoActor | null;
  fundingDepth?: number;
  internalCounterparty?: boolean;
  note?: string;
  /** When false the event is seeded as still awaiting attestation. */
  verified?: boolean;
}

export interface DemoScenarioFixture {
  key: DemoScenarioKey;
  label: string;
  description: string;
  narrative: string;
  expectation: string;
  wallet: DemoActor;
  chainKeys: string[];
  startingCreditLimitUsdCents: number;
  startingBorrowedUsdCents: number;
  /** `technical` seeds full Attestcoin proof fields for the evidence detail view. */
  proofDetail: "standard" | "technical" | "minimal";
  events: DemoEventDraft[];
  /** Scenario that ships with a job already mid-flight. */
  seedJobInProgress?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Actors                                                                     */
/* -------------------------------------------------------------------------- */

const STRONG = {
  kraken: actor("strong", "kraken", "Kraken withdrawal", "exchange:kraken"),
  payroll: actor("strong", "payroll", "Acme payroll", "employer:acme-payroll"),
  bridge: actor("strong", "bridge", "Across bridge", "bridge:across"),
  uniswap: actor("strong", "uniswap", "Uniswap v3 Router", "protocol:uniswap-v3"),
  aave: actor("strong", "aave", "Aave v3 Pool", "protocol:aave-v3"),
  lido: actor("strong", "lido", "Lido stETH", "protocol:lido"),
  studio: actor("strong", "studio", "Studio North (supplier)", "merchant:studio-north"),
  vertex: actor("strong", "vertex", "Vertex Client (invoice)", "client:vertex"),
};

const FARM = {
  hub: actor("farm", "hub", "Funding hub", "hub:single-origin"),
};

const PROGRESS = {
  coinbase: actor("progress", "coinbase", "Coinbase withdrawal", "exchange:coinbase"),
  friend: actor("progress", "friend", "Peer transfer", "peer:individual"),
  uniswap: actor("progress", "uniswap", "Uniswap v3 Router", "protocol:uniswap-v3"),
  compound: actor("progress", "compound", "Compound v3", "protocol:compound-v3"),
};

const TECHNICAL = {
  binance: actor("technical", "binance", "Binance withdrawal", "exchange:binance"),
  curve: actor("technical", "curve", "Curve Pool", "protocol:curve"),
  morpho: actor("technical", "morpho", "Morpho Vault", "protocol:morpho"),
  supplier: actor("technical", "supplier", "Northwind Ltd", "merchant:northwind"),
  payroll: actor("technical", "payroll", "Meridian payroll", "employer:meridian-payroll"),
};

/* -------------------------------------------------------------------------- */
/* Scenario A — strong, economically diverse history                          */
/* -------------------------------------------------------------------------- */

const strongHistory: DemoScenarioFixture = {
  key: "strong-history",
  label: "Strong economic history",
  description:
    "Three independently funded sources, a swap, DeFi deposit, borrow, two partial repayments and outbound payments to distinct counterparties.",
  narrative:
    "Independent funding source #1 → independent funding source #2 → token swap → DeFi deposit → borrow → partial repayment → transfer to a distinct counterparty → activity on another protocol → second repayment.",
  expectation: "High capital independence, high economic diversity, coherent sequence → substantial credit.",
  wallet: actor("strong", "wallet", "Demo wallet A"),
  chainKeys: ["ethereum-sepolia", "base-sepolia"],
  startingCreditLimitUsdCents: 0,
  startingBorrowedUsdCents: 0,
  proofDetail: "standard",
  events: [
    {
      at: 0,
      type: "FUNDING",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "1200000000",
      counterparty: STRONG.kraken,
      direction: "in",
      blockHeight: 7_210_001,
      fundingSource: STRONG.kraken,
      fundingDepth: 2,
      note: "Withdrawal from a regulated exchange custody account.",
    },
    {
      at: 2 * DAY,
      type: "FUNDING",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "900000000",
      counterparty: STRONG.payroll,
      direction: "in",
      blockHeight: 7_210_880,
      fundingSource: STRONG.payroll,
      fundingDepth: 3,
      note: "Recurring payroll inflow from an unrelated employer.",
    },
    {
      at: 5 * DAY,
      type: "FUNDING",
      chainKey: "base-sepolia",
      asset: "ETH",
      amountRaw: "250000000000000000",
      counterparty: STRONG.bridge,
      direction: "in",
      blockHeight: 15_400_220,
      fundingSource: STRONG.bridge,
      fundingDepth: 2,
      note: "Bridged in from a third, unrelated origin.",
    },
    {
      at: 5 * DAY + 3.5 * HOUR,
      type: "SWAP",
      chainKey: "base-sepolia",
      asset: "WETH",
      amountRaw: "333333000000000000",
      counterparty: STRONG.uniswap,
      direction: "out",
      protocol: "uniswap-v3",
      blockHeight: 15_400_910,
      note: "USDC → WETH on a public AMM.",
    },
    {
      at: 9 * DAY,
      type: "DEPOSIT",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "1500000000",
      counterparty: STRONG.aave,
      direction: "out",
      protocol: "aave-v3",
      blockHeight: 15_412_004,
      note: "Supplied as collateral to a lending market.",
    },
    {
      at: 9 * DAY + 6 * HOUR,
      type: "BORROW",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "600000000",
      counterparty: STRONG.aave,
      direction: "in",
      protocol: "aave-v3",
      blockHeight: 15_413_120,
      note: "Borrowed against the supplied collateral.",
    },
    {
      at: 16 * DAY,
      type: "REPAY",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "250000000",
      counterparty: STRONG.aave,
      direction: "out",
      protocol: "aave-v3",
      blockHeight: 15_430_777,
      note: "First partial repayment.",
    },
    {
      at: 18 * DAY,
      type: "TRANSFER",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "400000000",
      counterparty: STRONG.studio,
      direction: "out",
      blockHeight: 7_218_442,
      note: "Payment to a distinct supplier with no prior relationship.",
    },
    {
      at: 24 * DAY,
      type: "STAKE",
      chainKey: "ethereum-sepolia",
      asset: "STETH",
      amountRaw: "300000000000000000",
      counterparty: STRONG.lido,
      direction: "out",
      protocol: "lido",
      blockHeight: 7_221_900,
      note: "Staked on a second, unrelated protocol.",
    },
    {
      at: 31 * DAY,
      type: "PAYMENT",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "350000000",
      counterparty: STRONG.vertex,
      direction: "out",
      blockHeight: 15_470_310,
      note: "Invoice settlement to a second distinct counterparty.",
    },
    {
      at: 40 * DAY,
      type: "REPAY",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "350000000",
      counterparty: STRONG.aave,
      direction: "out",
      protocol: "aave-v3",
      blockHeight: 15_495_860,
      note: "Second repayment closing the borrowed position.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Scenario B — manufactured / farmed activity                                */
/* -------------------------------------------------------------------------- */

const manufacturedActivity: DemoScenarioFixture = {
  key: "manufactured-activity",
  label: "Manufactured activity",
  description:
    "Six transactions and $600 of volume — all of it round trips with the same address that funded the wallet, on a metronome.",
  narrative: "A → B, B → A, A → B, B → A, A → B … funded by B in the first place.",
  expectation:
    "Same funding source, repeated counterparty, circular transfer structure, low diversity, low coherence → more activity, not more credit.",
  wallet: actor("farm", "wallet", "Demo wallet B"),
  chainKeys: ["ethereum-sepolia"],
  startingCreditLimitUsdCents: 0,
  startingBorrowedUsdCents: 0,
  proofDetail: "standard",
  // Exactly six transactions, $100 each, $600 of volume — three round trips with
  // the address that also funded the wallet, on a metronomic 10 minute interval.
  events: [0, 1, 2].flatMap(
    (i): DemoEventDraft[] => [
      {
        at: (i * 2 + 1) * 600_000,
        type: "TRANSFER",
        chainKey: "ethereum-sepolia",
        asset: "USDC",
        amountRaw: "100000000",
        counterparty: FARM.hub,
        direction: "out",
        blockHeight: 7_300_001 + i * 2,
        fundingSource: FARM.hub,
        fundingDepth: 1,
        internalCounterparty: true,
        note: "Outbound leg of a round trip with the funding hub.",
      },
      {
        at: (i * 2 + 2) * 600_000,
        type: "TRANSFER",
        chainKey: "ethereum-sepolia",
        asset: "USDC",
        amountRaw: "100000000",
        counterparty: FARM.hub,
        direction: "in",
        blockHeight: 7_300_002 + i * 2,
        fundingSource: FARM.hub,
        fundingDepth: 1,
        internalCounterparty: true,
        note: "Inbound leg of the same round trip — the value never left the cluster.",
      },
    ],
  ),
};

/* -------------------------------------------------------------------------- */
/* Scenario C — empty wallet                                                  */
/* -------------------------------------------------------------------------- */

const emptyWallet: DemoScenarioFixture = {
  key: "empty-wallet",
  label: "Empty wallet",
  description: "No transactions, no attestations, no evidence, no score and no credit increase.",
  narrative: "A freshly generated address that has never held value.",
  expectation: "The product states plainly that there is no verified evidence yet — nothing is invented.",
  wallet: actor("empty", "wallet", "Demo wallet C"),
  chainKeys: ["ethereum-sepolia", "base-sepolia"],
  startingCreditLimitUsdCents: 0,
  startingBorrowedUsdCents: 0,
  proofDetail: "minimal",
  events: [],
};

/* -------------------------------------------------------------------------- */
/* Scenario D — verification in progress                                      */
/* -------------------------------------------------------------------------- */

const verificationInProgress: DemoScenarioFixture = {
  key: "verification-in-progress",
  label: "Verification in progress",
  description:
    "History has been fetched but three events are still waiting for Attestcoin attestors to attest the source blocks.",
  narrative: "Sync → fetch → proof build → attest (waiting) → normalise → evaluate.",
  expectation: "The job pipeline reports partial verification; credit is decided only from verified events.",
  wallet: actor("progress", "wallet", "Demo wallet D"),
  chainKeys: ["ethereum-sepolia", "base-sepolia"],
  startingCreditLimitUsdCents: 0,
  startingBorrowedUsdCents: 0,
  proofDetail: "standard",
  seedJobInProgress: true,
  events: [
    {
      at: 0,
      type: "FUNDING",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "750000000",
      counterparty: PROGRESS.coinbase,
      direction: "in",
      blockHeight: 7_410_001,
      fundingSource: PROGRESS.coinbase,
      fundingDepth: 2,
      note: "Verified: exchange withdrawal.",
    },
    {
      at: 3 * DAY,
      type: "SWAP",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "300000000",
      counterparty: PROGRESS.uniswap,
      direction: "out",
      protocol: "uniswap-v3",
      blockHeight: 7_411_200,
      note: "Verified: AMM swap.",
    },
    {
      at: 6 * DAY,
      type: "DEPOSIT",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "450000000",
      counterparty: PROGRESS.compound,
      direction: "out",
      protocol: "compound-v3",
      blockHeight: 15_500_700,
      note: "Verified: money-market supply.",
    },
    {
      at: 9 * DAY,
      type: "TRANSFER",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "120000000",
      counterparty: PROGRESS.friend,
      direction: "out",
      blockHeight: 7_415_900,
      verified: false,
      note: "Awaiting attestation of block 7,415,900.",
    },
    {
      at: 11 * DAY,
      type: "BORROW",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "200000000",
      counterparty: PROGRESS.compound,
      direction: "in",
      protocol: "compound-v3",
      blockHeight: 15_508_100,
      verified: false,
      note: "Awaiting attestation of block 15,508,100.",
    },
    {
      at: 14 * DAY,
      type: "REPAY",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "100000000",
      counterparty: PROGRESS.compound,
      direction: "out",
      protocol: "compound-v3",
      blockHeight: 15_514_600,
      verified: false,
      note: "Awaiting attestation of block 15,514,600.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Scenario E — evidence with technical Attestcoin proof detail               */
/* -------------------------------------------------------------------------- */

const proofDetail: DemoScenarioFixture = {
  key: "proof-detail",
  label: "Attestcoin proof detail",
  description:
    "A credited history whose attestations expose the full technical proof object: chain key, attested header, encoded transaction bytes, Merkle root and siblings, continuity digest and roots, and the BlockProver precompile that checked it.",
  narrative: "Verified facts with the cross-chain proof attached to every event.",
  expectation: "Existing credit state plus inspectable proof data on each event.",
  wallet: actor("technical", "wallet", "Demo wallet E"),
  chainKeys: ["ethereum-sepolia", "base-sepolia"],
  startingCreditLimitUsdCents: 185_000,
  startingBorrowedUsdCents: 30_000,
  proofDetail: "technical",
  events: [
    {
      at: 0,
      type: "FUNDING",
      chainKey: "ethereum-sepolia",
      asset: "USDT",
      amountRaw: "1100000000",
      counterparty: TECHNICAL.binance,
      direction: "in",
      blockHeight: 7_500_111,
      fundingSource: TECHNICAL.binance,
      fundingDepth: 2,
      note: "Proven from Ethereum Sepolia into Creditcoin CC3.",
    },
    {
      at: 2 * DAY,
      type: "FUNDING",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "500000000",
      counterparty: TECHNICAL.payroll,
      direction: "in",
      blockHeight: 15_598_020,
      fundingSource: TECHNICAL.payroll,
      fundingDepth: 3,
      note: "Second, unrelated funding origin — proves capital independence.",
    },
    {
      at: 4 * DAY,
      type: "SWAP",
      chainKey: "ethereum-sepolia",
      asset: "USDT",
      amountRaw: "500000000",
      counterparty: TECHNICAL.curve,
      direction: "out",
      protocol: "curve",
      blockHeight: 7_501_900,
      note: "Stableswap with a Merkle inclusion proof at tx index 4.",
    },
    {
      at: 8 * DAY,
      type: "DEPOSIT",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "900000000",
      counterparty: TECHNICAL.morpho,
      direction: "out",
      protocol: "morpho",
      blockHeight: 15_600_400,
      note: "Continuity proof chains this block back to an attestation checkpoint.",
    },
    {
      at: 12 * DAY,
      type: "BORROW",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "400000000",
      counterparty: TECHNICAL.morpho,
      direction: "in",
      protocol: "morpho",
      blockHeight: 15_606_200,
      note: "Borrow verified through the 0x0FD2 BlockProver precompile.",
    },
    {
      at: 20 * DAY,
      type: "PAYMENT",
      chainKey: "ethereum-sepolia",
      asset: "USDC",
      amountRaw: "600000000",
      counterparty: TECHNICAL.supplier,
      direction: "out",
      blockHeight: 7_509_750,
      note: "Outbound settlement to an unrelated merchant.",
    },
    {
      at: 27 * DAY,
      type: "REPAY",
      chainKey: "base-sepolia",
      asset: "USDC",
      amountRaw: "250000000",
      counterparty: TECHNICAL.morpho,
      direction: "out",
      protocol: "morpho",
      blockHeight: 15_620_880,
      note: "Partial repayment, batch-verified with a shared continuity proof.",
    },
  ],
};

export const DEMO_SCENARIOS: Record<DemoScenarioKey, DemoScenarioFixture> = {
  "strong-history": strongHistory,
  "manufactured-activity": manufacturedActivity,
  "empty-wallet": emptyWallet,
  "verification-in-progress": verificationInProgress,
  "proof-detail": proofDetail,
};

export const DEMO_SCENARIO_LIST = DEMO_SCENARIO_KEYS.map((key) => DEMO_SCENARIOS[key]);

/* -------------------------------------------------------------------------- */
/* Materialisation                                                            */
/* -------------------------------------------------------------------------- */

export interface MaterializedScenario {
  fixture: DemoScenarioFixture;
  walletId: string;
  userId: string;
  address: string;
  events: EconomicEvent[];
  volumeUsdCents: number;
}

function walletIdFor(fixture: DemoScenarioFixture): string {
  return `wal_demo_${fixture.key}`;
}

function userIdFor(fixture: DemoScenarioFixture): string {
  return `usr_demo_${fixture.key}`;
}

export interface DemoRawTransactionInput {
  txHash: string;
  draft: DemoEventDraft;
  walletAddress: string;
  scenarioKey: DemoScenarioKey;
  index: number;
}

/**
 * Render a fixture as *raw chain data*, exactly the shape a live chain adapter
 * would return. Demo mode is therefore not a shortcut around the pipeline: the
 * shared normalizer turns this into `EconomicEvent`s the same way it turns real
 * RPC responses into events.
 */
export function demoRawTransactions(
  key: DemoScenarioKey,
  salt = "",
  subjectAddress?: string,
): RawChainTransaction[] {
  const fixture = DEMO_SCENARIOS[key];
  // The subject address matters: flows are only economic *for a given wallet*.
  // A Farm Test sandbox reuses the fixture but has its own address, so the raw
  // data must be rendered around the address actually being queried.
  const walletAddress = (subjectAddress ?? fixture.wallet.address).trim().toLowerCase();
  const sorted = [...fixture.events].sort((a, b) => a.at - b.at || a.blockHeight - b.blockHeight);

  return sorted.map((draft, index) => {
    const asset = DEMO_ASSETS[draft.asset];
    // The salt keeps raw chain identity wallet-scoped. Without it a Farm Test
    // sandbox reusing the same fixture would collide with (and be able to delete)
    // a demo wallet's raw transactions, which are unique on (chainKey, txHash).
    const txHash = demoTxHash(fixture.key, index, salt);
    const from = draft.direction === "in" ? draft.counterparty.address : walletAddress;
    const to = draft.direction === "in" ? walletAddress : draft.counterparty.address;
    const nativeSymbols: string[] = ["ETH", "CTC"];
    const isNativeTransfer = !draft.protocol && nativeSymbols.includes(asset.symbol);

    const decoded: DecodedLog = {
      type: draft.type,
      asset: asset.symbol,
      assetDecimals: asset.decimals,
      amountRaw: draft.amountRaw,
      priceUsd: asset.priceUsd,
      from,
      to,
      protocol: draft.protocol ?? null,
      metadata: {
        fundingSource: draft.fundingSource?.address ?? null,
        fundingSourceCluster: draft.fundingSource?.cluster ?? null,
        fundingDepth: draft.fundingDepth ?? null,
        internalCounterparty: draft.internalCounterparty ?? Boolean(draft.protocol),
        protocolVersion: draft.protocol ?? null,
        priceUsd: asset.priceUsd,
        note: draft.note ?? null,
        cycleId: null,
        counterpartyLabel: draft.counterparty.label,
        counterpartyCluster: draft.counterparty.cluster,
        scenarioKey: fixture.key,
        demoActorKey: draft.counterparty.key,
      },
    };

    return {
      chainKey: draft.chainKey,
      chainId: chainIdFor(draft.chainKey),
      txHash,
      blockHeight: draft.blockHeight,
      blockHash: deterministicHex(`block:${fixture.key}:${salt}:${draft.blockHeight}`, 32),
      from,
      to,
      valueRaw: isNativeTransfer ? draft.amountRaw : "0",
      data: draft.protocol ? deterministicHex(`calldata:${fixture.key}:${index}`, 68) : "0x",
      status: "SUCCESS" as const,
      timestampMs: DEMO_EPOCH_MS + draft.at,
      logs: [
        {
          logIndex: draft.logIndex ?? 0,
          address: draft.counterparty.address,
          topics: [deterministicHex(`topic0:${fixture.key}:${index}`, 32), padTopic(from), padTopic(to)],
          data: deterministicHex(`logdata:${fixture.key}:${index}`, 32),
          decoded,
        },
      ],
    };
  });
}

function padTopic(address: string): string {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}`;
}

export function demoTxHash(scenarioKey: string, index: number, salt = ""): string {
  return deterministicTxHash(`basis-demo:${scenarioKey}:${salt}:${index}`);
}

export interface ResolvedDemoWallet {
  fixture: DemoScenarioFixture;
  /** "" for demo wallets, `farm:<key>` for Farm Test sandbox wallets. */
  salt: string;
}

/** Resolve any demo-controlled address (demo wallet or farm sandbox) to its data. */
export function resolveDemoWallet(address: string): ResolvedDemoWallet | null {
  const target = address.trim().toLowerCase();
  const direct = DEMO_SCENARIO_LIST.find((f) => f.wallet.address.toLowerCase() === target);
  if (direct) return { fixture: direct, salt: "" };
  for (const key of FARM_SCENARIO_KEYS) {
    if (farmWalletAddress(key).toLowerCase() === target) {
      return { fixture: DEMO_SCENARIOS[FARM_SCENARIO_MAP[key]], salt: `farm:${key}` };
    }
  }
  return null;
}

/** True when the demo attestors have not yet attested this block. */
export function isDemoAttestationPending(scenarioKey: DemoScenarioKey, index: number): boolean {
  const draft = [...DEMO_SCENARIOS[scenarioKey].events]
    .sort((a, b) => a.at - b.at || a.blockHeight - b.blockHeight)
    [index];
  return draft ? draft.verified === false : false;
}

/**
 * Farm Test sandbox wallets. Distinct addresses from the demo wallets so a Farm
 * Test run can never mutate a user's real demo credit account, while still
 * resolving to the same deterministic fixture data.
 */
export const FARM_SCENARIO_KEYS = ["manufactured", "genuine"] as const;
export type FarmScenarioKey = (typeof FARM_SCENARIO_KEYS)[number];

export const FARM_SCENARIO_MAP: Record<FarmScenarioKey, DemoScenarioKey> = {
  manufactured: "manufactured-activity",
  genuine: "strong-history",
};

export function farmWalletAddress(key: FarmScenarioKey): string {
  return deterministicAddress(`basis-farm-test:${key}`);
}

export function farmWalletId(key: FarmScenarioKey): string {
  return `wal_farm_${key}`;
}

export function demoScenarioForAddress(address: string): DemoScenarioFixture | undefined {
  const target = address.trim().toLowerCase();
  const direct = DEMO_SCENARIO_LIST.find((f) => f.wallet.address.toLowerCase() === target);
  if (direct) return direct;
  for (const key of FARM_SCENARIO_KEYS) {
    if (farmWalletAddress(key).toLowerCase() === target) return DEMO_SCENARIOS[FARM_SCENARIO_MAP[key]];
  }
  return undefined;
}

/** Turn a fixture into canonical `EconomicEvent`s via the shared normalizer. */
export function materializeScenario(key: DemoScenarioKey): MaterializedScenario {
  const fixture = DEMO_SCENARIOS[key];
  const walletId = walletIdFor(fixture);
  const address = fixture.wallet.address;

  const raw = demoRawTransactions(key);
  const { events } = normalizeActivity({ walletId, walletAddress: address, transactions: raw });

  // Verification state is the attestation provider's job; the demo provider
  // reports these tx hashes as still awaiting attestation.
  const pending = new Set(
    fixture.events
      .map((draft, index) => ({ draft, index }))
      .sort((a, b) => a.draft.at - b.draft.at || a.draft.blockHeight - b.draft.blockHeight)
      .filter(({ draft }) => draft.verified === false)
      .map(({ index }) => demoTxHash(fixture.key, index)),
  );
  for (const event of events) {
    event.verified = !pending.has(event.txHash);
  }

  return {
    fixture,
    walletId,
    userId: userIdFor(fixture),
    address,
    events,
    volumeUsdCents: events.reduce((acc, e) => acc + e.amountUsdCents, 0),
  };
}

export function chainIdFor(chainKey: string): number | null {
  switch (chainKey) {
    case "ethereum-sepolia":
      return 11155111;
    case "ethereum":
      return 1;
    case "base-sepolia":
      return 84532;
    case "base":
      return 8453;
    case "creditcoin-testnet":
      return 102031;
    default:
      return null;
  }
}

export const demoWalletId = walletIdFor;
export const demoUserId = userIdFor;

export function isDemoScenarioKey(value: string): value is DemoScenarioKey {
  return (DEMO_SCENARIO_KEYS as readonly string[]).includes(value);
}
