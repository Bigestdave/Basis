/**
 * Live signature verification (EVM).
 *
 * EIP-191 `personal_sign` recovery first; if the recovered address does not
 * match, fall back to ERC-1271 `isValidSignature` so smart-contract wallets and
 * safe-style accounts can authenticate too.
 *
 * The server never sees, stores or requests a private key or seed phrase.
 * Signing happens in the user's wallet; only the signature crosses the wire.
 */
import { createPublicClient, hashMessage, http, isAddress, recoverMessageAddress, type Hex } from "viem";
import { AppError } from "@/lib/errors";
import { normalizeAddress } from "@/lib/deterministic";
import { chainByKey, chainRpcUrl } from "@/lib/config";
import type {
  ProviderDescriptor,
  SignatureVerificationRequest,
  SignatureVerificationResult,
  SignatureVerifier,
} from "@/providers/types";

const ERC1271_ABI = [
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
  },
] as const;

/** ERC-1271 magic value returned by a valid contract signature. */
const ERC1271_MAGIC_VALUE = "0x1626ba7e";

export class EvmSignatureVerifier implements SignatureVerifier {
  readonly descriptor: ProviderDescriptor;

  constructor() {
    this.descriptor = {
      id: "evm-signer",
      mode: "live",
      kind: "signer",
      available: true,
      notes: "EIP-191 personal_sign recovery with ERC-1271 smart-account fallback.",
      detail: { standards: ["EIP-191", "ERC-1271"], magicValue: ERC1271_MAGIC_VALUE },
    };
  }

  async verify(request: SignatureVerificationRequest): Promise<SignatureVerificationResult> {
    const address = request.address.trim();
    if (!isAddress(address)) {
      throw new AppError("wallet_unsupported", "Supplied address is not a valid EVM address.");
    }
    if (!/^0x[0-9a-fA-F]{130}$/.test(request.signature.trim())) {
      return { valid: false, recoveredAddress: null, signerType: "eip191", reason: "Malformed signature (expected 65 bytes, 0x-prefixed)." };
    }

    let recovered: string | null = null;
    try {
      recovered = normalizeAddress(
        await recoverMessageAddress({ message: request.message, signature: request.signature as Hex }),
      );
    } catch (err) {
      return {
        valid: false,
        recoveredAddress: null,
        signerType: "eip191",
        reason: `Signature recovery failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (recovered === normalizeAddress(address)) {
      return { valid: true, recoveredAddress: recovered, signerType: "eip191" };
    }

    // ERC-1271 fallback for contract wallets.
    const chainKey = request.chainKey ?? "ethereum-sepolia";
    const rpcUrl = chainRpcUrl(chainByKey(chainKey)!);
    if (rpcUrl) {
      try {
        const client = createPublicClient({ transport: http(rpcUrl) });
        const magicValue = await client.readContract({
          address: address as Hex,
          abi: ERC1271_ABI,
          functionName: "isValidSignature",
          args: [hashMessage(request.message), request.signature as Hex],
        });
        if (String(magicValue).toLowerCase() === ERC1271_MAGIC_VALUE) {
          return { valid: true, recoveredAddress: normalizeAddress(address), signerType: "eip1271" };
        }
      } catch {
        /* not a contract or RPC unavailable — fall through to failure */
      }
    }

    return {
      valid: false,
      recoveredAddress: recovered,
      signerType: "eip191",
      reason: `Signature recovered ${recovered}, which does not control ${normalizeAddress(address)}.`,
    };
  }
}

// viem's `hashMessage` implements keccak256("\x19Ethereum Signed Message:\n" + len + message),
// which is exactly the digest ERC-1271 `isValidSignature` expects.
