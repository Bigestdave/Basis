/**
 * Protocol and asset registry for live chain event classification.
 *
 * Provides canonical addresses and classification mappings for prominent DeFi protocols
 * on Ethereum, Base, and Sepolia (Uniswap, Aave, Lido, Morpho, etc.).
 */
import type { EconomicEventType } from "@/domain/types";

export interface ProtocolDefinition {
  slug: string;
  name: string;
  category: "dex" | "lending" | "staking" | "bridge" | "payments" | "other";
  /** Lower-cased contract addresses, keyed by chain key. */
  addresses: Record<string, string[]>;
  signatures: string[];
}

export const PROTOCOLS: ProtocolDefinition[] = [
  {
    slug: "uniswap-v3",
    name: "Uniswap V3",
    category: "dex",
    addresses: {
      ethereum: ["0x1f98431c8ad98523631ae4a59f267346ea31f984", "0xe592427a0aece92de3edee1f18e0157c05861564"],
      base: ["0x33128a8fc17869897dce68ed026d694621f6fdfd", "0x2626664c2603336e57b271c5c0b26f421741e481"],
      "base-sepolia": [],
      "ethereum-sepolia": [],
    },
    signatures: ["Swap", "Mint", "Burn", "Collect"],
  },
  {
    slug: "uniswap-v2",
    name: "Uniswap V2",
    category: "dex",
    addresses: {
      ethereum: ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f"],
    },
    signatures: ["Swap", "Mint", "Burn"],
  },
  {
    slug: "aave-v3",
    name: "Aave V3",
    category: "lending",
    addresses: {
      ethereum: ["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"],
      base: ["0xa238dd80c259a72e81d7e4664a9801593f98d1c5"],
    },
    signatures: ["Supply", "Deposit", "Withdraw", "Borrow", "Repay"],
  },
  {
    slug: "morpho",
    name: "Morpho",
    category: "lending",
    addresses: {
      ethereum: ["0xbbbbbbbbbb9cc5e90e3b3ce599de50833257747b"],
      base: ["0xbbbbbbbbbb9cc5e90e3b3ce599de50833257747b"],
    },
    signatures: ["Supply", "Withdraw", "Borrow", "Repay"],
  },
  {
    slug: "lido",
    name: "Lido",
    category: "staking",
    addresses: {
      ethereum: ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"],
    },
    signatures: ["Submitted", "Transfer", "Withdrawal"],
  },
  {
    slug: "wrapped-ether",
    name: "Wrapped Ether",
    category: "other",
    addresses: {
      ethereum: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"],
      base: ["0x4200000000000000000000000000000000000006"],
    },
    signatures: ["Deposit", "Withdrawal"],
  },
];

export interface AssetDefinition {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Record<string, string[]>;
  referencePriceUsd: number;
}

export const KNOWN_ASSETS: AssetDefinition[] = [
  {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    addresses: { ethereum: ["native"], base: ["native"], "ethereum-sepolia": ["native"], "base-sepolia": ["native"] },
    referencePriceUsd: 2500,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    addresses: {
      ethereum: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
      base: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
    },
    referencePriceUsd: 1.0,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    addresses: {
      ethereum: ["0xdac17f958d2ee523a2206206994597c13d831ec7"],
    },
    referencePriceUsd: 1.0,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    addresses: { ethereum: ["0x6b175474e89094c44da98b954eedeac495271d0f"] },
    referencePriceUsd: 1.0,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    addresses: {
      ethereum: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"],
      base: ["0x4200000000000000000000000000000000000006"],
    },
    referencePriceUsd: 2500,
  },
  {
    symbol: "stETH",
    name: "Lido Staked Ether",
    decimals: 18,
    addresses: { ethereum: ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84"] },
    referencePriceUsd: 2480,
  },
  {
    symbol: "CTC",
    name: "Creditcoin",
    decimals: 18,
    addresses: { "creditcoin-testnet": ["native"] },
    referencePriceUsd: 0.5,
  },
];

export function findProtocolByAddress(chainKey: string, address: string | null | undefined): ProtocolDefinition | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const protocol of PROTOCOLS) {
    const list = protocol.addresses[chainKey];
    if (list && list.some((a) => a.toLowerCase() === lower)) return protocol;
  }
  return null;
}

export function findAssetByAddress(chainKey: string, address: string | null | undefined): AssetDefinition | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const asset of KNOWN_ASSETS) {
    const list = asset.addresses[chainKey];
    if (list && list.some((a) => a.toLowerCase() === lower)) return asset;
  }
  return null;
}

export function classifyProtocolSignature(
  signature: string | null,
  protocol: ProtocolDefinition | null,
  direction: "in" | "out",
): EconomicEventType | null {
  if (!signature) return null;
  const name = signature.split("(")[0].trim().toLowerCase();

  switch (name) {
    case "swap":
      return "SWAP";
    case "supply":
    case "deposit":
      if (protocol?.category === "lending") return direction === "out" ? "DEPOSIT" : "WITHDRAW";
      if (protocol?.category === "staking") return direction === "out" ? "STAKE" : "WITHDRAW";
      return direction === "out" ? "DEPOSIT" : "WITHDRAW";
    case "withdraw":
    case "withdrawal":
      return "WITHDRAW";
    case "borrow":
      return "BORROW";
    case "repay":
      return "REPAY";
    case "stake":
    case "submitted":
      return "STAKE";
    case "reward":
    case "rewardspaid":
      return "REWARD";
    case "transfer":
      return direction === "in" ? "FUNDING" : "TRANSFER";
    default:
      return null;
  }
}
