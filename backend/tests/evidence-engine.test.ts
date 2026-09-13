/**
 * Economic Evidence Engine + Credit Engine unit tests.
 *
 * Run: npx tsx --test tests/evidence-engine.test.ts
 *
 * No database, no network: the engines are pure functions, which is exactly why
 * they can be tested this directly.
 */
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { combineDimensions, evaluateEvidence, strengthOf } from "../src/domain/evidence/engine";
import { decideCredit, theoreticalIncreaseUsdCents, MAX_BATCH_INCREASE_USD_CENTS } from "../src/domain/credit/engine";
import { validateBorrow, validateRepay, validateLimitUpdate, projectAccount } from "../src/domain/credit/account";
import { normalizeActivity, dedupeEvents } from "../src/domain/normalizer";
import { materializeScenario, demoRawTransactions } from "../src/providers/demo/fixtures";
import { creditConfig } from "../src/lib/config";
import type { CreditDecisionInput, EconomicEvent } from "../src/domain/types";

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const TOLERANCE = 1e-9;

function evaluate(scenario: "strong-history" | "manufactured-activity" | "empty-wallet" | "verification-in-progress" | "proof-detail") {
  const materialized = materializeScenario(scenario);
  return {
    materialized,
    result: evaluateEvidence({
      walletId: materialized.walletId,
      walletAddress: materialized.address,
      events: materialized.events,
      now: NOW,
    }),
  };
}

function decisionInput(overrides: Partial<CreditDecisionInput> = {}): CreditDecisionInput {
  return {
    evidenceScore: 0.8,
    currentLimitUsdCents: 0,
    borrowedUsdCents: 0,
    eventCount: 10,
    verifiedEventCount: 10,
    lastCreditedEvaluationAt: null,
    now: NOW,
    evidenceHashAlreadyCredited: false,
    newEventCount: 10,
    staleEventCount: 0,
    ...overrides,
  };
}

describe("S = C^0.45 x D^0.30 x Q^0.25", () => {
  test("matches the closed form within floating point tolerance", () => {
    const expected = Math.pow(0.7, 0.45) * Math.pow(0.55, 0.3) * Math.pow(0.9, 0.25);
    assert.ok(Math.abs(combineDimensions(0.7, 0.55, 0.9) - expected) < TOLERANCE);
  });

  test("is a geometric mean: the weakest dimension dominates", () => {
    const balanced = combineDimensions(0.6, 0.6, 0.6);
    const lopsided = combineDimensions(0.99, 0.99, 0.02);
    assert.ok(balanced > lopsided, "huge activity in two dimensions cannot rescue a near-zero third");
  });

  test("any zero dimension zeroes the score", () => {
    assert.equal(combineDimensions(0, 0.9, 0.9), 0);
    assert.equal(combineDimensions(0.9, 0, 0.9), 0);
    assert.equal(combineDimensions(0.9, 0.9, 0), 0);
  });

  test("perfect dimensions produce exactly 1", () => {
    assert.ok(Math.abs(combineDimensions(1, 1, 1) - 1) < TOLERANCE);
  });

  test("clamps out-of-range inputs", () => {
    assert.ok(Math.abs(combineDimensions(1.7, -0.4, 1) - 0) < TOLERANCE);
  });
});

describe("Credit engine", () => {
  test("score 1.0 => +$5,000", () => {
    assert.equal(theoreticalIncreaseUsdCents(1), MAX_BATCH_INCREASE_USD_CENTS);
    assert.equal(MAX_BATCH_INCREASE_USD_CENTS, 500_000);
    const decision = decideCredit(decisionInput({ evidenceScore: 1 }));
    assert.equal(decision.creditIncreaseUsdCents, 500_000);
    assert.equal(decision.newLimitUsdCents, 500_000);
    assert.equal(decision.awarded, true);
  });

  test("score 0.5 => +$2,500", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0.5 }));
    assert.equal(decision.creditIncreaseUsdCents, 250_000);
  });

  test("score 0.1 => +$500", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0.1 }));
    assert.equal(decision.creditIncreaseUsdCents, 50_000);
  });

  test("score 0 => +$0", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0 }));
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.equal(decision.awarded, false);
  });

  test("increase is linear in the evidence score", () => {
    for (const score of [0.05, 0.25, 0.5, 0.75, 1]) {
      const decision = decideCredit(decisionInput({ evidenceScore: score }));
      const expected = score < creditConfig.minEvidenceThreshold ? 0 : Math.round(500_000 * score);
      assert.equal(decision.creditIncreaseUsdCents, expected, `score ${score}`);
    }
  });
});

