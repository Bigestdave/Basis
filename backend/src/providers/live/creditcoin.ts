/**
 * Creditcoin credit provider — LIVE.
 *
 * Verified facts about the rail (docs.creditcoin.org):
 *   - Creditcoin CC3 is EVM compatible, so standard viem/ethers tooling works.
 *   - Testnet RPC  https://rpc.cc3-testnet.creditcoin.network   chainId 102031
 *   - Mainnet RPC  https://mainnet3.creditcoin.network          chainId 102030
 *   - Explorer     https://creditcoin-testnet.blockscout.com
 *
 * Creditcoin does NOT ship a canonical "consumer credit account" contract, and
 * this code refuses to invent one. Instead:
 *
 *   1. Postgres is the system of record for credit state (auditable, queryable).
 *   2. This provider is the *settlement rail*: it anchors BASIS credit decisions,
 *      draws and repayments into a BASIS-owned ledger contract deployed on
 *      Creditcoin CC3, whose address is supplied via CREDITCOIN_LEDGER_ADDRESS.
 *   3. If the ledger address or the settlement key is not configured, every
 *      settlement returns `settled: false` with an explicit reason. It never
 *      claims to have written on-chain when it has not.
 *
 * The Solidity source for the ledger contract is in docs/CREDITCOIN.md so the
 * integration can actually be deployed and verified on Blockscout.
 */
import { createPublicClient, createWalletClient, http, defineChain, encodeFunctionData, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AppError } from "@/lib/errors";
import { sha256Hex } from "@/lib/deterministic";
import { creditcoinConfig } from "@/lib/config";
import type {
  CreditContext,
  CreditProvider,
  ProviderDescriptor,
  SettlementResult,
} from "@/providers/types";

export const CREDITCOIN_LEDGER_ABI = [
  {
    type: "function",
    name: "creditLimit",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "borrowed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setCreditLimit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "limitCents", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordDraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "amountCents", type: "uint256" },
      { name: "reference", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordRepayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "amountCents", type: "uint256" },
      { name: "reference", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "CreditLimitSet",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "limitCents", type: "uint256", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: true },
    ],
    anonymous: false,
  },
] as const;

export const creditcoinChain = defineChain({
  id: creditcoinConfig.chainId,
  name: creditcoinConfig.chainId === 102030 ? "Creditcoin" : "Creditcoin CC3 Testnet",
  network: "creditcoin",
  nativeCurrency: { name: "Creditcoin", symbol: "CTC", decimals: 18 },
  rpcUrls: { default: { http: [creditcoinConfig.rpcUrl] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: creditcoinConfig.chainId === 102030 ? "https://creditcoin.blockscout.com" : "https://creditcoin-testnet.blockscout.com",
    },
  },
});

function toBytes32(value: string): Hex {
  const hex = value.replace(/^0x/, "").slice(0, 64).padStart(64, "0");
  return `0x${hex}` as Hex;
}

export class CreditcoinProvider implements CreditProvider {
  readonly descriptor: ProviderDescriptor;
  private publicClient = createPublicClient({ chain: creditcoinChain, transport: http(creditcoinConfig.rpcUrl) });
  private walletClient = creditcoinConfig.settlementPrivateKey
    ? createWalletClient({
        account: privateKeyToAccount(creditcoinConfig.settlementPrivateKey as Hex),
        chain: creditcoinChain,
        transport: http(creditcoinConfig.rpcUrl),
      })
    : null;

  constructor() {
    const ledger = creditcoinConfig.ledgerAddress as string;
    const canWrite = Boolean(ledger) && Boolean(this.walletClient);
    this.descriptor = {
      id: "creditcoin",
      mode: "live",
      kind: "credit",
      available: canWrite,
      notes: canWrite
        ? `Settling credit state into the BASIS ledger contract ${ledger} on Creditcoin chainId ${creditcoinConfig.chainId}.`
        : ledger
          ? "Ledger address configured but CREDITCOIN_SETTLEMENT_PRIVATE_KEY is missing; reads only, no settlement."
          : "CREDITCOIN_LEDGER_ADDRESS is not configured. Credit state stays in the BASIS ledger (Postgres) and settlements report settled=false. Deploy docs/CREDITCOIN.md BasisCreditLedger and set the address to enable anchoring.",
      detail: {
        chainId: creditcoinConfig.chainId,
        rpcUrl: creditcoinConfig.rpcUrl,
        ledgerAddress: ledger || null,
        canWrite,
        explorer: creditcoinChain.blockExplorers.default.url,
      },
    };
  }

