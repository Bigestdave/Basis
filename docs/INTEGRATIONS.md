# BASIS External Integrations Guide

This document describes how BASIS connects to external networks, protocols, oracles, and settlement layers across both **Demo Mode** and **Live/Testnet Mode**.

---

## 1. Integration Architecture Overview

BASIS uses a **Provider Pattern** with clean dependency injection. Business logic (the Credit Engine, Evidence Engine, and Account State) never branches on `APP_MODE` or imports raw chain SDKs directly. Instead, all external interactions are mediated through typed provider interfaces defined in `src/domain/providers.ts`:

- **`ChainProvider`**: Ingests raw blocks, transactions, receipts, and logs across supported EVM chains (Ethereum Sepolia, Base Sepolia, Mainnet).
- **`AttestcoinProvider`**: Resolves cross-chain block headers, queries the USC BlockProver precompile (`0x...0FD2`), and constructs cryptographic inclusion proofs.
- **`CreditcoinProvider`**: Manages on-chain credit line state, settlements, and double-entry ledger proofs on Creditcoin CC3 Testnet.

```
+-------------------------------------------------------------+
|                      BASIS Frontend                         |
|     (Vite + React 19 + Tailwind CSS + EIP-1193 Connector)   |
+------------------------------+------------------------------+
                               | REST / HTTP API
+------------------------------v------------------------------+
|                   BASIS Backend Services                    |
|       (Evidence Pipeline, Credit Engine, Wallet Service)    |
+------------------------------+------------------------------+
                               | Provider Interfaces
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
+-----------------+   +-----------------+   +-----------------+
|  ChainProvider  |   | Attestcoin (USC)|   |   Creditcoin    |
| (Sepolia, Base) |   |  (BlockProver)  |   | (CC3 Settlement)|
+-----------------+   +-----------------+   +-----------------+
```

---

## 2. Attestcoin (Universal Settlement & Cross-Chain Attestation)

Attestcoin provides cross-chain state verification through consensus-level attestors on the Creditcoin network.

### Precompile Interfaces
- **BlockProver Precompile**: `0x0000000000000000000000000000000000000FD2`
  - Verifies that a specific block hash from an external chain (e.g. Sepolia) is finalized and attested by USC consensus.
  - Method: `verifyBlock(uint256 chainKey, bytes32 blockHash)`
- **ChainInfo Precompile**: `0x0000000000000000000000000000000000000FD3`
  - Maps external chain IDs to Attestcoin chain keys.
  - Confirmed: `chainKey = 1` $\to$ Ethereum Sepolia.

### Proof Generation & Verification Pipeline
1. **Source Event**: A user interacts with an authorized DeFi protocol (e.g., Aave V3 deposit on Sepolia).
2. **Block Attestation**: BASIS queries USC RPC to ensure the block containing the transaction receipt is committed by the attestor set.
3. **Receipt Merkle Proof**: BASIS generates an MPT (Merkle Patricia Trie) receipt inclusion proof against the attested block's `receiptsRoot`.
4. **Verification**: The verification hash is stored and linked to the evidence item, guaranteeing non-repudiation and preventing replay attacks across wallets.

### Demo Mode vs. Live Mode
- **Live Mode**: Calls live USC RPC at `https://rpc.cc3-testnet.creditcoin.network` and prover at `https://prover.cc3-testnet.creditcoin.network`.
- **Demo Mode**: `MockAttestcoinProvider` generates deterministic, cryptographically structured Merkle proofs and block hashes derived from scenario fixtures, allowing offline audit and interactive inspection in the frontend without external network latency.

---

## 3. Creditcoin (CC3 Credit Settlement & Ledger)

Creditcoin serves as the decentralized credit registry where non-collateralized borrowing terms, limits, and repayments are permanently anchored.

### Configuration
- **Network**: Creditcoin CC3 Testnet
- **RPC URL**: `https://rpc.cc3-testnet.creditcoin.network`
- **Chain ID**: `102031`
- **Settlement Account**: Configured via `CREDITCOIN_SETTLEMENT_PRIVATE_KEY`

### Ledger Operation
- **Double-Entry State**: Whenever a credit limit increases via `BUILD_CREDIT`, or a borrow/repay occurs, BASIS generates a cryptographically signed settlement record.
- **Graceful Fallback / Mirror Mode**: When `CREDITCOIN_LEDGER_ADDRESS` is not configured in live mode, `CreditcoinProvider` operates in read-only mirror mode (`onchain: false`), preventing synthetic transactions or fake contract executions.

---

## 4. Supported EVM Chains & DeFi Protocols

BASIS monitors and normalizes economic activity across the following chains:

| Chain | Chain ID | Key | USC Key | Monitored Protocols |
| :--- | :--- | :--- | :--- | :--- |
| **Ethereum Sepolia** | 11155111 | `ethereum-sepolia` | `1` | Uniswap V3, Aave V3, Compound |
| **Base Sepolia** | 84532 | `base-sepolia` | Dynamic | Aerodrome, Aave V3 |
| **Ethereum Mainnet** | 1 | `ethereum` | Dynamic | Uniswap, Aave, Lido, Morpho |
| **Base Mainnet** | 8453 | `base` | Dynamic | Aerodrome, Uniswap V3 |

### Recognized Protocol Addresses
Protocol addresses are canonically mapped in `src/domain/protocols.ts`. Any transaction interacting with these addresses is enriched with protocol metadata, protocol classification, and asset pricing.

---

## 5. Frontend & Wallet Integration

- **EIP-1193 Injected Wallets**: The frontend connects to any standard browser wallet (MetaMask, Rabby, Coinbase Wallet) using `window.ethereum`.
- **SIWE (Sign-In with Ethereum)**:
  - Authentication endpoint: `/api/auth/nonce` $\to$ generates an EIP-4361 compliant challenge.
  - Verification endpoint: `/api/auth/verify` $\to$ verifies ECDSA personal signature using `ethers.verifyMessage` and issues a cryptographically signed session cookie/token.
- **Interactive Inspection**: Every verified transaction in the Activity feed and Evidence view provides deep inspection of Attestcoin block attestations, receipt roots, and Merkle proofs.
