/**
 * Live EVM chain-data adapter (viem).
 *
 * One class, many chains: a `ChainAdapter` is just this provider constructed
 * with a different viem chain + RPC. Adding Solana means writing a sibling
 * adapter that satisfies `ChainDataProvider` — nothing else in BASIS changes.
 *
 * Honest limitations, documented rather than hidden:
 *  - Public JSON-RPC does not offer "all transactions for an address". Full
 *    history therefore requires an indexer. When `<CHAIN>_EXPLORER_API_URL`
 *    (Blockscout v2) is configured we use it; otherwise we fall back to a
 *    strictly bounded block scan and report `partial: true`.
 *  - Log decoding covers the standard ERC-20 `Transfer` topic. Protocol
 *    identification comes from the `protocols` table / env, never from guessing.
 */
import {
  createPublicClient,
  http,
  type Chain,
  type Log,
  type PublicClient,
  type Transaction,
  type TransactionReceipt,
} from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";
import { AppError } from "@/lib/errors";
import { normalizeAddress } from "@/lib/deterministic";
import { chainByKey, chainRpcUrl } from "@/lib/config";
import type {
  ChainDataProvider,
  ChainDescriptor,
  FundingGraphHint,
  LogFilter,
  ProviderDescriptor,
  RawChainLog,
  RawChainTransaction,
  WalletActivityPage,
  WalletActivityQuery,
} from "@/providers/types";

/** keccak256("Transfer(address,address,uint256)") — the standard ERC-20 event. */
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const VIEM_CHAINS: Record<string, Chain> = {
  "ethereum-sepolia": sepolia,
  ethereum: mainnet,
  "base-sepolia": baseSepolia,
  base,
};

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function explorerApiUrl(chainKey: string): string | null {
  const direct = process.env[`${chainKey.toUpperCase().replace(/-/g, "_")}_EXPLORER_API_URL`];
  if (direct) return direct.replace(/\/$/, "");
  const defaults: Record<string, string> = {
    "creditcoin-testnet": "https://creditcoin-testnet.blockscout.com",
  };
  return defaults[chainKey] ?? null;
}

interface ProtocolHint {
  address: string;
  key: string;
}

export interface EvmAdapterOptions {
  chainKey: string;
  /** Known protocol contracts, resolved from the DB or env. */
  protocols?: ProtocolHint[];
  /** USD prices by asset symbol. */
  prices?: Record<string, number>;
  scanMaxBlocks?: number;
}

export class EvmChainDataProvider implements ChainDataProvider {
  readonly descriptor: ProviderDescriptor;
  private readonly chainKey: string;
  private readonly viemChain: Chain | undefined;
  private readonly rpcUrl: string | null;
  private client: PublicClient | null = null;
  private readonly protocols: ProtocolHint[];
  private readonly prices: Record<string, number>;
  private readonly scanMaxBlocks: number;

  constructor(options: EvmAdapterOptions) {
    this.chainKey = options.chainKey;
    this.viemChain = VIEM_CHAINS[options.chainKey];
    this.rpcUrl = chainRpcUrl(chainByKey(options.chainKey)!);
    this.protocols = (options.protocols ?? []).map((p) => ({ ...p, address: normalizeAddress(p.address) }));
    this.prices = options.prices ?? {};
    this.scanMaxBlocks = options.scanMaxBlocks ?? intEnv("CHAIN_SCAN_MAX_BLOCKS", 2_000);
    this.descriptor = {
      id: `evm:${options.chainKey}`,
      mode: "live",
      kind: "chain-data",
      available: Boolean(this.rpcUrl),
      notes: this.rpcUrl
        ? "Live JSON-RPC adapter. Full address history additionally requires an indexer (Blockscout v2) or a bounded block scan."
        : `No RPC URL configured for ${options.chainKey} (set ${chainByKey(options.chainKey)?.rpcEnvVar}).`,
      detail: {
        chainKey: options.chainKey,
        chainId: this.viemChain?.id ?? null,
        rpcConfigured: Boolean(this.rpcUrl),
        explorerApiUrl: explorerApiUrl(options.chainKey),
        scanMaxBlocks: this.scanMaxBlocks,
      },
    };
  }

  private ensureClient(): PublicClient {
    if (!this.rpcUrl) {
      throw new AppError("rpc_unavailable", `No RPC configured for ${this.chainKey}`, {
        details: { chainKey: this.chainKey },
      });
    }
    if (!this.client) {
      this.client = createPublicClient({
        chain: this.viemChain,
        transport: http(this.rpcUrl, { timeout: 30_000 }),
      }) as PublicClient;
    }
    return this.client;
  }