  private get ledger(): Hex {
    if (!creditcoinConfig.ledgerAddress) {
      throw new AppError("credit_update_failed", "CREDITCOIN_LEDGER_ADDRESS is not configured.");
    }
    return creditcoinConfig.ledgerAddress as Hex;
  }

  async getAccount(context: CreditContext) {
    if (!creditcoinConfig.ledgerAddress) return null;
    try {
      const [limit, borrowed] = await Promise.all([
        this.publicClient.readContract({
          address: this.ledger,
          abi: CREDITCOIN_LEDGER_ABI,
          functionName: "creditLimit",
          args: [context.walletAddress as Hex],
        }),
        this.publicClient.readContract({
          address: this.ledger,
          abi: CREDITCOIN_LEDGER_ABI,
          functionName: "borrowed",
          args: [context.walletAddress as Hex],
        }),
      ]);
      return {
        creditLimitUsdCents: Number(limit),
        borrowedUsdCents: Number(borrowed),
        onchain: true,
        reference: `${creditcoinChain.blockExplorers.default.url}/address/${creditcoinConfig.ledgerAddress}`,
      };
    } catch {
      return null;
    }
  }

  async getCreditLimit(context: CreditContext) {
    const account = await this.getAccount(context);
    return account?.creditLimitUsdCents ?? 0;
  }

  async updateCreditLimit(
    context: CreditContext,
    input: { newLimitUsdCents: number; decisionId: string; evidenceHash: string },
  ): Promise<SettlementResult> {
    return this.send(context, "setCreditLimit", [
      context.walletAddress as Hex,
      BigInt(input.newLimitUsdCents),
      toBytes32(input.evidenceHash),
    ], { action: "credit-limit-update", decisionId: input.decisionId, evidenceHash: input.evidenceHash });
  }

  async borrow(
    context: CreditContext,
    input: { amountUsdCents: number; positionId: string; transactionId: string },
  ): Promise<SettlementResult> {
    return this.send(context, "recordDraw", [
      context.walletAddress as Hex,
      BigInt(input.amountUsdCents),
      toBytes32(sha256Hex(input.positionId)),
    ], { action: "draw", ...input });
  }

  async repay(
    context: CreditContext,
    input: { amountUsdCents: number; repaymentId: string; transactionId: string; positionId?: string | null },
  ): Promise<SettlementResult> {
    return this.send(context, "recordRepayment", [
      context.walletAddress as Hex,
      BigInt(input.amountUsdCents),
      toBytes32(sha256Hex(input.repaymentId)),
    ], { action: "repayment", ...input });
  }

  private async send(
    context: CreditContext,
    functionName: "setCreditLimit" | "recordDraw" | "recordRepayment",
    args: unknown[],
    detail: Record<string, unknown>,
  ): Promise<SettlementResult> {
    if (!creditcoinConfig.ledgerAddress || !this.walletClient) {
      return {
        settled: false,
        reference: null,
        provider: this.descriptor.id,
        chainKey: "creditcoin-testnet",
        detail: { ...detail, reason: this.descriptor.notes },
      };
    }
    try {
      const data = encodeFunctionData({
        abi: CREDITCOIN_LEDGER_ABI,
        functionName,
        args: args as never,
      });
      const hash = await this.walletClient.sendTransaction({
        to: this.ledger,
        data,
        chain: creditcoinChain,
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      return {
        settled: receipt.status === "success",
        reference: receipt.status === "success" ? String(hash) : null,
        provider: this.descriptor.id,
        chainKey: "creditcoin-testnet",
        detail: {
          ...detail,
          txHash: String(hash),
          blockNumber: Number(receipt.blockNumber),
          explorerUrl: `${creditcoinChain.blockExplorers.default.url}/tx/${hash}`,
          status: receipt.status,
        },
      };
    } catch (err) {
      return {
        settled: false,
        reference: null,
        provider: this.descriptor.id,
        chainKey: "creditcoin-testnet",
        detail: { ...detail, error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