describe("Credit guardrails", () => {
  test("already-credited evidence hash cannot produce credit again", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0.9, evidenceHashAlreadyCredited: true }));
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.ok(decision.blockedBy.includes("duplicate_evidence_hash"));
  });

  test("no new events produces no credit", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0.9, newEventCount: 0 }));
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.ok(decision.blockedBy.includes("no_new_events"));
  });

  test("cooldown blocks a rapid re-evaluation", () => {
    const decision = decideCredit(
      decisionInput({ evidenceScore: 0.9, lastCreditedEvaluationAt: NOW - 5_000 }),
    );
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.ok(decision.blockedBy.includes("cooldown_active"));
  });

  test("cooldown expires", () => {
    const decision = decideCredit(
      decisionInput({ evidenceScore: 0.9, lastCreditedEvaluationAt: NOW - creditConfig.evaluationCooldownMs - 1 }),
    );
    assert.equal(decision.awarded, true);
  });

  test("below the minimum evidence threshold => zero increase", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: creditConfig.minEvidenceThreshold - 0.001 }));
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.ok(decision.blockedBy.includes("below_min_evidence_threshold"));
  });

  test("insufficient verified events blocks credit", () => {
    const decision = decideCredit(
      decisionInput({ evidenceScore: 0.9, verifiedEventCount: creditConfig.minEventsForCredit - 1 }),
    );
    assert.equal(decision.awarded, false);
    assert.ok(decision.blockedBy.includes("insufficient_events"));
  });

  test("absolute cap truncates the increase", () => {
    const decision = decideCredit(
      decisionInput({ evidenceScore: 1, currentLimitUsdCents: creditConfig.absoluteLimitCapUsdCents - 100_000 }),
    );
    assert.equal(decision.newLimitUsdCents, creditConfig.absoluteLimitCapUsdCents);
    assert.equal(decision.creditIncreaseUsdCents, 100_000);
    assert.ok(decision.blockedBy.includes("absolute_cap_reached"));
  });

  test("stale events are reported but do not silently inflate credit", () => {
    const decision = decideCredit(decisionInput({ evidenceScore: 0.9, staleEventCount: 4 }));
    assert.ok(decision.blockedBy.includes("stale_events_excluded"));
    assert.ok(decision.guardrailNotes.some((n) => n.includes("4 event(s)")));
  });
});

describe("Credit account arithmetic", () => {
  const state = { creditLimitUsdCents: 500_000, borrowedUsdCents: 120_000 };

  test("available = limit - borrowed and utilization = borrowed / limit", () => {
    const projected = projectAccount(state);
    assert.equal(projected.availableUsdCents, 380_000);
    assert.equal(projected.utilization, 0.24);
  });

  test("borrow within available credit succeeds and updates balances", () => {
    const next = validateBorrow(state, 100_000);
    assert.equal(next.borrowedUsdCents, 220_000);
    assert.equal(next.availableUsdCents, 280_000);
  });

  test("borrow exceeding available credit is rejected", () => {
    assert.throws(() => validateBorrow(state, 380_001), /available/);
  });

  test("borrow of zero or a negative amount is rejected", () => {
    assert.throws(() => validateBorrow(state, 0), /greater than zero/);
    assert.throws(() => validateBorrow(state, -500), /greater than zero/);
  });

  test("borrow against a zero limit is rejected", () => {
    assert.throws(() => validateBorrow({ creditLimitUsdCents: 0, borrowedUsdCents: 0 }, 100), /No credit limit/);
  });

  test("repay reduces borrowed and restores available credit", () => {
    const next = validateRepay(state, 120_000);
    assert.equal(next.borrowedUsdCents, 0);
    assert.equal(next.availableUsdCents, 500_000);
  });

  test("repay exceeding the outstanding balance is rejected", () => {
    assert.throws(() => validateRepay(state, 120_001), /exceeds the outstanding balance/);
  });

  test("repay with no outstanding balance is rejected", () => {
    assert.throws(() => validateRepay({ creditLimitUsdCents: 500_000, borrowedUsdCents: 0 }, 1), /no outstanding balance/i);
  });

  test("limit cannot be lowered below the borrowed balance", () => {
    assert.throws(() => validateLimitUpdate(state, 100_000, creditConfig.absoluteLimitCapUsdCents), /below the outstanding/);
  });

  test("limit cannot exceed the absolute cap", () => {
    assert.throws(
      () => validateLimitUpdate(state, creditConfig.absoluteLimitCapUsdCents + 1, creditConfig.absoluteLimitCapUsdCents),
      /absolute cap/,
    );
  });
});

