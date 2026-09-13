/**
 * Attestcoin (USC) attestation provider — LIVE.
 *
 * Built against the official `@gluwa/usc-sdk` (v0.18) API surface, verified from
 * the published type declarations rather than guessed:
 *
 *   chainInfo.PrecompileChainInfoProvider(rpc)   -> ChainInfo precompile 0x..0FD3
 *   proofProvider.service.ProofBuilder(chainKey, proverUrl)
 *       .waitUntilHeightAttested / .getProof(txHash) -> ContinuityResponse
 *   blockProver.PrecompileBlockProver(rpc)        -> BlockProver precompile 0x..0FD2
 *       .verifySingle(chainKey, headerNumber, txBytes, merkleProof, continuityProof)
 *       .computeTransactionIndex(merkleProof)
 *
 * A ContinuityResponse carries { chainKey, headerNumber, txIndex, txHash,
 * txBytes, merkleProof{root,siblings[{hash,isLeft}]}, continuityProof{
 * lowerEndpointDigest, roots[]}, cached, generatedAt } — all of which BASIS
 * persists so an event can be re-verified independently of this service.
 *
 * Trust boundary: verification happens HERE, server-side. The browser is never
 * able to assert that a transaction is verified.
 *
 * Scope note recorded on every attestation: the BlockProver proves *inclusion*
 * of a transaction in a genuinely attested source-chain block. It does not prove
 * the transaction succeeded and it does not prove which contract emitted the
 * logs. BASIS checks receipt status and contract identity separately.
 */
import { JsonRpcProvider } from "ethers";
import { AppError } from "@/lib/errors";
import { sha256Hex } from "@/lib/deterministic";
import { attestcoinConfig, chainByKey } from "@/lib/config";
import type {
  AttestationProvider,
  AttestationRequest,
  AttestationVerification,
  ProviderDescriptor,
} from "@/providers/types";

const TRUST_SCOPE =
  "BlockProver proves inclusion of the transaction in an attested source-chain block. Receipt success and emitting-contract identity are verified separately by BASIS.";

interface ContinuityResponseShape {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: string;
  txBytes: string;
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
  merkleProof: { root: string; siblings: { hash: string; isLeft: boolean }[] };
  cached: boolean;
  generatedAt: Date;
}

interface SdkShape {
  chainInfo: {
    PrecompileChainInfoProvider: new (rpc: unknown, address?: string) => {
      getSupportedChains(): Promise<{ chainKey: number; chainId: number; chainName: string }[]>;
      getSupportedChainByKey(chainKey: number): Promise<unknown | null>;
      getLatestAttestedHeightAndHash(chainKey: number): Promise<{ height: number; hash: string; exists: boolean }>;
      waitUntilHeightAttested(
        chainKey: number,
        height: number,
        pollIntervalMs?: number,
        waitTimeoutMs?: number,
      ): Promise<void>;
    };
  };
  blockProver: {
    PrecompileBlockProver: new (rpc: unknown, address?: string) => {
      verifySingle(
        chainKey: number,
        height: number,
        encodedTransaction: string,
        merkleProof: unknown,
        continuityProof: unknown,
      ): Promise<boolean>;
      computeTransactionIndex(merkleProof: unknown): Promise<number>;
    };
  };
  proofProvider: {
    service: {
      ProofBuilder: new (chainKey: number, url: string, timeout?: number) => {
        getProof(txHash: string): Promise<{ success: boolean; data?: ContinuityResponseShape; error?: string }>;
      };
    };
  };
}

let sdkPromise: Promise<SdkShape> | null = null;

/** Dynamically imported so demo mode never loads ethers/the USC SDK. */
function loadSdk(): Promise<SdkShape> {
  if (!sdkPromise) {
    sdkPromise = import("@gluwa/usc-sdk").then((mod) => mod as unknown as SdkShape);
  }
  return sdkPromise;
}

export class AttestcoinProvider implements AttestationProvider {
  readonly descriptor: ProviderDescriptor;
  private rpc: JsonRpcProvider | null = null;
  private chainKeyCache = new Map<number, { chainKey: number; chainId: number; chainName: string }>();

