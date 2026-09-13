/**
 * Money handling.
 *
 * Internal representation is ALWAYS integer USD cents (`number`, safe well below
 * 2^53) plus the raw chain amount as a decimal string. Floats are only produced
 * at the API boundary for display and never fed back into calculations.
 */

export type UsdCents = number;

export function usdToCents(usd: number): UsdCents {
  if (!Number.isFinite(usd)) throw new Error(`Invalid USD amount: ${usd}`);
  return Math.round(usd * 100);
}

export function centsToUsd(cents: UsdCents): number {
  return Math.round(cents) / 100;
}

export function formatUsd(cents: UsdCents): string {
  const value = centsToUsd(cents);
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convert a raw integer amount (decimal string) into USD cents given a price. */
export function rawToUsdCents(input: {
  amountRaw: string;
  decimals: number;
  priceUsd: number;
}): UsdCents {
  const raw = BigInt(input.amountRaw);
  if (raw === 0n) return 0;
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const divisor = 10n ** BigInt(input.decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  // whole units * price, plus fractional part, both in cents, using integer maths
  // where possible and float only for the price multiplication.
  const wholeCents = Number(whole) * input.priceUsd * 100;
  const fractionCents = (Number(fraction) / Number(divisor)) * input.priceUsd * 100;
  const cents = Math.round(wholeCents + fractionCents);
  return negative ? -cents : cents;
}

export function rawToDecimalString(amountRaw: string, decimals: number): string {
  const raw = BigInt(amountRaw);
  const negative = raw < 0n;
  const abs = (negative ? -raw : raw).toString().padStart(decimals + 1, "0");
  const cut = abs.length - decimals;
  const whole = decimals === 0 ? abs : abs.slice(0, cut);
  const fraction = decimals === 0 ? "" : abs.slice(cut).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp(numerator / denominator, 0, 1);
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** 1 - exp(-x / k): smooth saturation used throughout the evidence engine. */
export function saturate(x: number, k: number): number {
  if (x <= 0) return 0;
  if (k <= 0) return 1;
  return clamp(1 - Math.exp(-x / k), 0, 1);
}

/** Herfindahl-Hirschman index of a distribution of positive weights. */
export function herfindahl(weights: readonly number[]): number {
  const total = sum(weights);
  if (total <= 0) return 0;
  return sum(weights.map((w) => (w / total) ** 2));
}

/** Normalised Shannon entropy (0..1) of a discrete distribution. */
export function normalizedEntropy(counts: readonly number[]): number {
  const total = sum(counts);
  const nonZero = counts.filter((c) => c > 0);
  if (total <= 0 || nonZero.length <= 1) return 0;
  const h = -sum(nonZero.map((c) => (c / total) * Math.log(c / total)));
  return clamp(h / Math.log(nonZero.length), 0, 1);
}
