/**
 * Demo providers.
 *
 * These are DATA providers, not fake functionality. They sit behind exactly the
 * same interfaces as the live adapters, so the normalizer, evidence engine,
 * credit engine, guardrails, job pipeline and API routes are identical in demo
 * and live mode. Only the bytes at the edge are different — and they are fixed
 * constants, never `Math.random()`.
 */
import { hmacSha256Hex, safeEqual, sha256Hex, deterministicHex } from "@/lib/deterministic";
import { attestcoinConfig, demoChainKeys, chainByKey, IS_LIVE } from "@/lib/config";
import { AppError } from "@/lib/errors";
import type {
  AttestationProvider,
  AttestationRequest,
  AttestationVerification,
  ChainDataProvider,
  ChainDescriptor,
  CreditContext,
  CreditProvider,
  FundingGraphHint,
  LogFilter,
  ProviderDescriptor,
  RawChainLog,
  RawChainTransaction,
  SettlementResult,
  SignatureVerificationRequest,
  SignatureVerificationResult,
  SignatureVerifier,
  WalletActivityPage,
  WalletActivityQuery,
} from "@/providers/types";
import {
  DEMO_SCENARIOS,
  demoRawTransactions,
  resolveDemoWallet,
  farmWalletAddress,
  DEMO_SCENARIO_KEYS,
  FARM_SCENARIO_KEYS,
  FARM_SCENARIO_MAP,
  type DemoScenarioKey,
} from "./fixtures";

const ALL_DEMO_TXS = new Map<string, { scenarioKey: DemoScenarioKey; index: number; salt: string; tx: RawChainTransaction }>();
for (const key of DEMO_SCENARIO_KEYS) {
  demoRawTransactions(key).forEach((tx, index) => ALL_DEMO_TXS.set(tx.txHash, { scenarioKey: key, index, salt: "", tx }));
}
// Farm Test sandbox wallets reuse the same fixtures but with distinct chain data.
for (const farmKey of FARM_SCENARIO_KEYS) {
  const fixtureKey = FARM_SCENARIO_MAP[farmKey];
  demoRawTransactions(fixtureKey, `farm:${farmKey}`, farmWalletAddress(farmKey)).forEach((tx, index) =>
    ALL_DEMO_TXS.set(tx.txHash, { scenarioKey: fixtureKey, index, salt: `farm:${farmKey}`, tx }),
  );
}

function descriptorFor(
  id: string,
  kind: ProviderDescriptor["kind"],
  notes: string,
  detail: Record<string, unknown> = {},
): ProviderDescriptor {
  return { id, mode: "demo", kind, available: true, notes, detail };
}

/* -------------------------------------------------------------------------- */
/* Chain data                                                                 */
/* -------------------------------------------------------------------------- */

export class DemoChainDataProvider implements ChainDataProvider {
  readonly descriptor = descriptorFor(
    "demo-chain-data",
    "chain-data",
    "Deterministic seeded chain data. No RPC calls, no network access, no randomness.",
    { scenarios: DEMO_SCENARIO_KEYS, chains: demoChainKeys },
  );

  async getSupportedChains(): Promise<ChainDescriptor[]> {
    return demoChainKeys.map((key) => {
      const chain = chainByKey(key);
      return {
        key,
        chainId: chain?.chainId ?? null,
        name: chain?.name ?? key,
        family: chain?.family ?? "evm",
        rpcConfigured: true,
        attestcoinChainKey: chain?.knownAttestcoinChainKey ?? null,
      };
    });
  }

  async getWalletActivity(query: WalletActivityQuery): Promise<WalletActivityPage> {
    const resolved = resolveDemoWallet(query.walletAddress);
    if (!resolved) {
      // An unknown demo wallet is an empty wallet — never invent activity.
      return { transactions: [], nextCursor: null, chainKeys: query.chainKeys, fetchedAt: Date.now(), source: this.descriptor.id };
    }
    let txs = demoRawTransactions(resolved.fixture.key, resolved.salt, query.walletAddress);
    if (query.chainKeys.length > 0) txs = txs.filter((t) => query.chainKeys.includes(t.chainKey));
    if (query.fromMs) txs = txs.filter((t) => t.timestampMs >= query.fromMs!);
    if (query.toMs) txs = txs.filter((t) => t.timestampMs <= query.toMs!);
    const limit = query.limit ?? txs.length;
    return {
      transactions: txs.slice(0, limit),
      nextCursor: null,
      chainKeys: [...new Set(txs.map((t) => t.chainKey))],
      fetchedAt: Date.now(),
      source: this.descriptor.id,
    };
  }