describe("Capital Independence", () => {
  test("independently funded capital scores far higher than a single round-tripping source", () => {
    const strong = evaluate("strong-history").result;
    const farmed = evaluate("manufactured-activity").result;
    assert.ok(strong.capitalIndependence > 0.7, `strong C=${strong.capitalIndependence}`);
    assert.ok(farmed.capitalIndependence < 0.1, `farmed C=${farmed.capitalIndependence}`);
    assert.ok(strong.capitalIndependence > farmed.capitalIndependence * 5);
  });

  test("detects the shared funding hub and the round trip", () => {
    const farmed = evaluate("manufactured-activity").result;
    const signals = farmed.dimensions.capitalIndependence.signals as Record<string, number>;
    assert.equal(signals.independentFundingSources, 1);
    assert.equal(signals.fundingClusters, 1);
    assert.equal(signals.circularFundingShare, 1);
    assert.ok(signals.penaltyMultiplier < 0.2);
  });

  test("empty wallet has no capital independence", () => {
    assert.equal(evaluate("empty-wallet").result.capitalIndependence, 0);
  });
});

describe("Economic Diversity", () => {
  test("diverse counterparties, protocols and assets beat repeated transfers", () => {
    const strong = evaluate("strong-history").result;
    const farmed = evaluate("manufactured-activity").result;
    assert.ok(strong.economicDiversity > 0.6);
    assert.ok(farmed.economicDiversity < 0.15);
  });

  test("repeated transfers to one address do not inflate diversity", () => {
    const farmed = evaluate("manufactured-activity").result;
    const signals = farmed.dimensions.economicDiversity.signals as Record<string, number>;
    assert.equal(signals.uniqueCounterparties, 1);
    assert.ok(signals.effectiveCounterparties < 1.5, "six repeats saturate near one relationship");
    assert.equal(signals.uniqueProtocols, 0);
  });

  test("empty wallet scores zero, not a vacuous non-circular bonus", () => {
    assert.equal(evaluate("empty-wallet").result.economicDiversity, 0);
  });
});

describe("Behavioral Coherence", () => {
  test("a coherent economic sequence scores high", () => {
    const strong = evaluate("strong-history").result;
    assert.ok(strong.behavioralCoherence > 0.8);
    assert.match(
      String(strong.dimensions.behavioralCoherence.signals.matchedStages),
      /FUNDED.*EXCHANGED.*DEPOSITED.*BORROWED.*REPAID.*SETTLED_OUT/,
    );
  });

  test("circular metronomic activity scores near zero", () => {
    const farmed = evaluate("manufactured-activity").result;
    assert.ok(farmed.behavioralCoherence < 0.15, `farmed Q=${farmed.behavioralCoherence}`);
    const signals = farmed.dimensions.behavioralCoherence.signals as Record<string, number | boolean>;
    assert.equal(signals.cycleRatio, 1);
    assert.equal(signals.metronomic, true);
    assert.equal(signals.uniqueMotifs, 1);
  });

  test("empty wallet scores zero", () => {
    assert.equal(evaluate("empty-wallet").result.behavioralCoherence, 0);
  });
});

describe("Scenario outcomes", () => {
  test("strong history produces roughly $4,200 through the real formula", () => {
    const { materialized, result } = evaluate("strong-history");
    const decision = decideCredit(
      decisionInput({
        evidenceScore: result.evidenceScore,
        currentLimitUsdCents: materialized.fixture.startingCreditLimitUsdCents,
        newEventCount: result.eventCount,
        eventCount: result.eventCount,
        verifiedEventCount: result.verifiedEventCount,
      }),
    );
    assert.equal(result.strength, "strong");
    assert.ok(decision.awarded);
    const usd = decision.creditIncreaseUsdCents / 100;
    assert.ok(usd > 4_000 && usd < 4_400, `expected ~$4,200, got $${usd}`);
    // The number is derived, never hardcoded: it must equal MAX x S to the cent.
    assert.equal(decision.creditIncreaseUsdCents, Math.round(500_000 * result.evidenceScore));
  });

  test("manufactured activity: 6 transactions, $600 volume, no credit", () => {
    const { materialized, result } = evaluate("manufactured-activity");
    assert.equal(result.eventCount, 6);
    assert.equal(materialized.volumeUsdCents, 60_000);
    const decision = decideCredit(
      decisionInput({
        evidenceScore: result.evidenceScore,
        newEventCount: result.eventCount,
        eventCount: result.eventCount,
        verifiedEventCount: result.verifiedEventCount,
      }),
    );
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.equal(decision.awarded, false);
    assert.ok(result.evidenceScore < creditConfig.minEvidenceThreshold);
  });

  test("more activity does not mean more credit", () => {
    const strong = evaluate("strong-history").result;
    const farmed = evaluate("manufactured-activity").result;
    assert.equal(farmed.eventCount, 6);
    assert.equal(strong.eventCount, 11);
    assert.ok(strong.evidenceScore > farmed.evidenceScore * 8);
  });

  test("empty wallet: no evidence, no score, no credit increase", () => {
    const { result } = evaluate("empty-wallet");
    assert.equal(result.eventCount, 0);
    assert.equal(result.evidenceScore, 0);
    assert.equal(result.strength, "none");
    const decision = decideCredit(decisionInput({ evidenceScore: 0, eventCount: 0, verifiedEventCount: 0, newEventCount: 0 }));
    assert.equal(decision.creditIncreaseUsdCents, 0);
    assert.ok(decision.blockedBy.includes("no_new_events"));
  });

  test("verification in progress distinguishes verified from pending events", () => {
    const { result } = evaluate("verification-in-progress");
    assert.equal(result.eventCount, 6);
    assert.equal(result.verifiedEventCount, 3);
    assert.ok(result.verifiedEventCount < result.eventCount);
  });

  test("strength bands are consumer-facing labels, not raw floats", () => {
    assert.equal(strengthOf(0, 0), "none");
    assert.equal(strengthOf(0.2, 5), "limited");
    assert.equal(strengthOf(0.5, 5), "moderate");
    assert.equal(strengthOf(0.9, 5), "strong");
  });
});

