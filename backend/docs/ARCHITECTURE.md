# BASIS architecture

```
USER
  ↓
BASIS FRONTEND  (separate app; consumes the HTTP API)
  ↓
API / APPLICATION SERVER  (Next.js App Router route handlers)
  ↓
┌──────────────────────────────────────────────────────────┐
│ Authentication        src/services/auth.ts               │
│ Wallet service        src/services/wallets.ts            │
│ Chain data service    src/providers/*/chain-data         │
│ Attestcoin verify     src/providers/live/attestcoin.ts   │
│ Evidence normalizer   src/domain/normalizer.ts           │
│ Economic evidence     src/domain/evidence/*              │
│ Credit engine         src/domain/credit/*                │
│ Creditcoin settle     src/providers/live/creditcoin.ts   │
│ Job pipeline          src/services/jobs.ts + pipeline.ts │
│ Audit                 src/services/audit.ts              │
└──────────────────────────────────────────────────────────┘
  ↓
PostgreSQL (Drizzle)     src/db/schema.ts
```

## The separation that matters

| Layer | Question it answers | Modules |
| --- | --- | --- |
| **Facts** | what happened on chain? | `raw_transactions`, `raw_logs`, chain-data providers |
| **Verification** | did Attestcoin prove it happened? | `attestations`, attestation providers |
| **Interpretation** | what does it mean economically? | `economic_events`, normalizer, evidence engine |
| **Decision** | how much credit does that evidence support? | `evidence_evaluations`, `credit_decisions`, credit engine |
| **State** | what is the account now? | `credit_accounts`, `credit_transactions`, `borrow_positions` |

A fact is never rewritten by an interpretation, and an interpretation never
rewrites a decision. Every credit decision stores the `evidenceHash` of the exact
event set that produced it, so any number in the product can be traced back to the
transactions that justify it.

## Provider seams

`src/providers/index.ts` is the **only** module that branches on `APP_MODE`.

```ts
interface ChainDataProvider   { getWalletActivity, getTransaction, getReceipt,
                                getBlock, getTimestamp, getLogs, getTokenTransfers,
                                getFundingGraph, getSupportedChains }
interface AttestationProvider { verifyEvent, verifyOrdering, getVerification }
interface CreditProvider      { getAccount, getCreditLimit, updateCreditLimit,
                                borrow, repay }
interface SignatureVerifier   { verify, signDemo? }
```

| Seam | Demo | Live |
| --- | --- | --- |
| chain data | `DemoChainDataProvider` | `CompositeChainDataProvider` → `EvmChainDataProvider` per chain |
| attestation | `DemoAttestationProvider` | `AttestcoinProvider` (`@gluwa/usc-sdk`) |
| credit | `DemoCreditProvider` | `CreditcoinProvider` |
| signer | `DemoSignatureVerifier` | `EvmSignatureVerifier` |

### Adding a chain

1. Add an entry to `CHAINS` in `src/lib/config.ts` (key, chainId, family, RPC env
   var, explorer, `knownAttestcoinChainKey` — leave `null` if unconfirmed; it is
   resolved at runtime from the ChainInfo precompile by matching `chainId`).
2. For an EVM chain, nothing else is required — `CompositeChainDataProvider`
   instantiates `EvmChainDataProvider` for every `family: "evm"` entry.
3. For a non-EVM chain (e.g. Solana), implement `ChainDataProvider` in
   `src/providers/live/solana-chain.ts` and register it in the composite's
   `ensure()`. No engine, service or route changes.
4. Add the chain's asset prices to the `assets` table (the seeder shows the shape).

### Replacing demo providers with real ones

Set `APP_MODE=live` plus the RPC/Attestcoin/Creditcoin variables in `.env.example`.
Nothing else changes: the pipeline, engines, guardrails and API are shared.

## The job pipeline

```
QUEUED → SYNCING → FETCHING → VERIFYING → NORMALIZING → EVALUATING → DECIDING → COMPLETED
                                                                              ↘ FAILED
```

Steps (`src/domain/types.ts` → `JOB_STEPS`):

```
SYNC_WALLET → FETCH_TRANSACTIONS → BUILD_PROOFS → ATTEST_EVENTS
  → NORMALIZE_EVENTS → BUILD_EVIDENCE → EVALUATE → CREDIT_DECISION → CREDIT_UPDATE
```

