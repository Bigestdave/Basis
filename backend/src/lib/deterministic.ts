/**
 * Deterministic primitives.
 *
 * BASIS must never use `Math.random()` for anything that touches money, evidence
 * or demo data. Every identifier and hash in the system is derived from its
 * inputs, which makes evaluations reproducible and duplicate-detectable.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacSha256Hex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Stable JSON stringify: object keys sorted recursively. Required so that
 * evidence hashes do not depend on property insertion order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(",")}}`;
}

export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

/** `0x`-prefixed lowercase address normalisation. */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function shortAddress(address: string): string {
  const a = normalizeAddress(address);
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* -------------------------------------------------------------------------- */
/* Deterministic pseudo-randomness (seeded, never Math.random)                */
/* -------------------------------------------------------------------------- */

/** mulberry32 seeded from a string. Deterministic across processes/runs. */
export function seededInt(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic `0x`-prefixed hex of `bytes` length derived from `seed`. */
export function deterministicHex(seed: string, bytes: number): string {
  const rand = seededInt(seed);
  let out = "";
  for (let i = 0; i < bytes * 2; i += 1) {
    out += Math.floor(rand() * 16).toString(16);
  }
  return `0x${out}`;
}

export const deterministicTxHash = (seed: string) => deterministicHex(`tx:${seed}`, 32);
export const deterministicAddress = (seed: string) => deterministicHex(`addr:${seed}`, 20);
export const deterministicAttestationId = (seed: string) => `atc_${deterministicHex(`atc:${seed}`, 16).slice(2)}`;

/* -------------------------------------------------------------------------- */
/* Identifiers                                                                */
/* -------------------------------------------------------------------------- */

const ID_PREFIXES = {
  user: "usr",
  wallet: "wal",
  connection: "wcn",
  network: "net",
  event: "evt",
  attestation: "atc",
  evaluation: "evl",
  decision: "dcs",
  account: "cra",
  txn: "ctx",
  position: "pos",
  job: "job",
  audit: "aud",
  nonce: "nnc",
  session: "ses",
  scenario: "scn",
  asset: "ast",
  protocol: "prc",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

/**
 * Content-addressed identifier: the same inputs always yield the same id.
 * This is what makes the whole ingest pipeline idempotent.
 */
export function deterministicId(kind: IdKind, ...parts: (string | number)[]): string {
  return `${ID_PREFIXES[kind]}_${sha256Hex(parts.map(String).join("|")).slice(0, 32)}`;
}

/** Random identifier, used only where uniqueness (not reproducibility) matters. */
export function randomId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${randomBytes(16).toString("hex")}`;
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/* -------------------------------------------------------------------------- */
/* Domain hashes                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Unique key for a raw chain event. Two ingests of the same log collapse onto
 * the same event, which is the core of duplicate-event protection.
 */
export function economicEventKey(input: {
  walletId: string;
  chainKey: string;
  txHash: string;
  logIndex: number;
  type: string;
}): string {
  return deterministicId(
    "event",
    input.walletId,
    input.chainKey,
    input.txHash.toLowerCase(),
    input.logIndex,
    input.type,
  );
}

/**
 * Hash of an evidence set. Stored on the evaluation and on the credit decision
 * so the exact same evidence can never be converted into credit twice.
 */
export function evidenceHash(input: {
  walletId: string;
  engineVersion: string;
  eventIds: readonly string[];
}): string {
  return sha256Hex(
    canonicalize({
      v: input.engineVersion,
      w: input.walletId,
      e: [...input.eventIds].sort(),
    }),
  );
}

export function formatIso(ms: number | Date): string {
  return new Date(ms).toISOString();
}
