# Attestcoin (USC) integration

Attestcoin is a **core** part of BASIS, not a decorative sponsor badge. It is the
layer that turns "a blockchain API told us this happened" into "this transaction was
included in a block genuinely belonging to an attested source chain, provable on
Creditcoin".

```
RAW BLOCKCHAIN DATA
   ↓  chain data provider
chainKey · blockHeight · encoded transaction · merkle proof · continuity proof
   ↓  Attestcoin
verified = true / false
   ↓  BASIS
VERIFIED ECONOMIC EVENT → ECONOMIC EVIDENCE → CREDIT
```

## Verified against the official SDK

Integration is built against `@gluwa/usc-sdk` **v0.18.0**, read from the published
type declarations rather than guessed. No SDK method, contract address or function
signature in this repository is invented.

| Item | Value | Source |
| --- | --- | --- |
| Package | `@gluwa/usc-sdk` | npm |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` | `blockProver.BLOCK_PROVER_PRECOMPILE_ADDRESS` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` | `chainInfo.CHAIN_INFO_PRECOMPILE_ADDRESS` |
| CC3 testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` | docs.creditcoin.org |
| Prover service | `https://prover.cc3-testnet.creditcoin.network` | SDK docstring examples |
| Sepolia chain key | `1` (Ethereum Sepolia on CC3/USC testnet) | official USC docs |

Chain keys for other networks are **not** hardcoded. They are resolved at runtime
from the ChainInfo precompile (`getSupportedChains()` returns
`{ chainKey, chainId, chainName, chainEncoding }`) and matched by `chainId`.
`CHAINS[].knownAttestcoinChainKey` is `null` unless the value is documented.

### SDK surface actually used

```ts
import { chainInfo, blockProver, proofProvider } from "@gluwa/usc-sdk";
import { JsonRpcProvider } from "ethers";

const rpc = new JsonRpcProvider(ATTESTCOIN_RPC_URL);
const info = new chainInfo.PrecompileChainInfoProvider(rpc, CHAIN_INFO_ADDRESS);
const prover = new blockProver.PrecompileBlockProver(rpc, BLOCK_PROVER_ADDRESS);
const builder = new proofProvider.service.ProofBuilder(uscChainKey, PROVER_URL, timeout);

await info.getSupportedChains();                       // chain registry
await info.waitUntilHeightAttested(uscChainKey, h, pollMs, timeoutMs);
const res = await builder.getProof(txHash);            // ProofResult
const ok  = await prover.verifySingle(
  res.data.chainKey, res.data.headerNumber, res.data.txBytes,
  res.data.merkleProof, res.data.continuityProof,
);
const txIndex = await prover.computeTransactionIndex(res.data.merkleProof);
```

`ContinuityResponse` = `{ chainKey, headerNumber, txIndex, txHash, txBytes,
merkleProof{root, siblings[{hash,isLeft}]}, continuityProof{lowerEndpointDigest,
roots[]}, cached, generatedAt }`. Every one of those fields is persisted on the
`attestations` row (siblings/roots as counts plus the full arrays in `metadata`) so
an event can be re-verified independently of this service.

The SDK is loaded with a **dynamic import** inside `AttestcoinProvider`, so demo
mode never pulls in ethers or the USC SDK.

## What the proof does and does not prove

Recorded verbatim on every attestation (`metadata.trustScope`):

> The BlockProver proves exactly one thing: that a transaction was included in a
> block genuinely belonging to an attested source chain. It does **not** prove the
> transaction succeeded, and it does **not** prove which contract emitted its logs.

BASIS therefore checks those separately and never treats inclusion as success:

- **Receipt status** — reverted transactions are dropped by the normalizer
  (`reason: transaction_reverted`) and can never become economic events.
- **Emitting contract identity** — protocol attribution comes from the `protocols`
  table / configured addresses, never from an assumption.
- **Economic meaning** — zero-value calls, contract creations and transactions
  where the wallet is not a party are dropped (`no_economic_meaning`,
  `contract_creation`, `wallet_not_a_party`).

## Trust boundary

Attestcoin verification happens **server-side** in the pipeline's `ATTEST_EVENTS`
step. There is no API through which a browser can assert that a transaction is
verified. `economic_events.verified` is only ever set from an `attestations` row
produced by the `AttestationProvider`.

The pipeline batches requests through `verifyOrdering`, which is the batch path
where transactions share a continuity proof — the same shape as the SDK's
`verifyBatch` + `mergeProofs` flow. This is what lets BASIS reason about *ordering*
(Behavioral Coherence) rather than isolated transactions.

## Statuses

| `attestations.status` | Meaning |
| --- | --- |
| `PENDING` | proof not yet requested |
| `AWAITING_ATTESTATION` | source block not yet attested on Creditcoin (attestors reach consensus periodically — measured in minutes). Job stays in `VERIFYING`. API can return `attestation_pending` (202). |
| `PROOF_GENERATED` | proof built, not yet checked on-chain |
| `VERIFIED` | `BlockProver.verifySingle` returned true |
| `FAILED` | verification returned false or errored; `error` carries the reason |

An event is only eligible for evidence when its attestation is `VERIFIED`.

## Configuration

```bash
APP_MODE=live
ATTESTCOIN_ENABLED=true
ATTESTCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
ATTESTCOIN_PROVER_URL=https://prover.cc3-testnet.creditcoin.network
ATTESTCOIN_BLOCK_PROVER_ADDRESS=0x0000000000000000000000000000000000000FD2
ATTESTCOIN_CHAIN_INFO_ADDRESS=0x0000000000000000000000000000000000000fd3
ATTESTCOIN_ATTESTATION_TIMEOUT_MS=900000
ATTESTCOIN_ATTESTATION_POLL_MS=15000
ATTESTCOIN_REQUEST_TIMEOUT_MS=15000
```

## Demo mode

`DemoAttestationProvider` returns deterministic seeded verification objects with
the **same shape** as the real `ContinuityResponse` — `chainKey`, `headerNumber`,
`txBytes`, `merkleRoot`, `merkleSiblings`, `continuityLowerEndpointDigest`,
`continuityRoots`, `verifier` (the real `0x..0FD2` address), `txIndex` and
`proofReference`. Scenario `verification-in-progress` seeds three events as
`AWAITING_ATTESTATION` so the pending path is exercised, and scenario `proof-detail`
seeds the full technical proof object for the evidence detail view.

The descriptor states plainly that the proof fields are synthetic. Demo mode never
claims a real cross-chain verification occurred.

## Limitations

- Live proof generation depends on the public USC prover service and on attestors
  having attested the source block; both are outside BASIS's control, so the
  pipeline treats "not yet attested" as a retryable pending state rather than a
  failure.
- Writability (submitting BASIS attestations *to* Attestcoin) is not implemented.
  BASIS uses the **readability** path: proving source-chain facts into Creditcoin.
  Adding writability would be a new method on `AttestationProvider` — no product
  code would change.
