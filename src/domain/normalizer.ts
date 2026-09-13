/**
 * Evidence Normalizer.
 *
 * The single shared path from raw chain data to canonical `EconomicEvent`s.
 * Demo mode and live mode both go through this module — the only difference is
 * which `ChainDataProvider` produced the raw transactions.
 *
 * Not every blockchain transaction becomes an economic event. Reverted calls,
 * zero-value contract interactions and events with no economic meaning are
 * dropped here, because feeding them to the engine would let anyone inflate
 * activity without creating evidence.
 */
import { economicEventKey, normalizeAddress } from "@/lib/deterministic";
import { rawToUsdCents } from "@/lib/money";
import type { EconomicEvent } from "@/domain/types";
import type { DecodedLog, RawChainTransaction } from "@/providers/types";

export const NATIVE_ASSET_BY_CHAIN: Record<string, { symbol: string; decimals: number }> = {
  "ethereum-sepolia": { symbol: "ETH", decimals: 18 },
  ethereum: { symbol: "ETH", decimals: 18 },
  "base-sepolia": { symbol: "ETH", decimals: 18 },
  base: { symbol: "ETH", decimals: 18 },
  "creditcoin-testnet": { symbol: "CTC", decimals: 18 },
};

/** Types inferred for a plain native/token transfer based on direction. */
function inferTransferType(direction: "in" | "out"): EconomicEvent["type"] {
  return direction === "in" ? "FUNDING" : "TRANSFER";
}

export interface NormalizeInput {
  walletId: string;
  walletAddress: string;
  transactions: readonly RawChainTransaction[];
  /** USD price lookup; keeps the normalizer pure and mode-agnostic. */
  resolvePrice?: (input: { asset: string; chainKey: string }) => number;
  now?: number;
}

export interface NormalizeOutput {
  events: EconomicEvent[];
  skipped: { txHash: string; logIndex: number; reason: string }[];
}

export function normalizeActivity(input: NormalizeInput): NormalizeOutput {
  const subject = normalizeAddress(input.walletAddress);
  const resolvePrice = input.resolvePrice ?? (() => 0);
  const skipped: NormalizeOutput["skipped"] = [];

  const ordered = [...input.transactions].sort(
    (a, b) =>
      a.timestampMs - b.timestampMs ||
      a.blockHeight - b.blockHeight ||
      (a.logs[0]?.logIndex ?? 0) - (b.logs[0]?.logIndex ?? 0) ||
      a.txHash.localeCompare(b.txHash),
  );

  interface Candidate {
    tx: RawChainTransaction;
    logIndex: number;
    type: EconomicEvent["type"];
    from: string;
    to: string;
    asset: string;
    assetDecimals: number;
    amountRaw: string;
    protocol: string | null;
    metadata: EconomicEvent["metadata"];
  }

  const candidates: Candidate[] = [];

  for (const tx of ordered) {
    if (tx.status === "REVERTED") {
      skipped.push({ txHash: tx.txHash, logIndex: -1, reason: "transaction_reverted" });
      continue;
    }

    const decodedLogs = tx.logs.filter((l): l is typeof l & { decoded: DecodedLog } => Boolean(l.decoded));

    for (const log of decodedLogs) {
      const d = log.decoded;
      if (d.amountRaw === "0") {
        skipped.push({ txHash: tx.txHash, logIndex: log.logIndex, reason: "zero_value" });
        continue;
      }
      candidates.push({
        tx,
        logIndex: log.logIndex,
        type: d.type,
        from: normalizeAddress(d.from),
        to: normalizeAddress(d.to),
        asset: d.asset,
        assetDecimals: d.assetDecimals,
        amountRaw: d.amountRaw,
        protocol: d.protocol,
        metadata: d.metadata ?? {},
      });
    }

    // Native value transfer with no decoded economic log.
    const hasDecodedEconomicLog = decodedLogs.length > 0;
    if (!hasDecodedEconomicLog && tx.valueRaw !== "0" && BigInt(tx.valueRaw) > 0n) {
      const to = tx.to ? normalizeAddress(tx.to) : null;
      const from = normalizeAddress(tx.from);
      if (!to) {
        skipped.push({ txHash: tx.txHash, logIndex: 0, reason: "contract_creation" });
        continue;
      }
      const isInflow = to === subject;
      const isOutflow = from === subject;
      if (!isInflow && !isOutflow) {
        skipped.push({ txHash: tx.txHash, logIndex: 0, reason: "wallet_not_a_party" });
        continue;
      }
      const native = NATIVE_ASSET_BY_CHAIN[tx.chainKey] ?? { symbol: "ETH", decimals: 18 };
      candidates.push({
        tx,
        logIndex: 0,
        type: inferTransferType(isInflow ? "in" : "out"),
        from,
        to,
        asset: native.symbol,
        assetDecimals: native.decimals,
        amountRaw: tx.valueRaw,
        protocol: null,
        metadata: { note: "Native value transfer" },
      });
    }

    if (!hasDecodedEconomicLog && (tx.valueRaw === "0" || BigInt(tx.valueRaw) === 0n)) {
      skipped.push({ txHash: tx.txHash, logIndex: 0, reason: "no_economic_meaning" });
    }
  }

  // Chronological sequence numbers are assigned AFTER filtering so ordering
  // signals (Behavioral Coherence) are computed over economic events only.
  candidates.sort(
    (a, b) =>
      a.tx.timestampMs - b.tx.timestampMs ||
      a.tx.blockHeight - b.tx.blockHeight ||
      a.logIndex - b.logIndex ||
      a.type.localeCompare(b.type),
  );

  const events: EconomicEvent[] = candidates.map((c, sequence) => {
    const priceUsd =
      typeof c.metadata.priceUsd === "number"
        ? (c.metadata.priceUsd as number)
        : resolvePrice({ asset: c.asset, chainKey: c.tx.chainKey });
    return {
      id: economicEventKey({
        walletId: input.walletId,
        chainKey: c.tx.chainKey,
        txHash: c.tx.txHash,
        logIndex: c.logIndex,
        type: c.type,
      }),
      walletId: input.walletId,
      chainKey: c.tx.chainKey,
      chainId: c.tx.chainId,
      blockHeight: c.tx.blockHeight,
      txHash: c.tx.txHash,
      logIndex: c.logIndex,
      timestamp: c.tx.timestampMs,
      type: c.type,
      from: c.from,
      to: c.to,
      asset: c.asset,
      assetDecimals: c.assetDecimals,
      amountRaw: c.amountRaw,
      amountUsdCents: rawToUsdCents({
        amountRaw: c.amountRaw,
        decimals: c.assetDecimals,
        priceUsd,
      }),
      protocol: c.protocol,
      attestationId: null,
      verified: false,
      sequence,
      metadata: { ...c.metadata, priceUsd },
    };
  });

  return { events, skipped };
}

/** Collapse duplicates by the idempotency key, keeping the first occurrence. */
export function dedupeEvents(events: readonly EconomicEvent[]): EconomicEvent[] {
  const seen = new Set<string>();
  const out: EconomicEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}
