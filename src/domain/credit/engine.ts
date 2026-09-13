/**
 * Credit Engine.
 *
 *   creditIncrease = MAX_BATCH_INCREASE x evidenceScore
 *
 * Nothing here touches the database: the engine is a pure function so the exact
 * same code path runs in demo mode, live mode, the Farm Test and the unit tests.
 * Guardrails are enforced here, not in the UI and not in the provider.
 */
import { creditConfig } from "@/lib/config";
import { clamp } from "@/lib/money";
import type {
  CreditDecisionInput,
  CreditDecisionResult,
  CreditGuardrail,
} from "@/domain/types";

export const MAX_BATCH_INCREASE_USD_CENTS = creditConfig.maxBatchIncreaseUsdCents;

/** Theoretical increase before guardrails. Score 1.0 => $5,000. */
export function theoreticalIncreaseUsdCents(evidenceScore: number): number {
  const score = clamp(Number.isFinite(evidenceScore) ? evidenceScore : 0, 0, 1);
  return Math.round(MAX_BATCH_INCREASE_USD_CENTS * score);
}

export function decideCredit(input: CreditDecisionInput): CreditDecisionResult {
  const cfg = creditConfig;
  const blockedBy: CreditGuardrail[] = [];
  const guardrailNotes: string[] = [];

  const score = clamp(input.evidenceScore, 0, 1);
  const previousLimit = Math.max(0, Math.round(input.currentLimitUsdCents));
  const borrowed = Math.max(0, Math.round(input.borrowedUsdCents));

  // ---- Guardrails (order matters: the first hard block wins) ----------------
  if (input.evidenceHashAlreadyCredited) {
    blockedBy.push("duplicate_evidence_hash");
    guardrailNotes.push(
      "This exact evidence set has already been converted into credit. An event evaluated once cannot produce credit again.",
    );
  }
  if (input.newEventCount <= 0) {
    blockedBy.push("no_new_events");
    guardrailNotes.push(
      "No new verified economic events since the last evaluation, so there is no new evidence to underwrite.",
    );
  }
  if (input.verifiedEventCount < cfg.minEventsForCredit) {
    blockedBy.push("insufficient_events");
    guardrailNotes.push(
      `At least ${cfg.minEventsForCredit} verified economic events are required before credit can be considered (found ${input.verifiedEventCount}).`,
    );
  }
  if (
    input.lastCreditedEvaluationAt !== null &&
    input.now - input.lastCreditedEvaluationAt < cfg.evaluationCooldownMs
  ) {
    const remainingMs = cfg.evaluationCooldownMs - (input.now - input.lastCreditedEvaluationAt);
    blockedBy.push("cooldown_active");
    guardrailNotes.push(
      `Evaluation cooldown active. Another credited evaluation is available in ${Math.ceil(remainingMs / 1000)}s.`,
    );
  }
  if (input.staleEventCount > 0) {
    blockedBy.push("stale_events_excluded");
    guardrailNotes.push(
      `${input.staleEventCount} event(s) older than ${Math.round(cfg.staleEventMaxAgeMs / 86_400_000)} days were excluded from this evaluation.`,
    );
  }

  const hardBlocked =
    input.evidenceHashAlreadyCredited ||
    input.newEventCount <= 0 ||
    input.verifiedEventCount < cfg.minEventsForCredit ||
    blockedBy.includes("cooldown_active");

  const belowThreshold = score < cfg.minEvidenceThreshold;
  if (belowThreshold) {
    blockedBy.push("below_min_evidence_threshold");
    guardrailNotes.push(
      `Evidence score ${score.toFixed(4)} is below the minimum underwriting threshold of ${cfg.minEvidenceThreshold.toFixed(2)}. Activity was observed but it does not constitute economic evidence.`,
    );
  }

  const theoretical = theoreticalIncreaseUsdCents(score);
  const increase = hardBlocked || belowThreshold ? 0 : theoretical;

  if (increase === MAX_BATCH_INCREASE_USD_CENTS) {
    blockedBy.push("max_batch_increase_applied");
    guardrailNotes.push(
      `Per-evaluation increase capped at the batch maximum of $${(MAX_BATCH_INCREASE_USD_CENTS / 100).toLocaleString("en-US")}.`,
    );
  }

  const uncappedLimit = previousLimit + increase;
  const newLimit = Math.min(uncappedLimit, cfg.absoluteLimitCapUsdCents);
  if (newLimit < uncappedLimit) {
    blockedBy.push("absolute_cap_reached");
    guardrailNotes.push(
      `Overall credit limit cap of $${(cfg.absoluteLimitCapUsdCents / 100).toLocaleString("en-US")} reached; the increase was truncated.`,
    );
  }

  const finalIncrease = newLimit - previousLimit;
  const available = Math.max(0, newLimit - borrowed);
  const utilization = newLimit > 0 ? clamp(borrowed / newLimit, 0, 1) : 0;

  return {
    creditIncreaseUsdCents: finalIncrease,
    previousLimitUsdCents: previousLimit,
    newLimitUsdCents: newLimit,
    availableUsdCents: available,
    utilization: Math.round(utilization * 10_000) / 10_000,
    awarded: finalIncrease > 0,
    blockedBy,
    guardrailNotes,
    efficiency: MAX_BATCH_INCREASE_USD_CENTS > 0 ? clamp(finalIncrease / MAX_BATCH_INCREASE_USD_CENTS, 0, 1) : 0,
  };
}

/** Consumer-facing band. The raw float stays an internal underwriting variable. */
export function strengthLabel(score: number, eventCount: number): string {
  if (eventCount === 0 || score < 0.05) return "No verified evidence yet";
  if (score < 0.35) return "Limited economic evidence";
  if (score < 0.7) return "Moderate economic evidence";
  return "Strong economic evidence";
}