  async getTransaction(chainKey: string, txHash: string): Promise<RawChainTransaction | null> {
    const found = ALL_DEMO_TXS.get(txHash.toLowerCase()) ?? ALL_DEMO_TXS.get(txHash);
    return found && found.tx.chainKey === chainKey ? found.tx : (found?.tx ?? null);
  }

  async getReceipt(chainKey: string, txHash: string) {
    const tx = await this.getTransaction(chainKey, txHash);
    if (!tx) return null;
    return { txHash: tx.txHash, blockHeight: tx.blockHeight, status: tx.status, logs: tx.logs };
  }

  async getBlock(chainKey: string, blockHeight: number) {
    for (const tx of ALL_DEMO_TXS.values()) {
      if (tx.tx.chainKey === chainKey && tx.tx.blockHeight === blockHeight) {
        return { height: blockHeight, hash: tx.tx.blockHash ?? deterministicHex(`block:${blockHeight}`, 32), timestampMs: tx.tx.timestampMs };
      }
    }
    return null;
  }

  async getTimestamp(chainKey: string, blockHeight: number) {
    const block = await this.getBlock(chainKey, blockHeight);
    return block?.timestampMs ?? null;
  }

  async getLogs(filter: LogFilter): Promise<RawChainLog[]> {
    const out: RawChainLog[] = [];
    for (const { tx } of ALL_DEMO_TXS.values()) {
      if (tx.chainKey !== filter.chainKey) continue;
      if (filter.fromBlock && tx.blockHeight < filter.fromBlock) continue;
      if (filter.toBlock && tx.blockHeight > filter.toBlock) continue;
      for (const log of tx.logs) {
        if (filter.address && log.address.toLowerCase() !== filter.address.toLowerCase()) continue;
        out.push(log);
      }
    }
    return out;
  }

  async getTokenTransfers(query: WalletActivityQuery) {
    const page = await this.getWalletActivity(query);
    return page.transactions.filter((t) => t.logs.some((l) => l.decoded));
  }

  async getFundingGraph(walletAddress: string, _chainKeys: string[], _maxDepth: number): Promise<FundingGraphHint[]> {
    const resolved = resolveDemoWallet(walletAddress);
    if (!resolved) return [];
    const hints = new Map<string, FundingGraphHint>();
    for (const tx of demoRawTransactions(resolved.fixture.key, resolved.salt, walletAddress)) {
      const decoded = tx.logs[0]?.decoded;
      if (!decoded?.metadata?.fundingSource) continue;
      const address = String(decoded.metadata.fundingSource).toLowerCase();
      if (!hints.has(address)) {
        hints.set(address, {
          address,
          cluster: String(decoded.metadata.fundingSourceCluster ?? address),
          fundedBy: null,
          depth: Number(decoded.metadata.fundingDepth ?? 1),
        });
      }
    }
    return [...hints.values()];
  }
}

/* -------------------------------------------------------------------------- */
/* Attestation (simulated Attestcoin)                                         */
/* -------------------------------------------------------------------------- */

export class DemoAttestationProvider implements AttestationProvider {
  readonly descriptor = descriptorFor(
    "demo-attestation",
    "attestation",
    "Deterministic seeded Attestcoin verification objects. Proof fields are synthetic; the shape matches the real USC ContinuityResponse.",
    {
      mirrorsRealFields: [
        "chainKey",
        "headerNumber",
        "txBytes",
        "merkleProof",
        "continuityProof",
      ],
      blockProverPrecompile: attestcoinConfig.blockProverAddress,
      chainInfoPrecompile: attestcoinConfig.chainInfoAddress,
    },
  );

  async verifyEvent(request: AttestationRequest): Promise<AttestationVerification> {
    return this.build(request);
  }

