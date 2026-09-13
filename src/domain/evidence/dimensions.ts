/**
 * The three headline dimensions of the Economic Evidence Engine.
 *
 *   C — Capital Independence   how independent was the capital?
 *   D — Economic Diversity     how economically varied was the activity?
 *   Q — Behavioral Coherence   does the sequence make economic sense?
 *
 * Every function is pure, deterministic and returns both a normalised value in
 * [0,1] and an explanation. There is no model, no LLM and no randomness: a judge
 * can read this file and reproduce any number BASIS produces.
 *
 * All tunable constants live in `EVIDENCE_WEIGHTS` so calibration is auditable.
 */
import { evidenceConfig } from "@/lib/config";
import { clamp, normalizedEntropy, ratio, saturate, sum } from "@/lib/money";
import { sha256Hex } from "@/lib/deterministic";
import type { EconomicEvent, EvidenceFactor } from "@/domain/types";
import { ACTION_FAMILIES, familyOf } from "@/domain/types";
import type { EvidenceGraph } from "./graph";

export const EVIDENCE_WEIGHTS = {
  capital: {
    sourceCount: { weight: 0.4, saturation: 1.2 },
    clusterCount: { weight: 0.2, saturation: 1.5 },
    fundingDepth: { weight: 0.15, saturation: 3.0 },
    inflowEvenness: { weight: 0.25 },
    selfFundingPenalty: 0.5,
    circularFundingPenalty: 0.5,
    /** A single origin for all capital is weak evidence of independence. */
    singleSourceMultiplier: 0.45,
  },
  diversity: {
    counterparties: { weight: 0.22, saturation: 6.0, repeatSaturation: 1.5 },
    protocols: { weight: 0.18, saturation: 2.5 },
    assets: { weight: 0.14, saturation: 4.5 },
    actionFamilyCoverage: { weight: 0.26 },
    nonCircularFlow: { weight: 0.2 },
  },
  coherence: {
    motifOrder: { weight: 0.3 },
    timingEntropy: { weight: 0.18 },
    nonRepetition: { weight: 0.22 },
    nonCircularity: { weight: 0.18 },
    creditCycle: { weight: 0.12 },
    bigramDominancePenalty: 0.4,
    bigramDominanceThreshold: 0.4,
    metronomicPenalty: 0.3,
    metronomicEntropyFloor: 0.2,
    circularityPenalty: 0.5,
    neutralCreditCycle: 0.5,
  },
} as const;

/** Relative economic weight of each action family (used for coverage). */
export const FAMILY_WEIGHTS: Record<keyof typeof ACTION_FAMILIES, number> = {
  FUNDING: 1.0,
  TRANSFER: 1.0,
  SWAP: 1.5,
  DEPOSIT: 1.5,
  CREDIT: 2.0,
  WITHDRAW: 1.0,
  PAYMENT: 1.5,
  REWARD: 0.5,
};

const FAMILY_TOTAL = sum(Object.values(FAMILY_WEIGHTS));

/** Canonical economic life-cycle stages, in the order they should appear. */
export const CANONICAL_STAGES = [
  { key: "FUNDED", types: ["FUNDING"] },
  { key: "EXCHANGED", types: ["SWAP"] },
  { key: "DEPOSITED", types: ["DEPOSIT", "STAKE"] },
  { key: "BORROWED", types: ["BORROW"] },
  { key: "REPAID", types: ["REPAY"] },
  { key: "SETTLED_OUT", types: ["TRANSFER", "PAYMENT"] },
] as const;

/* -------------------------------------------------------------------------- */
/* C — Capital Independence                                                   */
/* -------------------------------------------------------------------------- */

export interface CapitalIndependenceSignals {
  fundingSourceCount: number;
  independentFundingSourceCount: number;
  fundingClusterCount: number;
  averageFundingDepth: number;
  inflowEvenness: number;
  inflowHhi: number;
  selfFundingShare: number;
  circularFundingShare: number;
  inflowUsdCents: number;
}