  async getSupportedChains(): Promise<ChainDescriptor[]> {
    const chain = chainByKey(this.chainKey);
    return [
      {
        key: this.chainKey,
        chainId: this.viemChain?.id ?? chain?.chainId ?? null,
        name: chain?.name ?? this.chainKey,
        family: "evm",
        rpcConfigured: Boolean(this.rpcUrl),
        attestcoinChainKey: chain?.knownAttestcoinChainKey ?? null,
      },
    ];
  }

  async getWalletActivity(query: WalletActivityQuery): Promise<WalletActivityPage> {
    const address = normalizeAddress(query.walletAddress);
    const explorer = explorerApiUrl(this.chainKey);
    const transactions: RawChainTransaction[] = [];

    if (explorer) {
      const url = `${explorer}/api/v2/addresses/${address}/transactions?filter=to%20%7C%20from`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) {
        throw new AppError("rpc_unavailable", `Explorer API returned ${res.status}`, {
          details: { chainKey: this.chainKey, url },
        });
      }
      const body = (await res.json()) as { items?: Array<Record<string, unknown>> };
      const hashes = (body.items ?? [])
        .map((item) => String(item.hash ?? ""))
        .filter((h) => h.startsWith("0x"))
        .slice(0, query.limit ?? 50);
      for (const hash of hashes) {
        const tx = await this.getTransaction(this.chainKey, hash);
        if (tx) transactions.push(tx);
      }
      return {
        transactions,
        nextCursor: null,
        chainKeys: [this.chainKey],
        fetchedAt: Date.now(),
        source: `blockscout:${this.chainKey}`,
      };
    }

