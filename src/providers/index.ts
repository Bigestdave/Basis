/**
 * Provider registry / dependency injection.
 *
 * This is the ONLY place in BASIS that branches on APP_MODE. Everything above it
 * — normalizer, evidence engine, credit engine, guardrails, job pipeline, API
 * routes — depends on interfaces and is identical in demo and live mode.
 */
import type { AppMode } from "@/lib/config";
import { APP_MODE, CHAINS, chainByKey } from "@/lib/config";
import { AppError } from "@/lib/errors";
import type {
  AttestationProvider,
  ChainDataProvider,
  ChainDescriptor,
  CreditProvider,
  FundingGraphHint,
  LogFilter,
  ProviderDescriptor,
  RawChainLog,
  RawChainTransaction,
  SignatureVerifier,
  WalletActivityPage,
  WalletActivityQuery,
} from "@/providers/types";
import {
  DemoAttestationProvider,
  DemoChainDataProvider,
  DemoCreditProvider,
  DemoSignatureVerifier,
} from "./demo";

export interface ProviderBundle {
  mode: AppMode;
  chainData: ChainDataProvider;
  attestation: AttestationProvider;
  credit: CreditProvider;
  signer: SignatureVerifier;
}

/* -------------------------------------------------------------------------- */
/* Live composite chain-data provider                                         */
/* -------------------------------------------------------------------------- */

/**
 * Routes by `chainKey` to a per-chain adapter. Adding a chain means registering
 * one more adapter here — no product code changes.
 */
