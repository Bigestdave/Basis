# Economic Evidence Engine

The intellectual core of BASIS. It is **deterministic, explainable, testable and
reproducible**. It is not an LLM, not a trained model and not a black box: every
number it produces can be recomputed by reading
`src/domain/evidence/{graph,dimensions,engine}.ts`.

```
S = C^0.45 × D^0.30 × Q^0.25

C = Capital Independence     how independent was the capital?
D = Economic Diversity       how economically varied was the activity?
Q = Behavioral Coherence     does the sequence make economic sense?
```

All three dimensions are normalised to `[0, 1]`.

## Why a geometric mean

A weighted **arithmetic** mean lets a wallet compensate for a near-zero dimension
by manufacturing volume in another. The geometric mean does not: if any dimension
is 0, `S` is 0. This is the single most important design decision in the engine and
it is what makes BASIS different from an activity score.

```
balanced  C=D=Q=0.60        → S = 0.600
lopsided  C=0.99 D=0.99 Q=0.02 → S = 0.117   ← volume cannot rescue incoherence
```

## Eligible events

Only **verified** events that have **never been credited** and are **not stale**
enter an evaluation:

```
verified = true                       (Attestcoin proved inclusion)
creditedAt IS NULL                    (never produced credit before)
timestamp >= now - staleEventMaxAge   (default 730 days)
```

The normalizer additionally drops anything with no economic meaning: reverted
transactions, zero-value transfers, contract creations, and transactions where the
wallet is not a party. Not every blockchain transaction becomes an economic event.

---

## C — Capital Independence

Builds a funding graph (`src/domain/evidence/graph.ts`). Nodes are the subject
wallet, funders, counterparties and protocols; edges are `funded`, `transferred`,
`received` and `protocol-call`.

**What counts as a funding source.** Any *inbound* value from outside the wallet
whose event type is `FUNDING`, `TRANSFER` or `PAYMENT` **and** which has no
protocol label. Plain transfers count — capital that arrives as a transfer is still
capital. Protocol inflows (`BORROW`, `REWARD`, `WITHDRAW`) are deliberately
excluded: borrowed money is leverage, not independent capital, and including it
would let a wallet buy evidence with debt.

**Signals.**

| Signal | Meaning |
| --- | --- |
| `independentFundingSourceCount` | sources with ≥5% of inflow and ≥$10 |
| `fundingClusterCount` | distinct clusters those sources belong to |
| `averageFundingDepth` | inflow-weighted hops from an independent origin |
| `inflowEvenness` | `(1 − HHI) / (1 − 1/n)`, i.e. how evenly inflow is spread |
| `selfFundingShare` | inflow from the wallet's own cluster |
| `circularFundingShare` | inflow from addresses the wallet also sends value back to |

**Formula.**

```
sourceScore  = 1 − exp(−n / 1.2)
clusterScore = 1 − exp(−clusters / 1.5)
depthScore   = 1 − exp(−avgDepth / 3.0)

C_raw = 0.40·sourceScore + 0.20·clusterScore + 0.15·depthScore + 0.25·inflowEvenness

penalty = singleSourceMultiplier            (0.45 when n ≤ 1, else 1)
        × (1 − 0.50·selfFundingShare)
        × (1 − 0.50·circularFundingShare)

C = clamp(C_raw × penalty, 0, 1)
```

**The key insight.** If 40 wallets all receive funds from the same hub and then
perform similar activity, each of them has `n = 1`, one cluster, `inflowEvenness = 0`
and a `singleSourceMultiplier` of 0.45 — and if the hub is also a transfer
counterparty, `circularFundingShare = 1` halves the result again. They do not
receive the evidence benefit of independently funded activity.

---

## D — Economic Diversity

```
effectiveCounterparties = Σ_c (1 − exp(−count_c / 1.5))
```

Repeating an interaction with the same address **saturates** instead of stacking,
so `A → B` six times never looks as diverse as six distinct relationships.

```
D = 0.22·(1 − exp(−effectiveCounterparties / 6.0))
  + 0.18·(1 − exp(−uniqueProtocols / 2.5))
  + 0.14·(1 − exp(−uniqueAssets / 4.5))
  + 0.26·actionFamilyCoverage
  + 0.20·nonCircularShare
```

`actionFamilyCoverage` weights economically distinct behaviour, not transaction
count: `CREDIT` 2.0, `SWAP` 1.5, `DEPOSIT` 1.5, `PAYMENT` 1.5, `FUNDING` 1.0,
`TRANSFER` 1.0, `WITHDRAW` 1.0, `REWARD` 0.5 — divided by the total (10.0).

`nonCircularShare = 1 − cycleRatio` (see Q). With no events at all it is **0**, not
a vacuous 1.

---

## Q — Behavioral Coherence

**Canonical economic life-cycle** (greedy forward match over the chronological
timeline):

```
FUNDED → EXCHANGED → DEPOSITED → BORROWED → REPAID → SETTLED_OUT
```

`motifScore = matchedStages / distinctStagesPresent`, so a wallet is scored on the
correct ordering of the stages it actually used.

**Cycle detection (wash trading).** Only plain `TRANSFER` and `PAYMENT` flows are
considered. A DeFi deposit and a borrow against it with the same protocol is a
*credit cycle*, not a round trip, so protocol interactions are deliberately
excluded — otherwise every legitimate lending user would be penalised.

```
cycleRatio = Σ (2 × min(outflow, inflow)) / totalTransferAndPaymentValue
```

**Motif repetition.** Each event is reduced to `type | counterpartyCluster |
log10(amount)`; `repetitionRate = 1 − uniqueMotifs / eventCount`. A dominant
bigram (one transition accounting for >40% of all transitions) additionally scales
the motif term down — this is what catches `A→B, B→A, A→B, B→A`.