    // Bounded RPC fallback: scan the most recent blocks for this address.
    const client = this.ensureClient();
    const latest = Number(await client.getBlockNumber());
    const from = Math.max(0, latest - this.scanMaxBlocks);
    for (let height = latest; height >= from; height -= 1) {
      const block = await client.getBlock({ blockNumber: BigInt(height), includeTransactions: true });
      for (const raw of block.transactions as unknown as Transaction[]) {
        const fromMatch = normalizeAddress(raw.from) === address;
        const toMatch = raw.to ? normalizeAddress(raw.to) === address : false;
        if (!fromMatch && !toMatch) continue;
        const assembled = await this.assemble(raw.hash, block.number, Number(block.timestamp) * 1000);
        if (assembled) transactions.push(assembled);
      }
      if (transactions.length >= (query.limit ?? 50)) break;
    }
    return {
      transactions,
      nextCursor: null,
      chainKeys: [this.chainKey],
      fetchedAt: Date.now(),
      source: `rpc-scan:${this.chainKey}:partial`,
    };
  }

  async getTransaction(chainKey: string, txHash: string): Promise<RawChainTransaction | null> {
    if (chainKey !== this.chainKey) return null;
    const client = this.ensureClient();
    try {
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      if (!tx.blockNumber) return null;
      const block = await client.getBlock({ blockNumber: tx.blockNumber });
      return await this.assemble(txHash, tx.blockNumber, Number(block.timestamp) * 1000);
    } catch {
      return null;
    }
  }

  private async assemble(
    txHash: string,
    blockNumber: bigint,
    timestampMs: number,
  ): Promise<RawChainTransaction | null> {
    const client = this.ensureClient();
    let tx: Transaction;
    let receipt: TransactionReceipt | null = null;
    try {
      tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch {
      return null;
    }
    const blockHash = receipt?.blockHash ?? null;
    const logs: RawChainLog[] = (receipt?.logs ?? []).map((log: Log) => ({
      logIndex: Number(log.logIndex ?? 0),
      address: normalizeAddress(log.address),
      topics: log.topics.map(String),
      data: String(log.data ?? "0x"),
      decoded: this.decodeLog(log, tx),
    }));

    return {
      chainKey: this.chainKey,
      chainId: this.viemChain?.id ?? null,
      txHash,
      blockHeight: Number(blockNumber),
      blockHash: blockHash ? String(blockHash) : null,
      from: normalizeAddress(tx.from),
      to: tx.to ? normalizeAddress(tx.to) : null,
      valueRaw: (tx.value ?? 0n).toString(),
      data: String(tx.input ?? "0x"),
      status: receipt ? (receipt.status === "success" ? "SUCCESS" : "REVERTED") : "UNKNOWN",
      timestampMs,
      logs,
    };
  }

  /** Decode the standard ERC-20 Transfer event into economic meaning. */
  private decodeLog(log: Log, tx: Transaction) {
    const topics = log.topics.map(String);
    if (topics[0] !== ERC20_TRANSFER_TOPIC || topics.length < 3) return undefined;
    const from = normalizeAddress(`0x${topics[1].slice(26)}`);
    const to = normalizeAddress(`0x${topics[2].slice(26)}`);
    const amountRaw = BigInt(String(log.data ?? "0x0")).toString();
    const contract = normalizeAddress(log.address);
    const symbol = process.env[`ASSET_SYMBOL_${contract.slice(2).toUpperCase()}`] ?? "TOKEN";
    const decimals = intEnv(`ASSET_DECIMALS_${contract.slice(2).toUpperCase()}`, 6);
    const priceUsd = this.prices[symbol] ?? 0;
    const protocol = this.protocols.find((p) => p.address === contract)?.key ?? null;
    return {
      type: (protocol ? "DEPOSIT" : "TRANSFER") as "DEPOSIT" | "TRANSFER",
      asset: symbol,
      assetDecimals: decimals,
      amountRaw,
      priceUsd,
      from,
      to,
      protocol,
      metadata: {
        protocolVersion: protocol,
        priceUsd,
        note: "ERC-20 Transfer decoded from receipt logs",
        sourceSelector: String(tx.input ?? "0x").slice(0, 10),
      },
    };
  }

  async getReceipt(chainKey: string, txHash: string) {
    if (chainKey !== this.chainKey) return null;
    const client = this.ensureClient();
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      return {
        txHash,
        blockHeight: Number(receipt.blockNumber),
        status: (receipt.status === "success" ? "SUCCESS" : "REVERTED") as "SUCCESS" | "REVERTED",
        logs: receipt.logs.map((log: Log) => ({
          logIndex: Number(log.logIndex ?? 0),
          address: normalizeAddress(log.address),
          topics: log.topics.map(String),
          data: String(log.data ?? "0x"),
        })),
      };
    } catch {
      return null;
    }
  }

  async getBlock(chainKey: string, blockHeight: number) {
    if (chainKey !== this.chainKey) return null;
    const client = this.ensureClient();
    try {
      const block = await client.getBlock({ blockNumber: BigInt(blockHeight) });
      return { height: blockHeight, hash: String(block.hash), timestampMs: Number(block.timestamp) * 1000 };
    } catch {
      return null;
    }
  }

  async getTimestamp(chainKey: string, blockHeight: number) {
    const block = await this.getBlock(chainKey, blockHeight);
    return block?.timestampMs ?? null;
  }

  async getLogs(filter: LogFilter): Promise<RawChainLog[]> {
    if (filter.chainKey !== this.chainKey) return [];
    const client = this.ensureClient();
    const logs = await client.getLogs({
      address: filter.address ? (filter.address as `0x${string}`) : undefined,
      fromBlock: filter.fromBlock !== undefined ? BigInt(filter.fromBlock) : undefined,
      toBlock: filter.toBlock !== undefined ? BigInt(filter.toBlock) : undefined,
    });
    return logs.map((log) => ({
      logIndex: Number(log.logIndex ?? 0),
      address: normalizeAddress(log.address),
      topics: log.topics.map(String),
      data: String(log.data ?? "0x"),
    }));
  }

  async getTokenTransfers(query: WalletActivityQuery): Promise<RawChainTransaction[]> {
    const page = await this.getWalletActivity(query);
    return page.transactions.filter((t) => t.logs.some((l) => l.topics[0] === ERC20_TRANSFER_TOPIC));
  }

  async getFundingGraph(
    walletAddress: string,
    chainKeys: string[],
    maxDepth: number,
  ): Promise<FundingGraphHint[]> {
    if (!chainKeys.includes(this.chainKey)) return [];
    const address = normalizeAddress(walletAddress);
    const explorer = explorerApiUrl(this.chainKey);
    if (!explorer) return [];
    // One-hop funder resolution; deeper BFS is bounded by maxDepth and rate limits.
    const hints: FundingGraphHint[] = [];
    let frontier = [address];
    for (let depth = 1; depth <= Math.min(maxDepth, 2); depth += 1) {
      const next: string[] = [];
      for (const current of frontier) {
        try {
          const res = await fetch(`${explorer}/api/v2/addresses/${current}/transactions?filter=from`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) continue;
          const body = (await res.json()) as { items?: Array<Record<string, unknown>> };
          for (const item of body.items ?? []) {
            const from = item.from && typeof item.from === "object" ? String((item.from as Record<string, unknown>).hash ?? "") : "";
            const to = item.to && typeof item.to === "object" ? String((item.to as Record<string, unknown>).hash ?? "") : "";
            if (normalizeAddress(to) !== current || !from) continue;
            hints.push({ address: normalizeAddress(from), cluster: normalizeAddress(from), fundedBy: current, depth });
            if (depth < maxDepth) next.push(normalizeAddress(from));
          }
        } catch {
          // Network problems degrade the graph rather than failing the evaluation.
        }
      }
      frontier = [...new Set(next)];
      if (frontier.length === 0) break;
    }
    return hints;
  }
}