  constructor() {
    const configured = Boolean(attestcoinConfig.rpcUrl) && Boolean(attestcoinConfig.proverUrl);
    this.descriptor = {
      id: "attestcoin",
      mode: "live",
      kind: "attestation",
      available: configured,
      notes: configured
        ? "Live Attestcoin/USC verification via the BlockProver (0x..0FD2) and ChainInfo (0x..0FD3) precompiles on Creditcoin."
        : "ATTESTCOIN_RPC_URL / ATTESTCOIN_PROVER_URL not configured.",
      detail: {
        sdk: "@gluwa/usc-sdk",
        rpcUrl: attestcoinConfig.rpcUrl,
        proverUrl: attestcoinConfig.proverUrl,
        blockProver: attestcoinConfig.blockProverAddress,
        chainInfo: attestcoinConfig.chainInfoAddress,
        attestationTimeoutMs: attestcoinConfig.attestationTimeoutMs,
        trustScope: TRUST_SCOPE,
      },
    };
  }

  private ensureRpc(): JsonRpcProvider {
    if (!attestcoinConfig.rpcUrl) {
      throw new AppError("attestation_unavailable", "ATTESTCOIN_RPC_URL is not configured.");
    }
    if (!this.rpc) this.rpc = new JsonRpcProvider(attestcoinConfig.rpcUrl);
    return this.rpc;
  }

  /** Resolve the USC chain key for a BASIS chain, preferring the on-chain registry. */
  async resolveChainKey(chainKey: string, chainId: number | null): Promise<number | null> {
    const known = chainByKey(chainKey)?.knownAttestcoinChainKey;
    if (known !== null && known !== undefined) return known;
    if (chainId === null) return null;
    try {
      const sdk = await loadSdk();
      const info = new sdk.chainInfo.PrecompileChainInfoProvider(
        this.ensureRpc(),
        attestcoinConfig.chainInfoAddress,
      );
      if (this.chainKeyCache.size === 0) {
        for (const entry of await info.getSupportedChains()) this.chainKeyCache.set(entry.chainId, entry);
      }
      return this.chainKeyCache.get(chainId)?.chainKey ?? null;
    } catch {
      return null;
    }
  }

  async getSupportedChains() {
    const sdk = await loadSdk();
    const info = new sdk.chainInfo.PrecompileChainInfoProvider(this.ensureRpc(), attestcoinConfig.chainInfoAddress);
    return info.getSupportedChains();
  }

  async verifyEvent(request: AttestationRequest): Promise<AttestationVerification> {
    const results = await this.verifyOrdering([request]);
    return results[0];
  }