  async verifyOrdering(requests: AttestationRequest[]): Promise<AttestationVerification[]> {
    // A batch shares one continuity proof, exactly like the real `verifyBatch`
    // path where `mergeProofs` produces a single shared proof.
    const sharedDigest = deterministicHex(
      `continuity:${requests.map((r) => r.txHash).sort().join("|")}`,
      32,
    );
    return requests.map((r) => ({ ...this.build(r), continuityLowerEndpointDigest: sharedDigest }));
  }

  async getVerification(chainKey: string, txHash: string): Promise<AttestationVerification | null> {
    const found = ALL_DEMO_TXS.get(txHash);
    if (!found || found.tx.chainKey !== chainKey) return null;
    return this.build({
      chainKey,
      txHash,
      blockHeight: found.tx.blockHeight,
      walletAddress: DEMO_SCENARIOS[found.scenarioKey].wallet.address,
    });
  }

  async getSupportedChains() {
    // Mirrors the ChainInfo precompile registry shape.
    return [
      { chainKey: 1, chainId: 11155111, chainName: "Ethereum Sepolia" },
      { chainKey: 2, chainId: 84532, chainName: "Base Sepolia" },
    ];
  }

  private build(request: AttestationRequest): AttestationVerification {
    const found = ALL_DEMO_TXS.get(request.txHash);
    const scenarioKey = found?.scenarioKey;
    const fixture = scenarioKey ? DEMO_SCENARIOS[scenarioKey] : null;
    const detail = fixture?.proofDetail ?? "standard";
    const pending = Boolean(
      scenarioKey && found && fixture?.events.some((d, i) => i === found.index && d.verified === false),
    );

    const id = `atc_${sha256Hex(`demo|${request.chainKey}|${request.txHash}`).slice(0, 32)}`;
    const seed = `${request.chainKey}:${request.txHash}:${request.blockHeight}`;

    if (pending) {
      return {
        id,
        provider: "demo",
        chainKey: request.chainKey,
        attestcoinChainKey: chainByKey(request.chainKey)?.knownAttestcoinChainKey ?? null,
        sourceTxHash: request.txHash,
        blockHeight: request.blockHeight,
        txIndex: null,
        verified: false,
        status: "AWAITING_ATTESTATION",
        txBytes: null,
        merkleRoot: null,
        merkleSiblings: 0,
        continuityLowerEndpointDigest: null,
        continuityRoots: 0,
        verifier: attestcoinConfig.blockProverAddress,
        verifiedAt: null,
        error: `Block ${request.blockHeight} has not been attested on Creditcoin yet.`,
        proofReference: null,
        metadata: {
          mode: "demo",
          reason: "awaiting_attestors",
          proverUrl: attestcoinConfig.proverUrl,
          note: "The attestors reach consensus periodically; the job stays in VERIFYING until they do.",
        },
      };
    }

    const txIndex = Number(`0x${deterministicHex(`txindex:${seed}`, 1).slice(2, 4)}`) % 12;
    const siblings = detail === "technical" ? 9 : detail === "standard" ? 5 : 0;

    return {
      id,
      provider: "demo",
      chainKey: request.chainKey,
      attestcoinChainKey: chainByKey(request.chainKey)?.knownAttestcoinChainKey ?? null,
      sourceTxHash: request.txHash,
      blockHeight: request.blockHeight,
      txIndex,
      verified: true,
      status: "VERIFIED",
      txBytes: detail === "minimal" ? null : deterministicHex(`txbytes:${seed}`, detail === "technical" ? 148 : 42),
      merkleRoot: detail === "minimal" ? null : deterministicHex(`merkleroot:${seed}`, 32),
      merkleSiblings: siblings,
      continuityLowerEndpointDigest: deterministicHex(`continuity:${seed}`, 32),
      continuityRoots: detail === "technical" ? 6 : detail === "standard" ? 3 : 0,
      verifier: attestcoinConfig.blockProverAddress,
      verifiedAt: request.blockHeight,
      error: null,
      proofReference: `usc://demo/${request.chainKey}/${request.blockHeight}/${txIndex}`,
      metadata: {
        mode: "demo",
        chainInfoPrecompile: attestcoinConfig.chainInfoAddress,
        blockProverPrecompile: attestcoinConfig.blockProverAddress,
        proverUrl: attestcoinConfig.proverUrl,
        headerNumber: request.blockHeight,
        proofDetail: detail,
        scope:
          "The BlockProver proves inclusion of a transaction in a genuinely attested source-chain block. It does not prove the transaction succeeded, nor which contract emitted its logs — BASIS checks those separately.",
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Credit settlement (simulated rail)                                         */
/* -------------------------------------------------------------------------- */

export class DemoCreditProvider implements CreditProvider {
  readonly descriptor = descriptorFor(
    "demo-credit",
    "credit",
    "Simulated settlement rail. Credit state is written to the BASIS ledger (Postgres) and mirrored into a deterministic simulated settlement record. No chain transaction is submitted.",
    { rail: "creditcoin-cc3-testnet (simulated)", chainId: 102031 },
  );

  async getAccount(context: CreditContext) {
    const wallet = Object.values(DEMO_SCENARIOS).find((f) => `wal_demo_${f.key}` === context.walletId);
    if (!wallet) return null;
    return {
      creditLimitUsdCents: wallet.startingCreditLimitUsdCents,
      borrowedUsdCents: wallet.startingBorrowedUsdCents,
      onchain: false,
      reference: null,
    };
  }

  async getCreditLimit(context: CreditContext) {
    const account = await this.getAccount(context);
    return account?.creditLimitUsdCents ?? 0;
  }

  async updateCreditLimit(
    context: CreditContext,
    input: { newLimitUsdCents: number; decisionId: string; evidenceHash: string },
  ): Promise<SettlementResult> {
    return this.settle("credit-limit-update", context, {
      newLimitUsdCents: input.newLimitUsdCents,
      decisionId: input.decisionId,
      evidenceHash: input.evidenceHash,
    });
  }

  async borrow(
    context: CreditContext,
    input: { amountUsdCents: number; positionId: string; transactionId: string },
  ): Promise<SettlementResult> {
    return this.settle("draw", context, input);
  }

  async repay(
    context: CreditContext,
    input: { amountUsdCents: number; repaymentId: string; transactionId: string; positionId?: string | null },
  ): Promise<SettlementResult> {
    return this.settle("repayment", context, input);
  }

  private settle(
    action: string,
    context: CreditContext,
    payload: Record<string, unknown>,
  ): SettlementResult {
    const reference = `demo:cc3:${sha256Hex(`${action}|${context.accountId}|${JSON.stringify(payload)}`).slice(0, 24)}`;
    return {
      settled: true,
      reference,
      provider: this.descriptor.id,
      chainKey: "creditcoin-testnet",
      detail: {
        action,
        simulated: true,
        payload,
        note: "Demo mode records the settlement locally. Set APP_MODE=live with CREDITCOIN_LEDGER_ADDRESS to settle on Creditcoin CC3 testnet.",
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Signature verification (simulated wallet)                                  */
/* -------------------------------------------------------------------------- */

const DEMO_SIGNER_DOMAIN = "basis-demo-signer-v1";

export class DemoSignatureVerifier implements SignatureVerifier {
  readonly descriptor = descriptorFor(
    "demo-signer",
    "signer",
    "Deterministic HMAC signer for simulated demo wallets. Runs the same verification code path as EIP-191; disabled in live mode.",
    { algorithm: "HMAC-SHA256" },
  );

  async verify(request: SignatureVerificationRequest): Promise<SignatureVerificationResult> {
    const expected = demoSignatureFor(request.address, request.message);
    const valid = safeEqual(expected, request.signature.trim().toLowerCase());
    return {
      valid,
      recoveredAddress: valid ? request.address.toLowerCase() : null,
      signerType: "demo-hmac",
      reason: valid ? undefined : "Signature does not match the demo signer for this address.",
    };
  }

  async signDemo(input: { address: string; message: string }) {
    if (IS_LIVE) {
      throw new AppError("live_mode_only", "Demo signing is disabled when APP_MODE=live.");
    }
    return { signature: demoSignatureFor(input.address, input.message), signerType: "demo-hmac" };
  }
}

export function demoSignatureFor(address: string, message: string): string {
  const secret = hmacSha256Hex(DEMO_SIGNER_DOMAIN, address.trim().toLowerCase());
  return `0x${hmacSha256Hex(secret, message)}`;
}