describe("Determinism and reproducibility", () => {
  test("the same events always produce the same score and evidence hash", () => {
    const first = evaluate("strong-history").result;
    const second = evaluate("strong-history").result;
    assert.equal(first.evidenceScore, second.evidenceScore);
    assert.equal(first.evidenceHash, second.evidenceHash);
    assert.equal(first.capitalIndependence, second.capitalIndependence);
    assert.equal(first.economicDiversity, second.economicDiversity);
    assert.equal(first.behavioralCoherence, second.behavioralCoherence);
  });

  test("event ordering does not change the result", () => {
    const materialized = materializeScenario("strong-history");
    const shuffled = [...materialized.events].sort(() => -1);
    const a = evaluateEvidence({ walletId: materialized.walletId, walletAddress: materialized.address, events: materialized.events, now: NOW });
    const b = evaluateEvidence({ walletId: materialized.walletId, walletAddress: materialized.address, events: shuffled, now: NOW });
    assert.equal(a.evidenceScore, b.evidenceScore);
    assert.equal(a.evidenceHash, b.evidenceHash);
  });

  test("adding an event changes the evidence hash (duplicate detection)", () => {
    const materialized = materializeScenario("strong-history");
    const base = evaluateEvidence({ walletId: materialized.walletId, walletAddress: materialized.address, events: materialized.events, now: NOW });
    const extended = evaluateEvidence({
      walletId: materialized.walletId,
      walletAddress: materialized.address,
      events: [...materialized.events, { ...materialized.events[0], id: `${materialized.events[0].id}_extra` }],
      now: NOW,
    });
    assert.notEqual(base.evidenceHash, extended.evidenceHash);
  });
});

describe("Normalizer", () => {
  test("raw chain data normalizes into the same events every time", () => {
    const raw = demoRawTransactions("strong-history");
    const first = normalizeActivity({ walletId: "wal_x", walletAddress: raw[0].from, transactions: raw });
    const second = normalizeActivity({ walletId: "wal_x", walletAddress: raw[0].from, transactions: raw });
    assert.deepEqual(first.events.map((e) => e.id), second.events.map((e) => e.id));
    assert.equal(first.events.length, 11);
  });

  test("duplicate raw transactions collapse onto one economic event", () => {
    const raw = demoRawTransactions("strong-history");
    const doubled = [...raw, ...raw];
    const { events } = normalizeActivity({ walletId: "wal_x", walletAddress: raw[0].from, transactions: doubled });
    assert.equal(dedupeEvents(events).length, raw.length);
  });

  test("reverted and zero-value transactions carry no economic meaning", () => {
    const raw = demoRawTransactions("strong-history");
    const reverted = raw.map((t, i) => (i === 0 ? { ...t, status: "REVERTED" as const } : t));
    const { events, skipped } = normalizeActivity({ walletId: "wal_x", walletAddress: raw[0].from, transactions: reverted });
    assert.equal(events.length, raw.length - 1);
    assert.ok(skipped.some((s) => s.reason === "transaction_reverted"));
  });

  test("sequence numbers follow chronological order", () => {
    const raw = [...demoRawTransactions("strong-history")].reverse();
    const { events } = normalizeActivity({ walletId: "wal_x", walletAddress: raw[0].from, transactions: raw });
    for (let i = 1; i < events.length; i += 1) {
      assert.ok(events[i].timestamp >= events[i - 1].timestamp);
      assert.equal(events[i].sequence, i);
    }
  });

  test("amounts convert from raw units using decimals and price", () => {
    const events = normalizeActivity({
      walletId: "wal_x",
      walletAddress: "0x0000000000000000000000000000000000000001",
      transactions: demoRawTransactions("strong-history"),
    }).events as EconomicEvent[];
    const stake = events.find((e) => e.type === "STAKE");
    assert.ok(stake);
    assert.equal(stake!.amountUsdCents, 71_400); // 0.30 stETH @ $2,380
  });
});