`POST /api/evidence/evaluate` enqueues a job and returns `202` with the job id.
The client polls `GET /api/jobs/:id`, which returns status, progress (0–100), the
per-step detail sentences and metrics, and — on completion — the evaluation and
credit decision. In demo mode each step is paced by `JOB_DEMO_STEP_DELAY_MS` so
progress is observable rather than instantaneous.

Jobs are claimed with an atomic conditional `UPDATE … WHERE status IN
('QUEUED','FAILED')`, so a retry or a second worker cannot execute the same job
twice. `POST /api/jobs/reap` clears locks from jobs whose worker died.

`POST /api/evidence/sync` runs the same pipeline with `evaluate: false`: it fetches,
proves, attests and normalises without producing a credit decision.

## Data model

`src/db/schema.ts` — 24 tables. Key uniqueness constraints (these *are* the
idempotency guarantees):

| Table | Unique key | Prevents |
| --- | --- | --- |
| `raw_transactions` | `(chain_key, tx_hash)` | duplicate raw facts |
| `raw_logs` | `(chain_key, tx_hash, log_index)` | duplicate logs |
| `attestations` | `(provider, chain_key, source_tx_hash)` | duplicate proofs |
| `economic_events` | `(wallet_id, chain_key, tx_hash, log_index, type)` | duplicate events |
| `evidence_evaluations` | `(wallet_id, evidence_hash)` | re-scoring identical evidence |
| `credit_decisions` | `(wallet_id, evidence_hash)` | **crediting the same evidence twice** |
| `credit_transactions` | `idempotency_key` | duplicate borrow/repay/award |
| `wallets` | `address` | duplicate wallets |

Indexes exist on `wallet_id`, `chain_key`, `tx_hash`, `block_height`,
`timestamp_ms`, `type`, `evaluation_id`, `status` and `created_at`.

Raw chain data is retained because it is the evidence's provenance; `raw_logs`
stores the adapter's economic decode alongside the topics so normalization is
reproducible from the database alone and never needs to re-query an RPC.

## Authentication

```
connect wallet → POST /api/auth/nonce → sign message in wallet
              → POST /api/auth/verify → session cookie
```

- The challenge message embeds the address, a single-use nonce, issue/expiry times
  and an explicit statement that BASIS never asks for a private key.
- Verification is EIP-191 recovery with an ERC-1271 fallback for contract wallets.
- Nonces are single-use and expire (`AUTH_NONCE_TTL_MS`); replays are rejected.
- Sessions are opaque 256-bit ids stored server-side, revocable, `HttpOnly` +
  `SameSite=Lax` cookies.
- A client-supplied address is never trusted without a valid signature.
- Demo wallets authenticate through the identical path; only the signer differs
  (see `docs/DEMO.md`). Private keys never exist server-side.

## Security

- No private keys or seed phrases are ever requested, transmitted or stored.
- Attestcoin verification is server-side; the browser cannot assert verification.
- Credit limits, evidence scores and balances are never accepted from the client.
  Every mutation recomputes state from persisted rows.
- All request bodies and query strings are validated with zod.
- Every mutation checks that the resource belongs to the session's wallet/user.
- Rate limiting per `(bucket, ip, path)` for auth, mutation and read traffic.
- Optimistic version checks on `credit_accounts` prevent lost updates.
- Every financially meaningful action writes an `audit_logs` row
  (`GET /api/audit`).
- Errors are typed (`src/lib/errors.ts`) and mapped to stable HTTP codes; 5xx
  details are logged server-side but never leaked to clients.

## Known limitations (documented, not hidden)

- **Live address history needs an indexer.** Public JSON-RPC cannot list all
  transactions for an address. `EvmChainDataProvider` uses a Blockscout v2 API when
  `<CHAIN>_EXPLORER_API_URL` is set, otherwise falls back to a strictly bounded
  block scan (`CHAIN_SCAN_MAX_BLOCKS`) and marks the source `partial`.
- **Live log decoding** covers the standard ERC-20 `Transfer` topic. Protocol
  identification comes from the `protocols` table / env, never from guessing.
  Deeper protocol decoding (Aave, Uniswap, …) is an adapter-level extension point.
- **Rate limiting is in-process.** Multi-instance deployments should move the
  counter to Redis; the interface (`consumeRateLimit`) is already isolated.
- **Creditcoin settlement requires a deployed ledger contract.** See
  `docs/CREDITCOIN.md`. Without `CREDITCOIN_LEDGER_ADDRESS`, settlements return
  `settled: false` with an explicit reason rather than pretending to have written
  on-chain.
- The background worker runs in-process. A production deployment should run
  `executeJob` from a dedicated worker process polling the `jobs` table.
