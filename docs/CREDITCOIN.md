# Creditcoin integration

## What was verified against official documentation

From `docs.creditcoin.org` (checked, not guessed):

| | Testnet | Mainnet |
| --- | --- | --- |
| Network | Creditcoin Testnet (CC3) | Creditcoin |
| HTTPS RPC | `https://rpc.cc3-testnet.creditcoin.network` | `https://mainnet3.creditcoin.network` |
| WSS RPC | `wss://rpc.cc3-testnet.creditcoin.network` | `wss://mainnet3.creditcoin.network` |
| Chain ID | `102031` | `102030` |
| Currency | CTC | CTC |
| Explorer | `https://creditcoin-testnet.blockscout.com` | `https://creditcoin.blockscout.com` |

Creditcoin is Substrate-based **and fully EVM compatible**, so standard viem/ethers
tooling works against its EVM RPC. It also exposes precompiles, notably
`0x0000…0FD1` (`transfer_substrate`) and the Attestcoin precompiles `0x0000…0FD2`
(BlockProver) and `0x0000…0FD3` (ChainInfo) — see `docs/ATTESTCOIN.md`.

## The honest boundary

Creditcoin does **not** ship a canonical "consumer credit account" contract, and
this codebase refuses to invent one. No contract address, ABI, function signature
or network id in `src/providers/live/creditcoin.ts` is fabricated:

- **PostgreSQL is the system of record** for credit state — auditable, queryable,
  transactional, and the thing every API response is derived from.
- **Creditcoin is the settlement rail.** `CreditcoinProvider` anchors BASIS credit
  decisions, draws and repayments into a **BASIS-owned ledger contract** deployed on
  CC3, whose address comes from `CREDITCOIN_LEDGER_ADDRESS`.
- If the ledger address or `CREDITCOIN_SETTLEMENT_PRIVATE_KEY` is not configured,
  every settlement returns `{ settled: false, reason: … }`. It never claims an
  on-chain write that did not happen, and the API surfaces `onchain: false`.

`CreditcoinProvider` and `DemoCreditProvider` implement the same `CreditProvider`
interface, so nothing above the seam knows which rail is in use.

## The ledger contract

Deploy this to Creditcoin CC3 testnet (Solidity ≥0.8.20), then set
`CREDITCOIN_LEDGER_ADDRESS` and `CREDITCOIN_SETTLEMENT_PRIVATE_KEY`. The ABI in
`src/providers/live/creditcoin.ts` (`CREDITCOIN_LEDGER_ABI`) matches it exactly.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice BASIS credit ledger. Anchors evidence-derived credit state on
///         Creditcoin so a decision can be independently audited. Amounts are
///         integer USD cents; evidence hashes are the BASIS evidenceHash.
contract BasisCreditLedger {
    address public immutable oracle;                 // BASIS settlement account
    mapping(address => uint256) public creditLimit;  // cents
    mapping(address => uint256) public borrowed;     // cents
    mapping(address => bytes32) public lastEvidence; // last evidence hash applied
    mapping(address => mapping(bytes32 => bool)) public usedReference;

    event CreditLimitSet(address indexed account, uint256 limitCents, bytes32 indexed evidenceHash);
    event DrawRecorded(address indexed account, uint256 amountCents, bytes32 indexed reference);
    event RepaymentRecorded(address indexed account, uint256 amountCents, bytes32 indexed reference);

    error NotOracle();
    error Replay(bytes32 reference);
    error InsufficientLimit();
    error ExceedsOutstanding();

    constructor(address oracle_) { oracle = oracle_; }

    modifier onlyOracle() { if (msg.sender != oracle) revert NotOracle(); _; }
    modifier once(bytes32 ref, address acct) {
        if (usedReference[acct][ref]) revert Replay(ref);
        usedReference[acct][ref] = true;
        _;
    }

    /// @notice Apply an evidence-derived credit limit. Idempotent per evidenceHash.
    function setCreditLimit(address account, uint256 limitCents, bytes32 evidenceHash)
        external onlyOracle once(evidenceHash, account)
    {
        if (limitCents < borrowed[account]) revert InsufficientLimit();
        creditLimit[account] = limitCents;
        lastEvidence[account] = evidenceHash;
        emit CreditLimitSet(account, limitCents, evidenceHash);
    }

    function recordDraw(address account, uint256 amountCents, bytes32 reference)
        external onlyOracle once(reference, account)
    {
        if (borrowed[account] + amountCents > creditLimit[account]) revert InsufficientLimit();
        borrowed[account] += amountCents;
        emit DrawRecorded(account, amountCents, reference);
    }

    function recordRepayment(address account, uint256 amountCents, bytes32 reference)
        external onlyOracle once(reference, account)
    {
        if (amountCents > borrowed[account]) revert ExceedsOutstanding();
        borrowed[account] -= amountCents;
        emit RepaymentRecorded(account, amountCents, reference);
    }
}
```

On-chain replay protection (`once`) mirrors the database's unique
`(wallet_id, evidence_hash)` and `idempotency_key` constraints, so the two ledgers
cannot disagree about whether an event was credited twice.

## Runtime behaviour

```
CreditcoinProvider.updateCreditLimit(ctx, { newLimitUsdCents, decisionId, evidenceHash })
  → encodeFunctionData(setCreditLimit, [wallet, limitCents, bytes32(evidenceHash)])
  → walletClient.sendTransaction → publicClient.waitForTransactionReceipt
  → SettlementResult { settled, reference: txHash, detail: { blockNumber, explorerUrl } }
```

`borrow` → `recordDraw`, `repay` → `recordRepayment`, both keyed by a `bytes32`
derived from the position/repayment id. `getAccount` / `getCreditLimit` read
`creditLimit(account)` and `borrowed(account)` directly from the chain.

The settlement private key is read from `process.env` on the server only. It is
never sent to the client, never logged, and never stored in the database.

## Configuration

```bash
APP_MODE=live
CREDITCOIN_ENABLED=true
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_CHAIN_ID=102031
CREDITCOIN_LEDGER_ADDRESS=0x…        # deployed BasisCreditLedger
CREDITCOIN_SETTLEMENT_PRIVATE_KEY=0x… # funded with testnet CTC for gas
```

## What remains

- Deploying and verifying `BasisCreditLedger` on CC3 testnet (needs a funded
  settlement key) — until then the provider reports `settled: false` and the
  descriptor explains why. This is isolated behind `CreditProvider`; nothing else
  in BASIS changes once the address is set.
- Bridging/settling actual CTC liquidity. **Attestcoin verifies facts; it does not
  bridge liquidity.** A proven transaction is not newly available native CTC, and
  BASIS does not claim otherwise — the credit line is denominated in USD cents and
  the ledger records state, not custody.
