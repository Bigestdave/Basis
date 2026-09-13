# BASIS — backend

BASIS is a credit product built on one idea:

```
ECONOMIC ACTIVITY → ECONOMIC EVIDENCE → CREDIT
```

Activity-based systems can be gamed by producing more transactions. BASIS instead
evaluates the **economic structure** behind verified activity: how independent the
capital was, how economically diverse the activity was, and whether the sequence of
behaviour makes economic sense.

```
ATTESTCOIN  proves that cross-chain events happened
     ↓
BASIS       interprets those verified events as economic evidence
     ↓
CREDITCOIN  provides the credit infrastructure / settlement rail
```

> **This repository is the backend.** The BASIS product UI is a separate frontend
> that consumes the HTTP API in [`docs/API.md`](docs/API.md). Nothing here renders
> a dashboard; `src/app/page.tsx` is a small server-status console used to verify
> that the API, database and engines are live.

---

## Quick start

```bash
cp .env.example .env          # APP_MODE=demo works with no other configuration
npx drizzle-kit push          # create the schema
npx tsx scripts/seed.ts       # deterministic demo data, run through the REAL pipeline
npm run dev                   # or: npm run build && npm run start
```

Verify:

```bash
curl -s localhost:3000/api/health
curl -s localhost:3000/api/settings | head -c 400
```

Tests (no external services required in demo mode):

```bash
npx tsx --test tests/evidence-engine.test.ts   # 51 engine + guardrail tests
npx tsx --test tests/integration.test.ts       # end-to-end demo flow against Postgres
npx tsx scripts/calibrate.ts                   # print C/D/Q/S and credit for every scenario
```

> `package.json` is managed by the platform and is not edited directly, so the
> commands above are invoked through `npx tsx` rather than npm scripts. They are
> the equivalents of `npm run db:seed` and `npm test`.

---

## The central data object

```
BLOCKCHAIN EVENT
   ↓  chain data provider (facts)
ATTESTCOIN VERIFIED EVENT
   ↓  attestation provider (inclusion proof, server-side)
ECONOMIC EVENT
   ↓  normalizer (one shared path for demo and live)
EVIDENCE  →  EVIDENCE EVALUATION
   ↓  economic evidence engine  S = C^0.45 × D^0.30 × Q^0.25
CREDIT DECISION
   ↓  credit engine  creditIncrease = MAX_BATCH_INCREASE × S
CREDIT ACCOUNT  (+ settlement on Creditcoin)
```

**Facts, interpretation and credit decisions are stored separately.** A blockchain
transaction is a fact; Attestcoin verifies it; BASIS interprets the collection of
verified facts; the credit engine converts that interpretation into a decision. The
frontend never supplies, invents or recomputes a credit limit, evidence score,
available balance or utilization — it renders what the backend decided.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, provider seams, job pipeline, data model, security, how to add a chain |
| [docs/API.md](docs/API.md) | Every endpoint, request/response shapes, error codes |
| [docs/ECONOMIC-EVIDENCE.md](docs/ECONOMIC-EVIDENCE.md) | The maths: C, D, Q, the geometric mean, calibration, guardrails |
| [docs/DEMO.md](docs/DEMO.md) | Demo mode, the five seeded scenarios, the Farm Test |
| [docs/ATTESTCOIN.md](docs/ATTESTCOIN.md) | USC SDK integration, precompiles, what the proof does and does not prove |
| [docs/CREDITCOIN.md](docs/CREDITCOIN.md) | Creditcoin rail, ledger contract source, settlement semantics |
| [.env.example](.env.example) | Every environment variable, with defaults |

---

## Demo mode and live mode

Both modes run **the same business logic**. Only the injected providers differ.

| Seam | `APP_MODE=demo` | `APP_MODE=live` |
| --- | --- | --- |
| Chain data | `DemoChainDataProvider` (deterministic fixtures) | `EvmChainDataProvider` per chain via viem (Ethereum, Sepolia, Base, Base Sepolia) |
| Attestation | `DemoAttestationProvider` (seeded proof objects) | `AttestcoinProvider` (`@gluwa/usc-sdk`, BlockProver `0x..0FD2`) |
| Credit settlement | `DemoCreditProvider` (simulated rail) | `CreditcoinProvider` (CC3 testnet ledger contract) |
| Signer | `DemoSignatureVerifier` (HMAC, demo wallets only) | `EvmSignatureVerifier` (EIP-191 + ERC-1271) |

`src/providers/index.ts` is the **only** module that branches on `APP_MODE`.

Demo mode is not a set of static screenshots: connecting a wallet, syncing,
verifying, evaluating, deciding, borrowing and repaying all execute for real
against Postgres. Demo data is fixed constants — `Math.random()` is never used
anywhere in the codebase.

---

## Guarantees

- **Deterministic.** Same inputs → same dimensions, same score, same evidence hash,
  same credit decision. Verified by `scripts/calibrate.ts` and the test suite.
- **Idempotent.** Unique keys on `(walletId, chainKey, txHash, logIndex, type)` for
  events, `(provider, chainKey, sourceTxHash)` for attestations,
  `(walletId, evidenceHash)` for evaluations and decisions, and a unique
  `idempotencyKey` for every credit transaction. Retries cannot double-count.
- **Explainable.** Every decision returns per-dimension values *and* sentences, the
  contributing event ids, the guardrails that fired, and the evidence hash.
- **Guarded.** Duplicate-evidence protection, per-evaluation maximum, absolute cap,
  cooldown, stale-event exclusion, minimum evidence threshold, minimum event count.
- **Audited.** Every financially meaningful action writes an `audit_logs` row.

## Security

- Private keys and seed phrases are never requested, transmitted or stored. Signing
  happens in the user's wallet; only the signature crosses the wire.
- Wallet ownership is proved by signature verification server-side — a
  client-supplied address is never trusted.
- Attestcoin verification happens server-side. The browser cannot assert that a
  transaction is verified.
- RPC URLs and the Creditcoin settlement key are server-only environment variables;
  nothing secret is compiled into a client bundle.
- All input is validated with zod; every mutation checks session ownership;
  sensitive endpoints are rate limited.