  /**
   * Batch verification. Each transaction gets its own Merkle proof; the
   * continuity proof of the highest block covers the batch, which is how the
   * SDK's `verifyBatch` path works.
   */
  async verifyOrdering(requests: AttestationRequest[]): Promise<AttestationVerification[]> {
    if (requests.length === 0) return [];
    const id = sha256Hex(`attestcoin|${requests.map((r) => r.txHash).join("|")}`).slice(0, 32);
    const out: AttestationVerification[] = [];

    let sdk: SdkShape;
    try {
      sdk = await loadSdk();
    } catch (err) {
      return requests.map((r) => this.failure(r, id, "usc_sdk_unavailable", err));
    }

    const rpc = this.ensureRpc();
    const chainInfoProvider = new sdk.chainInfo.PrecompileChainInfoProvider(rpc, attestcoinConfig.chainInfoAddress);
    const prover = new sdk.blockProver.PrecompileBlockProver(rpc, attestcoinConfig.blockProverAddress);

    for (const request of requests) {
      const attestationId = `atc_${sha256Hex(`attestcoin|${request.chainKey}|${request.txHash}`).slice(0, 32)}`;
      try {
        const uscChainKey = await this.resolveChainKey(request.chainKey, chainByKey(request.chainKey)?.chainId ?? null);
        if (uscChainKey === null) {
          out.push(this.failure(request, attestationId, "chain_not_attested_by_usc", null));
          continue;
        }
        const proofBuilder = new sdk.proofProvider.service.ProofBuilder(
          uscChainKey,
          attestcoinConfig.proverUrl,
          attestcoinConfig.requestTimeoutMs,
        );

        if (request.waitForAttestation !== false) {
          await chainInfoProvider.waitUntilHeightAttested(
            uscChainKey,
            request.blockHeight,
            attestcoinConfig.attestationPollMs,
            attestcoinConfig.attestationTimeoutMs,
          );
        }

        const proofResult = await proofBuilder.getProof(request.txHash);
        if (!proofResult.success || !proofResult.data) {
          out.push(this.failure(request, attestationId, proofResult.error ?? "proof_generation_failed", null));
          continue;
        }
        const data = proofResult.data;

        // The actual on-chain check, server-side, through the precompile.
        const verified = await prover.verifySingle(
          data.chainKey,
          data.headerNumber,
          data.txBytes,
          data.merkleProof,
          data.continuityProof,
        );
        let txIndex: number | null = data.txIndex ?? null;
        try {
          txIndex = await prover.computeTransactionIndex(data.merkleProof);
        } catch {
          /* txIndex is informational; keep the value from the proof response */
        }

        out.push({
          id: attestationId,
          provider: "attestcoin",
          chainKey: request.chainKey,
          attestcoinChainKey: data.chainKey,
          sourceTxHash: request.txHash,
          blockHeight: data.headerNumber,
          txIndex,
          verified,
          status: verified ? "VERIFIED" : "FAILED",
          txBytes: data.txBytes,
          merkleRoot: data.merkleProof.root,
          merkleSiblings: data.merkleProof.siblings.length,
          continuityLowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
          continuityRoots: data.continuityProof.roots.length,
          verifier: attestcoinConfig.blockProverAddress,
          verifiedAt: verified ? Date.now() : null,
          error: verified ? null : "BlockProver.verifySingle returned false",
          proofReference: `usc://${data.chainKey}/${data.headerNumber}/${txIndex ?? 0}`,
          metadata: {
            cached: data.cached,
            generatedAt: data.generatedAt instanceof Date ? data.generatedAt.toISOString() : String(data.generatedAt),
            chainInfoPrecompile: attestcoinConfig.chainInfoAddress,
            proverUrl: attestcoinConfig.proverUrl,
            siblings: data.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
            continuityRoots: data.continuityProof.roots,
            trustScope: TRUST_SCOPE,
          },
        });
      } catch (err) {
        out.push(this.failure(request, attestationId, (err as Error)?.message ?? "verification_error", err));
      }
    }
    return out;
  }

  async getVerification(chainKey: string, txHash: string): Promise<AttestationVerification | null> {
    // The USC proof service is stateless per transaction; re-deriving the proof
    // is the canonical way to look one up again.
    try {
      return await this.verifyEvent({ chainKey, txHash, blockHeight: 0, walletAddress: "", waitForAttestation: false });
    } catch {
      return null;
    }
  }

  private failure(
    request: AttestationRequest,
    id: string,
    reason: string,
    cause: unknown,
  ): AttestationVerification {
    const pending = /attest/i.test(reason) || /not.*cached|timeout/i.test(reason);
    return {
      id: id.startsWith("atc_") ? id : `atc_${id}`,
      provider: "attestcoin",
      chainKey: request.chainKey,
      attestcoinChainKey: chainByKey(request.chainKey)?.knownAttestcoinChainKey ?? null,
      sourceTxHash: request.txHash,
      blockHeight: request.blockHeight,
      txIndex: null,
      verified: false,
      status: pending ? "AWAITING_ATTESTATION" : "FAILED",
      txBytes: null,
      merkleRoot: null,
      merkleSiblings: 0,
      continuityLowerEndpointDigest: null,
      continuityRoots: 0,
      verifier: attestcoinConfig.blockProverAddress,
      verifiedAt: null,
      error: reason,
      proofReference: null,
      metadata: { cause: cause instanceof Error ? cause.message : null, trustScope: TRUST_SCOPE },
    };
  }
}