class CompositeChainDataProvider implements ChainDataProvider {
  readonly descriptor: ProviderDescriptor;
  private adapters = new Map<string, ChainDataProvider>();
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.descriptor = {
      id: "composite-chain-data",
      mode: "live",
      kind: "chain-data",
      available: true,
      notes: "Routes to per-chain adapters (EVM today; Solana/others plug in the same way).",
      detail: { chains: CHAINS.map((c) => c.key) },
    };
  }

  private async ensure(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const { EvmChainDataProvider } = await import("./live/evm-chain");
      for (const chain of CHAINS) {
        if (chain.family !== "evm") continue;
        this.adapters.set(chain.key, new EvmChainDataProvider({ chainKey: chain.key }));
      }
    })();
    return this.initPromise;
  }

  private async adapter(chainKey: string): Promise<ChainDataProvider> {
    await this.ensure();
    const adapter = this.adapters.get(chainKey);
    if (!adapter) {
      throw new AppError("chain_unsupported", `No chain adapter registered for "${chainKey}".`, {
        details: { chainKey, registered: [...this.adapters.keys()] },
      });
    }
    return adapter;
  }

  async getSupportedChains(): Promise<ChainDescriptor[]> {
    await this.ensure();
    return CHAINS.map((chain) => ({
      key: chain.key,
      chainId: chain.chainId,
      name: chain.name,
      family: chain.family,
      rpcConfigured: Boolean(process.env[chain.rpcEnvVar]),
      attestcoinChainKey: chain.knownAttestcoinChainKey,
    }));
  }

  async getWalletActivity(query: WalletActivityQuery): Promise<WalletActivityPage> {
    await this.ensure();
    const chainKeys = query.chainKeys.length > 0 ? query.chainKeys : [...this.adapters.keys()];
    const transactions: RawChainTransaction[] = [];
    const sources: string[] = [];
    for (const key of chainKeys) {
      const adapter = this.adapters.get(key);
      if (!adapter?.descriptor.available) continue;
      try {
        const page = await adapter.getWalletActivity({ ...query, chainKeys: [key] });
        transactions.push(...page.transactions);
        sources.push(page.source);
      } catch (err) {
        // A single unreachable chain must not fail the whole sync.
        sources.push(`error:${key}:${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    transactions.sort((a, b) => a.timestampMs - b.timestampMs);
    return {
      transactions,
      nextCursor: null,
      chainKeys,
      fetchedAt: Date.now(),
      source: sources.join(","),
    };
  }

  async getTransaction(chainKey: string, txHash: string) {
    return (await this.adapter(chainKey)).getTransaction(chainKey, txHash);
  }
  async getReceipt(chainKey: string, txHash: string) {
    return (await this.adapter(chainKey)).getReceipt(chainKey, txHash);
  }
  async getBlock(chainKey: string, blockHeight: number) {
    return (await this.adapter(chainKey)).getBlock(chainKey, blockHeight);
  }
  async getTimestamp(chainKey: string, blockHeight: number) {
    return (await this.adapter(chainKey)).getTimestamp(chainKey, blockHeight);
  }
  async getLogs(filter: LogFilter): Promise<RawChainLog[]> {
    return (await this.adapter(filter.chainKey)).getLogs(filter);
  }
  async getTokenTransfers(query: WalletActivityQuery) {
    await this.ensure();
    const out: RawChainTransaction[] = [];
    for (const key of query.chainKeys.length > 0 ? query.chainKeys : [...this.adapters.keys()]) {
      const adapter = this.adapters.get(key);
      if (!adapter?.descriptor.available) continue;
      try {
        out.push(...(await adapter.getTokenTransfers({ ...query, chainKeys: [key] })));
      } catch {
        /* degrade gracefully */
      }
    }
    return out;
  }
  async getFundingGraph(
    walletAddress: string,
    chainKeys: string[],
    maxDepth: number,
  ): Promise<FundingGraphHint[]> {
    await this.ensure();
    const out: FundingGraphHint[] = [];
    for (const key of chainKeys) {
      const adapter = this.adapters.get(key);
      if (!adapter?.descriptor.available) continue;
      try {
        out.push(...(await adapter.getFundingGraph(walletAddress, [key], maxDepth)));
      } catch {
        /* degrade gracefully */
      }
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/* Bundle construction                                                        */
/* -------------------------------------------------------------------------- */

const bundles = new Map<AppMode, ProviderBundle>();

async function buildBundle(mode: AppMode): Promise<ProviderBundle> {
  if (mode === "demo") {
    return {
      mode,
      chainData: new DemoChainDataProvider(),
      attestation: new DemoAttestationProvider(),
      credit: new DemoCreditProvider(),
      signer: new DemoSignatureVerifier(),
    };
  }
  const [{ AttestcoinProvider }, { CreditcoinProvider }, { EvmSignatureVerifier }] = await Promise.all([
    import("./live/attestcoin"),
    import("./live/creditcoin"),
    import("./live/evm-signer"),
  ]);
  return {
    mode,
    chainData: new CompositeChainDataProvider(),
    attestation: new AttestcoinProvider(),
    credit: new CreditcoinProvider(),
    signer: new EvmSignatureVerifier(),
  };
}

export async function getProviders(mode: AppMode = APP_MODE): Promise<ProviderBundle> {
  const existing = bundles.get(mode);
  if (existing) return existing;
  const bundle = await buildBundle(mode);
  bundles.set(mode, bundle);
  return bundle;
}

/** Per-account mode override (demo accounts inside a live deployment, or vice versa). */
export async function getProvidersForWallet(isDemoWallet: boolean): Promise<ProviderBundle> {
  return getProviders(isDemoWallet ? "demo" : APP_MODE);
}

export async function describeProviders(mode: AppMode = APP_MODE) {
  const bundle = await getProviders(mode);
  return {
    appMode: bundle.mode,
    chainData: bundle.chainData.descriptor,
    attestation: bundle.attestation.descriptor,
    credit: bundle.credit.descriptor,
    signer: bundle.signer.descriptor,
    chains: CHAINS.map((chain) => ({
      key: chain.key,
      name: chain.name,
      chainId: chain.chainId,
      family: chain.family,
      rpcEnvVar: chain.rpcEnvVar,
      rpcConfigured: Boolean(process.env[chain.rpcEnvVar]),
      knownAttestcoinChainKey: chain.knownAttestcoinChainKey,
      explorerTx: chain.blockExplorerTx ? chain.blockExplorerTx("{txHash}") : null,
    })),
  };
}

export { chainByKey };

/**
 * Signature verification is offline crypto (EIP-191 recovery), so a real wallet
 * can authenticate even while the rest of the app runs in demo mode. Demo
 * scenario wallets use the deterministic demo signer.
 */
export async function getSignerForAddress(address: string): Promise<SignatureVerifier> {
  const { demoScenarioForAddress } = await import("./demo/fixtures");
  if (demoScenarioForAddress(address)) {
    return (await getProviders("demo")).signer;
  }
  if (APP_MODE === "demo") {
    const { EvmSignatureVerifier } = await import("./live/evm-signer");
    return new EvmSignatureVerifier();
  }
  return (await getProviders("live")).signer;
}
