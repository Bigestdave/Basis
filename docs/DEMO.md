# Demo mode

`APP_MODE=demo` is the default and requires **no external services** — no RPC, no
Attestcoin, no Creditcoin, no network access at all. It is not a set of static
screenshots: connecting a wallet, syncing history, attesting, evaluating, deciding,
borrowing and repaying all execute for real against PostgreSQL, through the exact
same pipeline, engines and guardrails as live mode. Only the injected providers
differ.

```bash
cp .env.example .env     # APP_MODE=demo is already the default
npx drizzle-kit push
npx tsx scripts/seed.ts
npm run dev
```

## Determinism

Demo data is **fixed constants**. `Math.random()` is not used anywhere in the
codebase. Addresses, tx hashes, block hashes, calldata, topics, Merkle roots and
continuity digests are derived with `deterministicHex(seed, bytes)` /
`deterministicAddress` / `deterministicTxHash` from `src/lib/deterministic.ts`, and
timestamps are fixed offsets from `DEMO_EPOCH_MS` (2026-01-05T09:00:00Z). Restart
the server, reseed, run the tests — the numbers are identical.

Critically, the credit numbers in the demo are **produced by the engine**, not
authored. The seeder ingests, attests and normalises events through the real
pipeline; the ~$4,200 in the strong-history scenario is `5000 × S` where
`S = C^0.45 × D^0.30 × Q^0.25 = 0.8425` computed from the seeded events.

## The five scenarios

`GET /api/settings` returns all five with their addresses, so the demo switcher can
be built from the backend rather than hardcoded.

| Key | Label | What it demonstrates |
| --- | --- | --- |
| `strong-history` | Strong economic history | 3 independent funding sources → swap → DeFi deposit → borrow → partial repay → transfer to a distinct counterparty → second protocol → payment → second repayment. 11 events, $7,664 volume. **S = 0.8425 → +$4,212.50** |
| `manufactured-activity` | Manufactured activity | `A→B, B→A, A→B, B→A, A→B, B→A` — **6 transactions, $600 volume**, one counterparty that also funded the wallet, on a metronomic 10-minute interval. **S = 0.0491 → +$0** |
| `empty-wallet` | Empty wallet | No transactions, no attestations, no evidence, no score, no credit increase. Nothing is invented. |
| `verification-in-progress` | Verification in progress | 6 events, 3 verified and 3 awaiting attestation — the job sits in `VERIFYING` and only verified events can produce credit. |
| `proof-detail` | Attestcoin proof detail | A credited history whose attestations expose the full technical proof object. Seeded with a real evaluation, a real decision and a real $300 draw. |

### The manufactured-activity result

```
C = 0.0412   one funding source, one cluster, depth 1,
             100% of inflow from an address the wallet sends value back to
D = 0.0871   one counterparty, zero protocols, one asset, 1 of 8 action families,
             100% of transfer value flowing in circles
Q = 0.0338   one distinct motif across 6 events, cycleRatio 1.0, metronomic timing
S = 0.0491   below the 0.10 threshold → blockedBy: below_min_evidence_threshold
```

```
headline: "More activity didn't mean more credit."
detail:   "You created activity. You didn't create economic evidence."
```

That is the product's whole thesis in one screen, and every digit comes from the
engine.

## Logging in

Two equivalent paths, both running real signature verification:

```bash
# explicit: nonce → sign → verify
curl -sX POST localhost:3000/api/auth/nonce -H 'content-type: application/json' \
  -d '{"address":"0x22c3a77c4de8c1294952a94026eb5c219559e226"}'
curl -sX POST localhost:3000/api/auth/demo-sign -H 'content-type: application/json' \
  -d '{"address":"0x22c3…","message":"<the message from the previous call>"}'
curl -sX POST localhost:3000/api/auth/verify -c /tmp/c -H 'content-type: application/json' \
  -d '{"address":"0x22c3…","signature":"0x…","nonce":"…"}'

# one call (does all three server-side)
curl -sX POST localhost:3000/api/auth/demo -c /tmp/c -H 'content-type: application/json' \
  -d '{"scenarioKey":"strong-history"}'
```

`/api/auth/demo` is **not a bypass**: it issues a real single-use nonce, signs the
exact challenge message with the deterministic demo signer, verifies that signature
server-side and creates a real session. The only substitution is the signer, because
a simulated wallet has no private key. `DemoSignatureVerifier` refuses any address
that is not a BASIS demo wallet and is disabled entirely when `APP_MODE=live`.

## The full demo flow

```bash
curl -sX POST localhost:3000/api/auth/demo -c /tmp/c -H 'content-type: application/json' \
     -d '{"scenarioKey":"strong-history"}'
curl -sb /tmp/c localhost:3000/api/activity                 # 11 seeded events
curl -sb /tmp/c localhost:3000/api/evidence                 # events + summary
curl -sb /tmp/c localhost:3000/api/evidence/<eventId>       # + attestation proof object
curl -sX POST localhost:3000/api/evidence/evaluate -b /tmp/c -H 'content-type: application/json' -d '{}'
curl -sb /tmp/c localhost:3000/api/jobs/<jobId>             # poll: status/progress/steps
curl -sb /tmp/c localhost:3000/api/credit                   # limit ≈ $4,212.50
curl -sX POST localhost:3000/api/credit/borrow -b /tmp/c -H 'content-type: application/json' -d '{"amountUsd":500}'
curl -sX POST localhost:3000/api/credit/repay  -b /tmp/c -H 'content-type: application/json' -d '{"amountUsd":200}'
curl -sb /tmp/c localhost:3000/api/activity                 # unchanged events; credit ledger updated
curl -sb /tmp/c localhost:3000/api/audit                    # full trail
```

Re-running `POST /api/evidence/evaluate` awards **$0** and reports
`duplicate_evidence_hash` / `no_new_events` / `cooldown_active` — the guardrails are
part of the demo, not an edge case.

## Farm Test

```bash
curl -sX POST localhost:3000/api/farm-test/run -H 'content-type: application/json' -d '{"scenario":"manufactured"}'
curl -sX POST localhost:3000/api/farm-test/run -H 'content-type: application/json' -d '{"scenario":"genuine"}'
```

Both run the real pipeline against sandbox wallets (`wal_farm_manufactured`,
`wal_farm_genuine`) which are reset at the start of each run. Results are
reproducible, and a Farm Test can never mutate a user's real credit account.
`manufactured` → 6 activities, $600 volume, +$0. `genuine` → 11 activities, +$4,212.50.

## Environment indicator

`GET /api/settings` returns `appMode` and `environmentLabel` (`"Demo"` /
`"Live / Testnet"`) so the UI can show a subtle indicator. Provider descriptors
(`chainData`, `attestation`, `credit`, `signer`) each carry `available` and an
honest `notes` string — including exactly what is *not* wired up.

## What demo mode does not do

It never fabricates functionality. There is no button that changes `$10,000` into
`$14,200`; every change in credit state is the result of an `evidence_evaluations`
row, a `credit_decisions` row, a `credit_transactions` row and an `audit_logs` row.
The demo provider returns `settled: true` with `detail.simulated = true` and a note
explaining that no chain transaction was submitted — it does not claim an on-chain
settlement that did not happen.
