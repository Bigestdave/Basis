/**
 * BASIS relational schema (PostgreSQL + Drizzle).
 *
 * Facts, interpretation and credit decisions are stored separately so that a
 * blockchain fact can never be silently rewritten by an interpretation, and a
 * credit decision can always be traced back to the exact evidence that produced
 * it.
 *
 * Money is stored as integer USD cents (bigint/number). Chain amounts are stored
 * as decimal strings to avoid precision loss. Domain timestamps are epoch ms.
 */
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    mode: text("mode").notNull().default("demo"),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [index("users_mode_idx").on(t.mode)],
);

export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    family: text("family").notNull().default("evm"),
    label: text("label"),
    isDemo: boolean("is_demo").notNull().default(false),
    scenarioKey: text("scenario_key"),
    status: text("status").notNull().default("CONNECTED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("wallets_address_uidx").on(t.address),
    index("wallets_user_idx").on(t.userId),
    index("wallets_scenario_idx").on(t.scenarioKey),
  ],
);

export const walletConnections = pgTable(
  "wallet_connections",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chainKey: text("chain_key").notNull(),
    signerType: text("signer_type").notNull().default("eip191"),
    status: text("status").notNull().default("ACTIVE"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("wallet_connections_uidx").on(t.walletId, t.chainKey),
    index("wallet_connections_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").references(() => wallets.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("demo"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    nonce: text("nonce").primaryKey(),
    address: text("address").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("PENDING"),
    walletId: text("wallet_id"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [index("auth_nonces_address_idx").on(t.address), index("auth_nonces_expires_idx").on(t.expiresAt)],
);

/* -------------------------------------------------------------------------- */
/* Networks, assets, protocols                                                */
/* -------------------------------------------------------------------------- */

export const networks = pgTable(
  "networks",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    chainId: integer("chain_id"),
    name: text("name").notNull(),
    family: text("family").notNull().default("evm"),
    attestcoinChainKey: integer("attestcoin_chain_key"),
    rpcConfigured: boolean("rpc_configured").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    explorerTxTemplate: text("explorer_tx_template"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [uniqueIndex("networks_key_uidx").on(t.key), index("networks_chain_id_idx").on(t.chainId)],
);

export const walletNetworks = pgTable(
  "wallet_networks",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    /**
     * Network key from the chain registry. Deliberately not a foreign key:
     * `networks.key` is covered by a unique index (not a constraint), and the
     * registry is validated in code against CHAINS so an unknown network is
     * rejected before it can be written.
     */
    networkKey: text("network_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallet_networks_uidx").on(t.walletId, t.networkKey)],
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    symbol: text("symbol").notNull(),
    chainKey: text("chain_key").notNull(),
    contractAddress: text("contract_address").notNull().default("native"),
    decimals: integer("decimals").notNull().default(18),
    priceUsd: doublePrecision("price_usd").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assets_uidx").on(t.symbol, t.chainKey, t.contractAddress)],
);

export const protocols = pgTable(
  "protocols",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("defi"),
    chainKeys: jsonb("chain_keys").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("protocols_key_uidx").on(t.key)],
);

/* -------------------------------------------------------------------------- */
/* Raw chain data (facts)                                                     */
/* -------------------------------------------------------------------------- */

export const rawTransactions = pgTable(
  "raw_transactions",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    chainKey: text("chain_key").notNull(),
    txHash: text("tx_hash").notNull(),
    blockHeight: bigint("block_height", { mode: "number" }).notNull(),
    from: text("from").notNull(),
    to: text("to"),
    valueRaw: text("value_raw").notNull().default("0"),
    data: text("data"),
    status: text("status").notNull().default("SUCCESS"),
    timestampMs: bigint("timestamp_ms", { mode: "number" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("raw_transactions_uidx").on(t.chainKey, t.txHash),
    index("raw_transactions_wallet_idx").on(t.walletId),
    index("raw_transactions_block_idx").on(t.chainKey, t.blockHeight),
    index("raw_transactions_ts_idx").on(t.timestampMs),
  ],
);

export const rawLogs = pgTable(
  "raw_logs",
  {
    id: text("id").primaryKey(),
    rawTransactionId: text("raw_transaction_id")
      .notNull()
      .references(() => rawTransactions.id, { onDelete: "cascade" }),
    chainKey: text("chain_key").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    address: text("address").notNull(),
    topics: jsonb("topics").notNull().default([]),
    data: text("data"),
    /**
     * Economic decoding produced by the chain adapter, persisted so that
     * normalization is reproducible from the database alone and never needs to
     * re-query an RPC. Facts stay facts; the decode is stored next to them.
     */
    decoded: jsonb("decoded"),
  },
  (t) => [
    uniqueIndex("raw_logs_uidx").on(t.chainKey, t.txHash, t.logIndex),
    index("raw_logs_tx_idx").on(t.rawTransactionId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Attestations (Attestcoin / USC verified facts)                             */
/* -------------------------------------------------------------------------- */

export const attestations = pgTable(
  "attestations",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id"),
    provider: text("provider").notNull(),
    chainKey: text("chain_key").notNull(),
    attestcoinChainKey: integer("attestcoin_chain_key"),
    sourceTxHash: text("source_tx_hash").notNull(),
    blockHeight: bigint("block_height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index"),
    verified: boolean("verified").notNull().default(false),
    status: text("status").notNull().default("PENDING"),
    txBytes: text("tx_bytes"),
    merkleRoot: text("merkle_root"),
    merkleSiblings: integer("merkle_siblings").notNull().default(0),
    continuityLowerEndpointDigest: text("continuity_lower_endpoint_digest"),
    continuityRoots: integer("continuity_roots").notNull().default(0),
    verifier: text("verifier"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    error: text("error"),
    proofReference: text("proof_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("attestations_uidx").on(t.provider, t.chainKey, t.sourceTxHash),
    index("attestations_event_idx").on(t.eventId),
    index("attestations_status_idx").on(t.status),
    index("attestations_block_idx").on(t.chainKey, t.blockHeight),
  ],
);

/* -------------------------------------------------------------------------- */
/* Economic events (normalised, verified interpretation of facts)             */
/* -------------------------------------------------------------------------- */

export const economicEvents = pgTable(
  "economic_events",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    chainKey: text("chain_key").notNull(),
    chainId: integer("chain_id"),
    blockHeight: bigint("block_height", { mode: "number" }).notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull().default(0),
    timestampMs: bigint("timestamp_ms", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    from: text("from").notNull(),
    to: text("to").notNull(),
    asset: text("asset").notNull(),
    assetDecimals: integer("asset_decimals").notNull().default(18),
    amountRaw: text("amount_raw").notNull().default("0"),
    amountUsdCents: bigint("amount_usd_cents", { mode: "number" }).notNull().default(0),
    protocol: text("protocol"),
    attestationId: text("attestation_id").references(() => attestations.id, { onDelete: "set null" }),
    verified: boolean("verified").notNull().default(false),
    sequence: integer("sequence").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    lastEvaluationId: text("last_evaluation_id"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    // Idempotency anchor: the same log can never become two economic events.
    uniqueIndex("economic_events_uidx").on(t.walletId, t.chainKey, t.txHash, t.logIndex, t.type),
    index("economic_events_wallet_idx").on(t.walletId),
    index("economic_events_tx_idx").on(t.txHash),
    index("economic_events_block_idx").on(t.chainKey, t.blockHeight),
    index("economic_events_ts_idx").on(t.timestampMs),
    index("economic_events_type_idx").on(t.type),
    index("economic_events_attestation_idx").on(t.attestationId),
    index("economic_events_credited_idx").on(t.creditedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Evidence evaluations (interpretation)                                      */
/* -------------------------------------------------------------------------- */

export const evidenceEvaluations = pgTable(
  "evidence_evaluations",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    engineVersion: text("engine_version").notNull(),
    evidenceScore: doublePrecision("evidence_score").notNull().default(0),
    capitalIndependence: doublePrecision("capital_independence").notNull().default(0),
    economicDiversity: doublePrecision("economic_diversity").notNull().default(0),
    behavioralCoherence: doublePrecision("behavioral_coherence").notNull().default(0),
    strength: text("strength").notNull().default("none"),
    eventCount: integer("event_count").notNull().default(0),
    verifiedEventCount: integer("verified_event_count").notNull().default(0),
    volumeUsdCents: bigint("volume_usd_cents", { mode: "number" }).notNull().default(0),
    evidenceHash: text("evidence_hash").notNull(),
    contributingEventIds: jsonb("contributing_event_ids").notNull().default([]),
    excludedEventIds: jsonb("excluded_event_ids").notNull().default([]),
    dimensions: jsonb("dimensions").notNull().default({}),
    signals: jsonb("signals").notNull().default({}),
    status: text("status").notNull().default("COMPLETED"),
    credited: boolean("credited").notNull().default(false),
    jobId: text("job_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("evidence_evaluations_hash_uidx").on(t.walletId, t.evidenceHash),
    index("evidence_evaluations_wallet_idx").on(t.walletId),
    index("evidence_evaluations_job_idx").on(t.jobId),
    index("evidence_evaluations_created_idx").on(t.createdAt),
  ],
);

export const evidenceEventLinks = pgTable(
  "evidence_event_links",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evidenceEvaluations.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => economicEvents.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    kind: text("kind").notNull().default("contributing"),
  },
  (t) => [
    // An event can only be *credited* once, enforced at the storage layer.
    uniqueIndex("evidence_event_links_uidx").on(t.evaluationId, t.eventId),
    index("evidence_event_links_event_idx").on(t.eventId),
    index("evidence_event_links_wallet_idx").on(t.walletId, t.kind),
  ],
);

export const evidenceFactors = pgTable(
  "evidence_factors",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evidenceEvaluations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: doublePrecision("value").notNull().default(0),
    explanation: text("explanation").notNull().default(""),
    signals: jsonb("signals").notNull().default({}),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("evidence_factors_uidx").on(t.evaluationId, t.key),
    index("evidence_factors_evaluation_idx").on(t.evaluationId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Credit (decision + state)                                                  */
/* -------------------------------------------------------------------------- */

export const creditAccounts = pgTable(
  "credit_accounts",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    creditLimitUsdCents: bigint("credit_limit_usd_cents", { mode: "number" }).notNull().default(0),
    borrowedUsdCents: bigint("borrowed_usd_cents", { mode: "number" }).notNull().default(0),
    totalAwardedUsdCents: bigint("total_awarded_usd_cents", { mode: "number" }).notNull().default(0),
    totalRepaidUsdCents: bigint("total_repaid_usd_cents", { mode: "number" }).notNull().default(0),
    evaluationCount: integer("evaluation_count").notNull().default(0),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    status: text("status").notNull().default("ACTIVE"),
    provider: text("provider").notNull().default("demo"),
    onchain: boolean("onchain").notNull().default(false),
    onchainReference: text("onchain_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(0),
  },
  (t) => [uniqueIndex("credit_accounts_wallet_uidx").on(t.walletId), index("credit_accounts_user_idx").on(t.userId)],
);

export const creditDecisions = pgTable(
  "credit_decisions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    userId: text("user_id"),
    evaluationId: text("evaluation_id").references(() => evidenceEvaluations.id, {
      onDelete: "set null",
    }),
    evidenceHash: text("evidence_hash").notNull(),
    evidenceScore: doublePrecision("evidence_score").notNull().default(0),
    strength: text("strength").notNull().default("none"),
    previousLimitUsdCents: bigint("previous_limit_usd_cents", { mode: "number" }).notNull().default(0),
    creditIncreaseUsdCents: bigint("credit_increase_usd_cents", { mode: "number" }).notNull().default(0),
    newLimitUsdCents: bigint("new_limit_usd_cents", { mode: "number" }).notNull().default(0),
    availableUsdCents: bigint("available_usd_cents", { mode: "number" }).notNull().default(0),
    utilization: doublePrecision("utilization").notNull().default(0),
    awarded: boolean("awarded").notNull().default(false),
    blockedBy: jsonb("blocked_by").notNull().default([]),
    guardrailNotes: jsonb("guardrail_notes").notNull().default([]),
    efficiency: doublePrecision("efficiency").notNull().default(0),
    onchain: boolean("onchain").notNull().default(false),
    onchainReference: text("onchain_reference"),
    jobId: text("job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The same evidence can never be converted into credit twice.
    uniqueIndex("credit_decisions_hash_uidx").on(t.walletId, t.evidenceHash),
    index("credit_decisions_account_idx").on(t.accountId),
    index("credit_decisions_wallet_idx").on(t.walletId),
    index("credit_decisions_evaluation_idx").on(t.evaluationId),
  ],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    amountUsdCents: bigint("amount_usd_cents", { mode: "number" }).notNull(),
    limitAfterUsdCents: bigint("limit_after_usd_cents", { mode: "number" }).notNull().default(0),
    borrowedAfterUsdCents: bigint("borrowed_after_usd_cents", { mode: "number" }).notNull().default(0),
    balanceAfterUsdCents: bigint("balance_after_usd_cents", { mode: "number" }).notNull().default(0),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("credit_transactions_idem_uidx").on(t.idempotencyKey),
    index("credit_transactions_account_idx").on(t.accountId),
    index("credit_transactions_wallet_idx").on(t.walletId),
    index("credit_transactions_kind_idx").on(t.kind),
  ],
);

export const borrowPositions = pgTable(
  "borrow_positions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    userId: text("user_id"),
    principalUsdCents: bigint("principal_usd_cents", { mode: "number" }).notNull(),
    outstandingUsdCents: bigint("outstanding_usd_cents", { mode: "number" }).notNull(),
    transactionId: text("transaction_id"),
    status: text("status").notNull().default("OPEN"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    onchainReference: text("onchain_reference"),
  },
  (t) => [index("borrow_positions_account_idx").on(t.accountId), index("borrow_positions_status_idx").on(t.status)],
);

export const repayments = pgTable(
  "repayments",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    positionId: text("position_id").references(() => borrowPositions.id, { onDelete: "set null" }),
    amountUsdCents: bigint("amount_usd_cents", { mode: "number" }).notNull(),
    transactionId: text("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    onchainReference: text("onchain_reference"),
  },
  (t) => [index("repayments_account_idx").on(t.accountId), index("repayments_position_idx").on(t.positionId)],
);

/* -------------------------------------------------------------------------- */
/* Farm Test                                                                  */
/* -------------------------------------------------------------------------- */

export const farmTestScenarios = pgTable(
  "farm_test_scenarios",
  {
    key: text("key").primaryKey(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    narrative: text("narrative").notNull().default(""),
    expectation: text("expectation").notNull().default(""),
    fixtureKey: text("fixture_key").notNull(),
    walletId: text("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
    activityCount: integer("activity_count").notNull().default(0),
    volumeUsdCents: bigint("volume_usd_cents", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("farm_test_scenarios_wallet_idx").on(t.walletId)],
);

export const farmTestRuns = pgTable(
  "farm_test_runs",
  {
    id: text("id").primaryKey(),
    scenarioKey: text("scenario_key")
      .notNull()
      .references(() => farmTestScenarios.key, { onDelete: "cascade" }),
    walletId: text("wallet_id").notNull(),
    userId: text("user_id"),
    evaluationId: text("evaluation_id"),
    decisionId: text("decision_id"),
    jobId: text("job_id"),
    activityCount: integer("activity_count").notNull().default(0),
    evidenceScore: doublePrecision("evidence_score").notNull().default(0),
    creditIncreaseUsdCents: bigint("credit_increase_usd_cents", { mode: "number" }).notNull().default(0),
    result: jsonb("result").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("farm_test_runs_scenario_idx").on(t.scenarioKey), index("farm_test_runs_wallet_idx").on(t.walletId)],
);

/* -------------------------------------------------------------------------- */
/* Jobs + audit                                                               */
/* -------------------------------------------------------------------------- */

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    status: text("status").notNull().default("QUEUED"),
    progress: integer("progress").notNull().default(0),
    walletId: text("wallet_id").references(() => wallets.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    currentStep: text("current_step"),
    steps: jsonb("steps").notNull().default([]),
    payload: jsonb("payload").notNull().default({}),
    resultReference: jsonb("result_reference"),
    error: text("error"),
    errorCode: text("error_code"),
    attempt: integer("attempt").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jobs_status_idx").on(t.status),
    index("jobs_wallet_idx").on(t.walletId),
    index("jobs_type_status_idx").on(t.type, t.status),
    index("jobs_created_idx").on(t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    walletId: text("wallet_id"),
    action: text("action").notNull(),
    referenceId: text("reference_id"),
    result: text("result").notNull().default("success"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_wallet_idx").on(t.walletId),
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletConnection = typeof walletConnections.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuthNonce = typeof authNonces.$inferSelect;
export type Network = typeof networks.$inferSelect;
export type WalletNetwork = typeof walletNetworks.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Protocol = typeof protocols.$inferSelect;
export type RawTransaction = typeof rawTransactions.$inferSelect;
export type RawLog = typeof rawLogs.$inferSelect;
export type AttestationRow = typeof attestations.$inferSelect;
export type EconomicEventRow = typeof economicEvents.$inferSelect;
export type EvidenceEvaluationRow = typeof evidenceEvaluations.$inferSelect;
export type EvidenceFactorRow = typeof evidenceFactors.$inferSelect;
export type CreditAccountRow = typeof creditAccounts.$inferSelect;
export type CreditDecisionRow = typeof creditDecisions.$inferSelect;
export type CreditTransactionRow = typeof creditTransactions.$inferSelect;
export type BorrowPositionRow = typeof borrowPositions.$inferSelect;
export type RepaymentRow = typeof repayments.$inferSelect;
export type FarmTestScenarioRow = typeof farmTestScenarios.$inferSelect;
export type FarmTestRunRow = typeof farmTestRuns.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
