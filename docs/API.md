# BASIS API

Base URL: `/api`. All responses use one envelope.

```jsonc
// success
{ "data": { … }, "meta": { … } }        // meta is optional
// failure
{ "error": { "code": "borrow_exceeds_available", "message": "…", "details": { … } } }
```

Authentication: `POST /api/auth/verify` (or `POST /api/auth/demo`) sets an
`HttpOnly` `basis_session` cookie. `Authorization: Bearer <token>` is also accepted.
Endpoints marked 🔒 require a session with an attached wallet.

Money is always returned as `{ "cents": 421250, "usd": 4212.5, "display": "$4,212.50" }`.
Technical identifiers (`txHash`, `merkleRoot`, `evidenceHash`, …) are returned
verbatim for monospace rendering.

---

## Environment

### `GET /api/health`
Liveness plus database reachability, app mode and engine versions.

### `GET /api/settings`
Everything the client needs to render the environment: `appMode`,
`environmentLabel` (`"Demo"` / `"Live / Testnet"`), credit configuration
(`maxBatchIncrease`, `absoluteCap`, `minEvidenceThreshold`, `evaluationCooldownMs`),
the evidence formula and exponents, supported networks with `rpcConfigured` and
`attestcoinChainKey`, provider descriptors, the five demo scenarios (with address,
walletId, chainKeys, activityCount, volume) and the Farm Test scenario keys.
`?includeProviders=false` omits the provider block.

---

## Authentication

### `POST /api/auth/nonce`
`{ "address": "0x…" }` → `201 { nonce, message, address, expiresAt, mode }`
Sign `message` with `personal_sign`.

### `POST /api/auth/verify`
`{ "address", "signature", "nonce" }` → `200` + session cookie, returning
`{ session, user, wallet, wallets, credit }`.
Errors: `nonce_unknown`, `nonce_reused`, `nonce_expired`, `signature_invalid`,
`wallet_unsupported`.

### `POST /api/auth/demo`
`{ "scenarioKey": "strong-history" }` → one-call demo login. Runs the *real*
nonce → sign → verify → session flow, substituting only the signer because a
simulated wallet has no private key. Rejects non-demo addresses.

### `POST /api/auth/demo-sign`
`{ "address", "message" }` → `{ signature, signerType }`. Demo wallets only;
disabled when `APP_MODE=live`.

### `POST /api/auth/logout` 🔒
Revokes the session and clears the cookie.

### `GET /api/me` 🔒
Bootstrapping payload: user, session, current wallet, all wallets, full credit
view and the latest evidence evaluation.

---

## Wallets and networks

### `GET /api/wallets` 🔒 · `POST /api/wallets` 🔒
`POST { address, label?, chainKeys? }` → `201 { walletId, address, isDemo, scenarioKey, chainKeys, wallets }`