**Timing entropy.** Inter-event gaps are bucketed at 60s / 10m / 1h / 6h / 1d / 7d
and scored with normalised Shannon entropy. A metronome (≥4 events and entropy
<0.2) is penalised, as are scripted gaps (<5s).

**Credit-cycle coherence.** Repayments must follow a borrow, must not be instant
(<10 minutes after the borrow — a manufactured motif), and total repaid is compared
against total borrowed. Neutral (0.5) when the wallet has no credit events.

```
Q_raw = 0.30·motifScore·bigramPenalty + 0.18·timingEntropy
      + 0.22·(1 − repetitionRate) + 0.18·(1 − cycleRatio)
      + 0.12·creditCycleCoherence

structuralPenalty = (1 − 0.50·cycleRatio)
                  × (metronomic ? 0.70 : 1)
                  × (1 − 0.50·scriptedShare)

Q = clamp(Q_raw × structuralPenalty, 0, 1)
```

With **no events**, `Q = 0` — every component is vacuous.

---

## Supporting statistics

Used internally as signals, never as the headline story: inflow Herfindahl index,
inflow evenness, normalised timing entropy, motif/bigram repetition, cycle
detection over the funding-and-transfer graph, funding depth. The three headline
dimensions remain Capital Independence, Economic Diversity and Behavioral
Coherence.

---

## Explanation, not just a number

Each dimension returns a value, a sentence and its signals:

```jsonc
{
  "capitalIndependence": {
    "value": 0.8619,
    "explanation": "Activity was funded by 3 independent sources across 3 funding clusters at an average depth of 2.3 hop(s).",
    "signals": { "independentFundingSources": 3, "fundingClusters": 3, "inflowEvenness": 0.9633, "circularFundingShare": 0, "penaltyMultiplier": 1 }
  },
  "economicDiversity": { "value": 0.7424, "explanation": "Activity involved 8 unique counterparties across 3 protocols and 4 assets, covering 6 of 8 economic action families.", "signals": { … } },
  "behavioralCoherence": { "value": 0.9414, "explanation": "Activity contains multiple economically distinct actions in a coherent order (FUNDED → EXCHANGED → DEPOSITED → BORROWED → REPAID → SETTLED_OUT), with 10 distinct motifs across 11 events and limited repetition.", "signals": { … } },
  "finalEvidenceScore": 0.8425
}
```

The raw float is an internal underwriting variable. Consumer-facing surfaces get a
band: `strong` ≥0.70, `moderate` ≥0.35, `limited` ≥0.05, otherwise `none` — rendered
as "Strong economic evidence" / "Moderate…" / "Limited…" / "No verified evidence yet".

---

## Credit conversion

```
creditIncrease = MAX_BATCH_INCREASE × S        (MAX_BATCH_INCREASE = $5,000)
```

`S = 1.0 → $5,000` · `S = 0.5 → $2,500` · `S = 0.1 → $500`. Rounded to integer
cents. No result anywhere in BASIS is hardcoded; the demo's ~$4,200 is
`5000 × 0.8425`.

### Guardrails (`src/domain/credit/engine.ts`)

| Guardrail | Effect |
| --- | --- |
| `duplicate_evidence_hash` | identical evidence set already credited → `$0` |
| `no_new_events` | no uncredited verified events → `$0` |
| `insufficient_events` | fewer than `CREDIT_MIN_EVENTS` (3) verified events → `$0` |
| `cooldown_active` | last credited decision within `CREDIT_EVALUATION_COOLDOWN_MS` → `$0` |
| `below_min_evidence_threshold` | `S < CREDIT_MIN_EVIDENCE_THRESHOLD` (0.10) → `$0` |
| `stale_events_excluded` | reported; stale events never enter the evaluation |
| `absolute_cap_reached` | limit truncated at `CREDIT_ABSOLUTE_CAP_USD` ($50,000) |
| `max_batch_increase_applied` | per-evaluation ceiling reached |

Blocked decisions are still **recorded** with their reasons, so "no increase" is an
auditable outcome rather than a silent no-op.

### Account invariants (`src/domain/credit/account.ts`)

```
available   = max(0, creditLimit − borrowed)
utilization = borrowed / creditLimit
```

Rejected: `amount ≤ 0`, non-finite amounts, borrow > available, repay > borrowed,
repay with no balance, limit above the absolute cap, limit below the outstanding
balance, borrowed > limit.

---

## Calibration

`npx tsx scripts/calibrate.ts` prints C, D, Q, S and the resulting credit for every
seeded scenario. Current output (engine v1.0.0):

| Scenario | events | volume | C | D | Q | S | credit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| strong history | 11 | $7,664 | 0.8619 | 0.7424 | 0.9414 | **0.8425** | **+$4,212.50** |
| manufactured | 6 | $600 | 0.0412 | 0.0871 | 0.0338 | **0.0491** | **+$0** |
| empty wallet | 0 | $0 | 0 | 0 | 0 | 0 | +$0 |
| verification in progress | 6 (3 verified) | $1,920 | — | — | — | pending | pending |
| proof detail | 7 | $4,250 | 0.7672 | 0.6266 | 0.9173 | 0.7550 | +$3,775.00 |

All tunable constants live in one table — `EVIDENCE_WEIGHTS` in
`src/domain/evidence/dimensions.ts` — and thresholds in `src/lib/config.ts`
(env-overridable). Changing a constant and re-running the calibrator is the
intended workflow; the strong-history scenario is tuned to land near $4,200
**through the formula**, never by editing an output.

The same numbers are asserted by `tests/evidence-engine.test.ts` (51 tests) and
`tests/integration.test.ts`, including `creditIncrease === round(500000 × S)`.