export function capitalIndependenceSignals(graph: EvidenceGraph): CapitalIndependenceSignals {
  const cfg = evidenceConfig;
  const meaningful = graph.fundingSources.filter(
    (s) => s.share >= cfg.minFundingSourceShare && s.inflowUsdCents >= cfg.minFundingSourceUsdCents,
  );
  const clusters = new Set(meaningful.map((s) => s.cluster));
  const weights = meaningful.map((s) => s.inflowUsdCents);
  const total = sum(weights);
  const hhi = total > 0 ? sum(weights.map((w) => (w / total) ** 2)) : 0;
  // Evenness: HHI normalised against the minimum possible for n sources.
  const evenness = meaningful.length > 1 ? clamp((1 - hhi) / (1 - 1 / meaningful.length), 0, 1) : 0;

  return {
    fundingSourceCount: graph.fundingSources.length,
    independentFundingSourceCount: meaningful.length,
    fundingClusterCount: clusters.size,
    averageFundingDepth: graph.averageFundingDepth,
    inflowEvenness: evenness,
    inflowHhi: hhi,
    selfFundingShare: graph.selfFundingShare,
    circularFundingShare: graph.circularFundingShare,
    inflowUsdCents: graph.inflowUsdCents,
  };
}

export function capitalIndependence(graph: EvidenceGraph): EvidenceFactor {
  const w = EVIDENCE_WEIGHTS.capital;
  const s = capitalIndependenceSignals(graph);

  const sourceScore = saturate(s.independentFundingSourceCount, w.sourceCount.saturation);
  const clusterScore = saturate(s.fundingClusterCount, w.clusterCount.saturation);
  const depthScore = saturate(s.averageFundingDepth, w.fundingDepth.saturation);
  const evennessScore = s.inflowEvenness;

  const raw =
    w.sourceCount.weight * sourceScore +
    w.clusterCount.weight * clusterScore +
    w.fundingDepth.weight * depthScore +
    w.inflowEvenness.weight * evennessScore;

  const singleSourceMultiplier =
    s.independentFundingSourceCount <= 1 ? w.singleSourceMultiplier : 1;

  const penalty =
    singleSourceMultiplier *
    (1 - w.selfFundingPenalty * s.selfFundingShare) *
    (1 - w.circularFundingPenalty * s.circularFundingShare);

  const value = clamp(raw * penalty, 0, 1);

  let explanation: string;
  if (s.independentFundingSourceCount === 0) {
    explanation = "No independent funding inflows were observed, so the origin of this capital cannot be established.";
  } else if (s.circularFundingShare > 0.5) {
    explanation = `Capital was funded by ${s.independentFundingSourceCount} source${s.independentFundingSourceCount === 1 ? "" : "s"}, but ${Math.round(s.circularFundingShare * 100)}% of inflow came from an address the wallet also sends value back to — a round trip, not independent capital.`;
  } else {
    explanation = `Activity was funded by ${s.independentFundingSourceCount} independent source${s.independentFundingSourceCount === 1 ? "" : "s"} across ${s.fundingClusterCount} funding cluster${s.fundingClusterCount === 1 ? "" : "s"} at an average depth of ${s.averageFundingDepth.toFixed(1)} hop(s).`;
  }

  return {
    key: "capitalIndependence",
    label: "Capital Independence",
    value: round4(value),
    explanation,
    signals: {
      independentFundingSources: s.independentFundingSourceCount,
      fundingClusters: s.fundingClusterCount,
      averageFundingDepth: round4(s.averageFundingDepth),
      inflowEvenness: round4(evennessScore),
      inflowHhi: round4(s.inflowHhi),
      selfFundingShare: round4(s.selfFundingShare),
      circularFundingShare: round4(s.circularFundingShare),
      sourceScore: round4(sourceScore),
      clusterScore: round4(clusterScore),
      depthScore: round4(depthScore),
      penaltyMultiplier: round4(penalty),
      inflowUsd: round4(s.inflowUsdCents / 100),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* D — Economic Diversity                                                     */
/* -------------------------------------------------------------------------- */

export interface DiversitySignals {
  effectiveCounterpartyCount: number;
  rawCounterpartyCount: number;
  protocolCount: number;
  assetCount: number;
  familiesPresent: string[];
  familyCoverage: number;
  nonCircularShare: number;
}

export function diversitySignals(graph: EvidenceGraph, events: readonly EconomicEvent[]): DiversitySignals {
  const w = EVIDENCE_WEIGHTS.diversity;
  // Repeated interaction with the same address saturates instead of stacking, so
  // A -> B six times never looks as diverse as six distinct relationships.
  const effective = sum(
    graph.counterparties.map((c) => saturate(c.eventCount, w.counterparties.repeatSaturation)),
  );
  const families = new Set(events.map((e) => familyOf(e.type)));
  const coverage = sum([...families].map((f) => FAMILY_WEIGHTS[f])) / FAMILY_TOTAL;

  return {
    effectiveCounterpartyCount: effective,
    rawCounterpartyCount: graph.counterparties.length,
    protocolCount: graph.protocols.length,
    assetCount: graph.assets.length,
    familiesPresent: [...families].sort(),
    familyCoverage: events.length === 0 ? 0 : clamp(coverage, 0, 1),
    // With no activity, "non-circular" is vacuously true and must not score.
    nonCircularShare: events.length === 0 ? 0 : 1 - graph.cycleRatio,
  };
}

export function economicDiversity(graph: EvidenceGraph, events: readonly EconomicEvent[]): EvidenceFactor {
  const w = EVIDENCE_WEIGHTS.diversity;
  const s = diversitySignals(graph, events);

  const counterpartyScore = saturate(s.effectiveCounterpartyCount, w.counterparties.saturation);
  const protocolScore = saturate(s.protocolCount, w.protocols.saturation);
  const assetScore = saturate(s.assetCount, w.assets.saturation);

  const value = clamp(
    w.counterparties.weight * counterpartyScore +
      w.protocols.weight * protocolScore +
      w.assets.weight * assetScore +
      w.actionFamilyCoverage.weight * s.familyCoverage +
      w.nonCircularFlow.weight * s.nonCircularShare,
    0,
    1,
  );

  const explanation =
    events.length === 0
      ? "No economic activity to diversify."
      : `Activity involved ${s.rawCounterpartyCount} unique counterpart${s.rawCounterpartyCount === 1 ? "y" : "ies"} across ${s.protocolCount} protocol${s.protocolCount === 1 ? "" : "s"} and ${s.assetCount} asset${s.assetCount === 1 ? "" : "s"}, covering ${s.familiesPresent.length} of ${Object.keys(ACTION_FAMILIES).length} economic action families${s.nonCircularShare < 1 ? `, with ${Math.round((1 - s.nonCircularShare) * 100)}% of transfer value flowing in circles` : ""}.`;

  return {
    key: "economicDiversity",
    label: "Economic Diversity",
    value: round4(value),
    explanation,
    signals: {
      uniqueCounterparties: s.rawCounterpartyCount,
      effectiveCounterparties: round4(s.effectiveCounterpartyCount),
      uniqueProtocols: s.protocolCount,
      uniqueAssets: s.assetCount,
      actionFamilies: s.familiesPresent.join(","),
      familyCoverage: round4(s.familyCoverage),
      nonCircularShare: round4(s.nonCircularShare),
      counterpartyScore: round4(counterpartyScore),
      protocolScore: round4(protocolScore),
      assetScore: round4(assetScore),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Q — Behavioral Coherence                                                   */
/* -------------------------------------------------------------------------- */

export interface CoherenceSignals {
  motifScore: number;
  matchedStages: string[];
  timingEntropy: number;
  scriptedShare: number;
  repetitionRate: number;
  uniqueMotifs: number;
  cycleRatio: number;
  creditCycleCoherence: number;
  bigramDominance: number;
  metronomic: boolean;
}

function bucketGap(gapMs: number): number {
  const seconds = gapMs / 1000;
  const buckets = evidenceConfig.timingBucketsSec;
  for (let i = 0; i < buckets.length; i += 1) if (seconds < buckets[i]) return i;
  return buckets.length;
}

/** Greedy forward match of the canonical economic life-cycle. */
function matchStages(timeline: readonly EconomicEvent[]): string[] {
  const matched: string[] = [];
  let pointer = 0;
  for (const event of timeline) {
    if (pointer >= CANONICAL_STAGES.length) break;
    const stage = CANONICAL_STAGES[pointer];
    if ((stage.types as readonly string[]).includes(event.type)) {
      matched.push(stage.key);
      pointer += 1;
    }
  }
  return matched;
}

function borrowedRepaidCoherence(timeline: readonly EconomicEvent[]): number {
  const borrows = timeline.filter((e) => e.type === "BORROW");
  const repays = timeline.filter((e) => e.type === "REPAY");
  if (borrows.length === 0 && repays.length === 0) {
    return EVIDENCE_WEIGHTS.coherence.neutralCreditCycle;
  }
  if (borrows.length === 0) return 0.2; // repayments with no observed borrow
  let score = 0;
  let checks = 0;
  let borrowedCents = 0;
  let repaidCents = 0;
  const borrowTimes: number[] = [];
  for (const event of timeline) {
    if (event.type === "BORROW") {
      borrowedCents += event.amountUsdCents;
      borrowTimes.push(event.timestamp);
    }
    if (event.type === "REPAY") {
      repaidCents += event.amountUsdCents;
      checks += 1;
      const afterBorrow = borrowTimes.some((t) => event.timestamp >= t);
      const instant = borrowTimes.some(
        (t) => event.timestamp >= t && event.timestamp - t < evidenceConfig.instantRepayWindowMs,
      );
      if (afterBorrow) score += 1;
      if (instant) score -= 0.75; // borrow -> immediate repay is a manufactured motif
    }
  }
  const sequenceScore = checks > 0 ? clamp(score / checks, 0, 1) : 0.5;
  const coverageScore = borrowedCents > 0 ? clamp(repaidCents / borrowedCents, 0, 1) : 0;
  return clamp(0.6 * sequenceScore + 0.4 * coverageScore, 0, 1);
}

function repetitionProfile(timeline: readonly EconomicEvent[], graph: EvidenceGraph): {
  repetitionRate: number;
  uniqueMotifs: number;
  bigramDominance: number;
} {
  if (timeline.length === 0) return { repetitionRate: 0, uniqueMotifs: 0, bigramDominance: 0 };
  const clusterFor = (address: string) =>
    graph.counterparties.find((c) => c.address === address)?.cluster ??
    graph.fundingSources.find((s) => s.address === address)?.cluster ??
    address;

  const motifs = timeline.map((e) => {
    const counterparty =
      e.to === graph.subject ? clusterFor(e.from) : e.from === graph.subject ? clusterFor(e.to) : "external";
    const bucket = e.amountUsdCents <= 0 ? 0 : Math.floor(Math.log10(e.amountUsdCents));
    return `${e.type}|${counterparty}|${bucket}`;
  });
  const unique = new Set(motifs).size;
  const repetitionRate = clamp(1 - unique / motifs.length, 0, 1);

  const bigrams = new Map<string, number>();
  for (let i = 1; i < motifs.length; i += 1) {
    const key = `${motifs[i - 1]}->${motifs[i]}`;
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  const transitions = motifs.length - 1;
  const dominant = transitions > 0 ? Math.max(...bigrams.values()) / transitions : 0;

  return { repetitionRate, uniqueMotifs: unique, bigramDominance: dominant };
}

export function coherenceSignals(graph: EvidenceGraph): CoherenceSignals {
  const w = EVIDENCE_WEIGHTS.coherence;
  const timeline = graph.timeline;

  const matched = matchStages(timeline);
  const stagesPresent = new Set(
    CANONICAL_STAGES.filter((stage) =>
      timeline.some((e) => (stage.types as readonly string[]).includes(e.type)),
    ).map((s) => s.key),
  );
  const motifScore =
    stagesPresent.size === 0 ? 0 : clamp(matched.length / stagesPresent.size, 0, 1);

  const buckets = graph.interEventGapsMs.map(bucketGap);
  const counts: number[] = [];
  for (const b of buckets) counts[b] = (counts[b] ?? 0) + 1;
  const timingEntropy = normalizedEntropy(counts.filter((c) => c !== undefined));

  const scripted = graph.interEventGapsMs.filter((g) => g < evidenceConfig.scriptedGapMs).length;
  const scriptedShare = ratio(scripted, Math.max(1, graph.interEventGapsMs.length));

  const repetition = repetitionProfile(timeline, graph);
  const creditCycleCoherence =
    timeline.length === 0 ? 0 : borrowedRepaidCoherence(timeline);
  const metronomic =
    timeline.length >= 4 && timingEntropy < w.metronomicEntropyFloor;

  if (timeline.length === 0) {
    // No sequence exists: coherence is zero, not "neutral". Every component
    // (motif, entropy, non-repetition, non-circularity) is vacuous here.
    return {
      motifScore: 0,
      matchedStages: [],
      timingEntropy: 0,
      scriptedShare: 0,
      repetitionRate: 0,
      uniqueMotifs: 0,
      cycleRatio: 0,
      creditCycleCoherence: 0,
      bigramDominance: 0,
      metronomic: false,
    };
  }

  return {
    motifScore,
    matchedStages: matched,
    timingEntropy,
    scriptedShare,
    repetitionRate: repetition.repetitionRate,
    uniqueMotifs: repetition.uniqueMotifs,
    cycleRatio: graph.cycleRatio,
    creditCycleCoherence,
    bigramDominance: repetition.bigramDominance,
    metronomic,
  };
}

export function behavioralCoherence(graph: EvidenceGraph): EvidenceFactor {
  const w = EVIDENCE_WEIGHTS.coherence;
  const s = coherenceSignals(graph);

  if (graph.timeline.length === 0) {
    return {
      key: "behavioralCoherence",
      label: "Behavioral Coherence",
      value: 0,
      explanation: "No behavioral sequence to assess.",
      signals: { eventCount: 0, motifScore: 0, timingEntropy: 0, repetitionRate: 0, cycleRatio: 0 },
    };
  }

  const bigramPenalty =
    s.bigramDominance > w.bigramDominanceThreshold
      ? 1 - w.bigramDominancePenalty * (s.bigramDominance - w.bigramDominanceThreshold)
      : 1;

  const raw =
    w.motifOrder.weight * s.motifScore * bigramPenalty +
    w.timingEntropy.weight * s.timingEntropy +
    w.nonRepetition.weight * (1 - s.repetitionRate) +
    w.nonCircularity.weight * (1 - s.cycleRatio) +
    w.creditCycle.weight * s.creditCycleCoherence;

  const structuralPenalty =
    (1 - w.circularityPenalty * s.cycleRatio) *
    (s.metronomic ? 1 - w.metronomicPenalty : 1) *
    (1 - 0.5 * s.scriptedShare);

  const value = clamp(raw * structuralPenalty, 0, 1);

  let explanation: string;
  if (graph.timeline.length === 0) {
    explanation = "No behavioral sequence to assess.";
  } else if (s.cycleRatio > 0.5) {
    explanation = `Activity is dominated by round trips: ${Math.round(s.cycleRatio * 100)}% of transfer value returns to the wallet from the same counterparty, and only ${s.uniqueMotifs} distinct behavioral motif${s.uniqueMotifs === 1 ? "" : "s"} appear across ${graph.timeline.length} events.`;
  } else if (s.motifScore >= 0.8) {
    explanation = `Activity contains multiple economically distinct actions in a coherent order (${s.matchedStages.join(" → ")}), with ${s.uniqueMotifs} distinct motifs across ${graph.timeline.length} events and limited repetition.`;
  } else {
    explanation = `Activity shows partial economic sequencing (${s.matchedStages.join(" → ") || "no canonical stages matched"}) with ${Math.round(s.repetitionRate * 100)}% motif repetition.`;
  }

  return {
    key: "behavioralCoherence",
    label: "Behavioral Coherence",
    value: round4(value),
    explanation,
    signals: {
      matchedStages: s.matchedStages.join(","),
      motifScore: round4(s.motifScore),
      timingEntropy: round4(s.timingEntropy),
      repetitionRate: round4(s.repetitionRate),
      uniqueMotifs: s.uniqueMotifs,
      cycleRatio: round4(s.cycleRatio),
      creditCycleCoherence: round4(s.creditCycleCoherence),
      bigramDominance: round4(s.bigramDominance),
      metronomic: s.metronomic,
      structuralPenalty: round4(structuralPenalty),
      eventCount: graph.timeline.length,
    },
  };
}

/* -------------------------------------------------------------------------- */

export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Deterministic fingerprint of a factor set (used for evidence reproducibility). */
export function factorsFingerprint(factors: readonly EvidenceFactor[]): string {
  return sha256Hex(
    factors
      .map((f) => `${f.key}=${f.value.toFixed(6)}`)
      .sort()
      .join(";"),
  );
}