### `GET /api/wallets/:id` 🔒 · `DELETE /api/wallets/:id` 🔒
`GET` returns the wallet with its selected networks and credit view.
`DELETE` disconnects (revokes connections, clears the session's wallet).

### `GET /api/networks` (🔒 optional)
Registry from `CHAINS` merged with stored rows: `key, chainId, name, family,
enabled, rpcConfigured, attestcoinChainKey, selected, explorerTxTemplate`.

### `POST /api/networks/connect` 🔒
`{ walletId?, chainKeys: ["ethereum-sepolia", …] }` → enables those networks for
the wallet. Unknown keys → `chain_unsupported` (409).

---

## Evidence

### `GET /api/evidence` 🔒
`{ events[], summary{eventCount,verifiedCount,pendingCount,volumeCents,creditedCount},
latest, evaluations[], credit, strengthLabel, empty }`

### `GET /api/evidence/:id` 🔒
Single economic event for the detail view: network, block, transaction, from/to,
asset, amount, timestamp, `verified`, the full Attestcoin `attestation` object
(`merkleRoot`, `merkleSiblings`, `continuityLowerEndpointDigest`, `continuityRoots`,
`txBytes`, `verifier`, `proofReference`, `txIndex`) and `interpretation`.

### `POST /api/evidence/sync` 🔒
`{ walletId?, chainKeys? }` → `202 { job, chainKeys }`. Fetches, proves, attests
and normalises **without** producing a credit decision.

### `POST /api/evidence/evaluate` 🔒
`{ walletId?, chainKeys?, idempotencyKey? }` → `202 { job, pollUrl, message }`.
Runs the full Build Credit pipeline. The client polls `pollUrl`.

### `GET /api/evaluations` 🔒 · `GET /api/evaluations/:id` 🔒
`:id` returns `{ evaluation, factors[], decision, contributingEvents[] }` — the
credit result screen's data source.

---

## Jobs

### `GET /api/jobs` 🔒 · `GET /api/jobs/:id` 🔒
`{ job: { id, type, status, progress, currentStep, steps[{step,status,detail,metrics}],
error, errorCode, resultReference }, result? }`
On completion `result` carries `{ evaluationId, decisionId, evidence, credit, summary }`.

### `POST /api/jobs/reap` 🔒
Fails and unlocks jobs whose worker died. Returns `{ reaped }`.

---

## Credit

### `GET /api/credit` 🔒
`{ account, latestDecision, decisions[], transactions[], positions[], evidence }`
`account` contains `creditLimit`, `borrowed`, `available`, `utilization`,
`utilizationPercent`, `status`, `totalAwarded`, `totalRepaid`, `onchain`.
**Clients must not recompute any of these.**

### `POST /api/credit/borrow` 🔒
`{ amountUsd, idempotencyKey? }` → `201 { positionId, transactionId, amount,
settlement, credit }` (the refreshed credit view, so the UI updates immediately).
Errors: `borrow_amount_invalid`, `borrow_exceeds_available`, `credit_account_missing`,
`duplicate_transaction`.

### `POST /api/credit/repay` 🔒
`{ amountUsd, positionId?, idempotencyKey? }` → `201 { repaymentId, transactionId,
amount, settlement, credit }`. Repayments are applied FIFO to open positions.
Errors: `repay_amount_invalid`, `repay_exceeds_borrowed`, `duplicate_transaction`.

---

## Activity

### `GET /api/activity` 🔒
`?limit=&type=&chainKey=&verifiedOnly=` → `{ items[], total }`.
Items are the same `EconomicEvent` rows that power Home, Evidence and the Farm
Test — there is no separate activity array anywhere.

---

## Farm Test

### `GET /api/farm-test/scenarios`
`{ scenarios: [{ key, label, description, narrative, expectation, activityCount, volume, walletId }] }`

### `POST /api/farm-test/run`
`{ "scenario": "manufactured" | "genuine" }` → `201`
```jsonc
{
  "scenarioKey": "manufactured",
  "activityCount": 6,
  "verifiedActivityCount": 6,
  "volumeUsdCents": 60000,
  "evidence": {
    "evidenceScore": 0.0491,
    "strength": "none",
    "capitalIndependence": 0.0412,
    "economicDiversity": 0.0871,
    "behavioralCoherence": 0.0338,
    "explanations": { "capitalIndependence": "…", "economicDiversity": "…", "behavioralCoherence": "…" }
  },
  "creditBeforeUsdCents": 0,
  "creditIncreaseUsdCents": 0,
  "creditAfterUsdCents": 0,
  "awarded": false,
  "blockedBy": ["below_min_evidence_threshold"],
  "headline": "More activity didn't mean more credit.",
  "detail": "You created activity. You didn't create economic evidence. …",
  "evaluationId": "evl_…", "decisionId": "dcs_…", "jobId": "job_…",
  "events": [ … ]
}
```
The backend owns every number. Runs execute against a sandbox wallet
(`wal_farm_<scenario>`) that is reset first, so results are reproducible and a
Farm Test can never mutate a user's real credit account.

---

## Audit

### `GET /api/audit` 🔒
`?limit=` → `{ items: [{ id, action, result, referenceId, metadata, createdAt }] }`

---

## Error codes

| Group | Codes | HTTP |
| --- | --- | --- |
| wallet/auth | `wallet_rejected` `wallet_unsupported` `wrong_network` `signature_invalid` `nonce_expired` `nonce_unknown` `nonce_reused` `unauthenticated` `session_expired` `forbidden` | 400–403 |
| mode | `demo_mode_only` `live_mode_only` | 403/409 |
| validation | `validation_error` `not_found` `conflict` `rate_limited` | 400/404/409/429 |
| chain | `rpc_unavailable` `chain_unsupported` `transaction_not_found` | 409/502 |
| attestation | `attestation_unavailable` `attestation_failed` `attestation_pending` | 202/502 |
| evidence | `insufficient_evidence` `no_new_events` `evaluation_cooldown` `stale_events` `duplicate_evaluation` | 409 |
| credit | `credit_account_missing` `borrow_exceeds_available` `borrow_amount_invalid` `repay_exceeds_borrowed` `repay_amount_invalid` `credit_limit_exceeded` `credit_update_failed` `duplicate_transaction` | 400/404/409 |
| infra | `database_failure` `job_failed` `job_timeout` `job_not_found` `internal_error` | 404/500 |

`attestation_pending` uses **202** so a client can distinguish "still verifying"
from "failed".
