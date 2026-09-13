/**
 * Economic Evidence Engine.
 *
 *   S = C^0.45 x D^0.30 x Q^0.25
 *
 * The geometric mean is deliberate: a wallet cannot compensate for near-zero
 * evidence in one dimension by manufacturing volume in another. Any dimension at
 * zero drives the whole score to zero.
 *
 * Deterministic, explainable, reproducible, testable. No model, no LLM.
 */
import { EVIDENCE_ENGINE_VERSION, evidenceExponents } from "@/lib/config";
import { evidenceHash } from "@/lib/deterministic";
import { sum } from "@/lib/money";
import type {
  EconomicEvent,
  EvidenceDimensions,
  EvidenceResult,
  EvidenceStrength,
} from "@/domain/types";
import { buildEvidenceGraph, graphFingerprint, type EvidenceGraph } from "./graph";
import {
  behavioralCoherence,
  capitalIndependence,
  economicDiversity,
  factorsFingerprint,
  round4,
} from "./dimensions";

export interface EvaluateOptions {
  walletId: string;
  walletAddress: string;
  /** Events already credited by a previous evaluation are excluded here. */
  events: readonly EconomicEvent[];
  /** Events that were filtered out as stale or previously credited. */
  excludedEventIds?: readonly string[];
  now?: number;
}

export function strengthOf(score: number, eventCount: number): EvidenceStrength {
  if (eventCount === 0 || score < 0.05) return "none";
  if (score < 0.35) return "limited";
  if (score < 0.7) return "moderate";
  return "strong";
}

/** S = C^0.45 x D^0.30 x Q^0.25 — exposed separately so it can be unit tested. */
export function combineDimensions(c: number, d: number, q: number): number {
  const clamped = [c, d, q].map((v) => Math.min(1, Math.max(0, v)));
  if (clamped.some((v) => v <= 0)) return 0;
  return (
    Math.pow(clamped[0], evidenceExponents.capitalIndependence) *
    Math.pow(clamped[1], evidenceExponents.economicDiversity) *
    Math.pow(clamped[2], evidenceExponents.behavioralCoherence)
  );
}

export function evaluateEvidence(options: EvaluateOptions): EvidenceResult & { graph: EvidenceGraph } {
  const now = options.now ?? Date.now();
  const events = options.events;
  const graph = buildEvidenceGraph(options.walletAddress, events);

  const c = capitalIndependence(graph);
  const d = economicDiversity(graph, events);
  const q = behavioralCoherence(graph);

  const dimensions: EvidenceDimensions = {
    capitalIndependence: c,
    economicDiversity: d,
    behavioralCoherence: q,
  };

  const evidenceScore = round4(
    combineDimensions(c.value, d.value, q.value),
  );

  const verified = events.filter((e) => e.verified);

  return {
    engineVersion: EVIDENCE_ENGINE_VERSION,
    dimensions,
    capitalIndependence: c.value,
    economicDiversity: d.value,
    behavioralCoherence: q.value,
    evidenceScore,
    strength: strengthOf(evidenceScore, events.length),
    eventCount: events.length,
    verifiedEventCount: verified.length,
    volumeUsdCents: sum(events.map((e) => e.amountUsdCents)),
    contributingEventIds: events.map((e) => e.id).sort(),
    evidenceHash: evidenceHash({
      walletId: options.walletId,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      eventIds: events.map((e) => e.id),
    }),
    supportingSignals: {
      inflowUsdCents: graph.inflowUsdCents,
      outflowUsdCents: graph.outflowUsdCents,
      cycleRatio: round4(graph.cycleRatio),
      cyclicValueUsdCents: graph.cyclicValueUsdCents,
      fundingSourceCount: graph.fundingSources.length,
      counterpartyCount: graph.counterparties.length,
      protocolCount: graph.protocols.length,
      assetCount: graph.assets.length,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      excludedEventCount: options.excludedEventIds?.length ?? 0,
      graphFingerprintLength: graphFingerprint(graph).length,
      factorsFingerprintLength: factorsFingerprint([c, d, q]).length,
    },
    evaluatedAt: now,
    graph,
  };
}

/** Human-readable summary used by the credit result screen. */
export function evidenceSummary(result: EvidenceResult): string {
  if (result.eventCount === 0) {
    return "No verified evidence yet.";
  }
  const headline: Record<EvidenceStrength, string> = {
    none: "No meaningful economic evidence",
    limited: "Limited economic evidence",
    moderate: "Moderate economic evidence",
    strong: "Strong economic evidence",
  };
  return `${headline[result.strength]} across ${result.eventCount} verified event${result.eventCount === 1 ? "" : "s"}.`;
}

export { buildEvidenceGraph, graphFingerprint };
export type { EvidenceGraph };
