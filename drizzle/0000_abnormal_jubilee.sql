CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"chain_key" text NOT NULL,
	"contract_address" text DEFAULT 'native' NOT NULL,
	"decimals" integer DEFAULT 18 NOT NULL,
	"price_usd" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text,
	"provider" text NOT NULL,
	"chain_key" text NOT NULL,
	"attestcoin_chain_key" integer,
	"source_tx_hash" text NOT NULL,
	"block_height" bigint NOT NULL,
	"tx_index" integer,
	"verified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"tx_bytes" text,
	"merkle_root" text,
	"merkle_siblings" integer DEFAULT 0 NOT NULL,
	"continuity_lower_endpoint_digest" text,
	"continuity_roots" integer DEFAULT 0 NOT NULL,
	"verifier" text,
	"verified_at" timestamp with time zone,
	"error" text,
	"proof_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"wallet_id" text,
	"action" text NOT NULL,
	"reference_id" text,
	"result" text DEFAULT 'success' NOT NULL,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"wallet_id" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "borrow_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"principal_usd_cents" bigint NOT NULL,
	"outstanding_usd_cents" bigint NOT NULL,
	"transaction_id" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"onchain_reference" text
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"credit_limit_usd_cents" bigint DEFAULT 0 NOT NULL,
	"borrowed_usd_cents" bigint DEFAULT 0 NOT NULL,
	"total_awarded_usd_cents" bigint DEFAULT 0 NOT NULL,
	"total_repaid_usd_cents" bigint DEFAULT 0 NOT NULL,
	"evaluation_count" integer DEFAULT 0 NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"provider" text DEFAULT 'demo' NOT NULL,
	"onchain" boolean DEFAULT false NOT NULL,
	"onchain_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"evaluation_id" text,
	"evidence_hash" text NOT NULL,
	"evidence_score" double precision DEFAULT 0 NOT NULL,
	"strength" text DEFAULT 'none' NOT NULL,
	"previous_limit_usd_cents" bigint DEFAULT 0 NOT NULL,
	"credit_increase_usd_cents" bigint DEFAULT 0 NOT NULL,
	"new_limit_usd_cents" bigint DEFAULT 0 NOT NULL,
	"available_usd_cents" bigint DEFAULT 0 NOT NULL,
	"utilization" double precision DEFAULT 0 NOT NULL,
	"awarded" boolean DEFAULT false NOT NULL,
	"blocked_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guardrail_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"efficiency" double precision DEFAULT 0 NOT NULL,
	"onchain" boolean DEFAULT false NOT NULL,
	"onchain_reference" text,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"amount_usd_cents" bigint NOT NULL,
	"limit_after_usd_cents" bigint DEFAULT 0 NOT NULL,
	"borrowed_after_usd_cents" bigint DEFAULT 0 NOT NULL,
	"balance_after_usd_cents" bigint DEFAULT 0 NOT NULL,
	"reference_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_events" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"chain_key" text NOT NULL,
	"chain_id" integer,
	"block_height" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"timestamp_ms" bigint NOT NULL,
	"type" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"asset" text NOT NULL,
	"asset_decimals" integer DEFAULT 18 NOT NULL,
	"amount_raw" text DEFAULT '0' NOT NULL,
	"amount_usd_cents" bigint DEFAULT 0 NOT NULL,
	"protocol" text,
	"attestation_id" text,
	"verified" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credited_at" timestamp with time zone,
	"last_evaluation_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"engine_version" text NOT NULL,
	"evidence_score" double precision DEFAULT 0 NOT NULL,
	"capital_independence" double precision DEFAULT 0 NOT NULL,
	"economic_diversity" double precision DEFAULT 0 NOT NULL,
	"behavioral_coherence" double precision DEFAULT 0 NOT NULL,
	"strength" text DEFAULT 'none' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"verified_event_count" integer DEFAULT 0 NOT NULL,
	"volume_usd_cents" bigint DEFAULT 0 NOT NULL,
	"evidence_hash" text NOT NULL,
	"contributing_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"credited" boolean DEFAULT false NOT NULL,
	"job_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_event_links" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"event_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"kind" text DEFAULT 'contributing' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_test_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_key" text NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text,
	"evaluation_id" text,
	"decision_id" text,
	"job_id" text,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"evidence_score" double precision DEFAULT 0 NOT NULL,
	"credit_increase_usd_cents" bigint DEFAULT 0 NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_test_scenarios" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"narrative" text DEFAULT '' NOT NULL,
	"expectation" text DEFAULT '' NOT NULL,
	"fixture_key" text NOT NULL,
	"wallet_id" text,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"volume_usd_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"wallet_id" text,
	"user_id" text,
	"current_step" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_reference" jsonb,
	"error" text,
	"error_code" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"chain_id" integer,
	"name" text NOT NULL,
	"family" text DEFAULT 'evm' NOT NULL,
	"attestcoin_chain_key" integer,
	"rpc_configured" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"explorer_tx_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'defi' NOT NULL,
	"chain_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"raw_transaction_id" text NOT NULL,
	"chain_key" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"address" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" text,
	"decoded" jsonb
);
--> statement-breakpoint
CREATE TABLE "raw_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"chain_key" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_height" bigint NOT NULL,
	"from" text NOT NULL,
	"to" text,
	"value_raw" text DEFAULT '0' NOT NULL,
	"data" text,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"timestamp_ms" bigint NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repayments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"position_id" text,
	"amount_usd_cents" bigint NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onchain_reference" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" text,
	"mode" text DEFAULT 'demo' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'demo' NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text NOT NULL,
	"chain_key" text NOT NULL,
	"signer_type" text DEFAULT 'eip191' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_networks" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"network_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"family" text DEFAULT 'evm' NOT NULL,
	"label" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"scenario_key" text,
	"status" text DEFAULT 'CONNECTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrow_positions" ADD CONSTRAINT "borrow_positions_account_id_credit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_decisions" ADD CONSTRAINT "credit_decisions_account_id_credit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_decisions" ADD CONSTRAINT "credit_decisions_evaluation_id_evidence_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evidence_evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_account_id_credit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_events" ADD CONSTRAINT "economic_events_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_events" ADD CONSTRAINT "economic_events_attestation_id_attestations_id_fk" FOREIGN KEY ("attestation_id") REFERENCES "public"."attestations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_evaluations" ADD CONSTRAINT "evidence_evaluations_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_evaluations" ADD CONSTRAINT "evidence_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_event_links" ADD CONSTRAINT "evidence_event_links_evaluation_id_evidence_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evidence_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_event_links" ADD CONSTRAINT "evidence_event_links_event_id_economic_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."economic_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_factors" ADD CONSTRAINT "evidence_factors_evaluation_id_evidence_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evidence_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_test_runs" ADD CONSTRAINT "farm_test_runs_scenario_key_farm_test_scenarios_key_fk" FOREIGN KEY ("scenario_key") REFERENCES "public"."farm_test_scenarios"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_test_scenarios" ADD CONSTRAINT "farm_test_scenarios_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_logs" ADD CONSTRAINT "raw_logs_raw_transaction_id_raw_transactions_id_fk" FOREIGN KEY ("raw_transaction_id") REFERENCES "public"."raw_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_transactions" ADD CONSTRAINT "raw_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_account_id_credit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_position_id_borrow_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."borrow_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_connections" ADD CONSTRAINT "wallet_connections_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_connections" ADD CONSTRAINT "wallet_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_networks" ADD CONSTRAINT "wallet_networks_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_uidx" ON "assets" USING btree ("symbol","chain_key","contract_address");--> statement-breakpoint
CREATE UNIQUE INDEX "attestations_uidx" ON "attestations" USING btree ("provider","chain_key","source_tx_hash");--> statement-breakpoint
CREATE INDEX "attestations_event_idx" ON "attestations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "attestations_status_idx" ON "attestations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attestations_block_idx" ON "attestations" USING btree ("chain_key","block_height");--> statement-breakpoint
CREATE INDEX "audit_logs_wallet_idx" ON "audit_logs" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_nonces_address_idx" ON "auth_nonces" USING btree ("address");--> statement-breakpoint
CREATE INDEX "auth_nonces_expires_idx" ON "auth_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "borrow_positions_account_idx" ON "borrow_positions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "borrow_positions_status_idx" ON "borrow_positions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_accounts_wallet_uidx" ON "credit_accounts" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "credit_accounts_user_idx" ON "credit_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_decisions_hash_uidx" ON "credit_decisions" USING btree ("wallet_id","evidence_hash");--> statement-breakpoint
CREATE INDEX "credit_decisions_account_idx" ON "credit_decisions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "credit_decisions_wallet_idx" ON "credit_decisions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "credit_decisions_evaluation_idx" ON "credit_decisions" USING btree ("evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transactions_idem_uidx" ON "credit_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_transactions_account_idx" ON "credit_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_wallet_idx" ON "credit_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_kind_idx" ON "credit_transactions" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "economic_events_uidx" ON "economic_events" USING btree ("wallet_id","chain_key","tx_hash","log_index","type");--> statement-breakpoint
CREATE INDEX "economic_events_wallet_idx" ON "economic_events" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "economic_events_tx_idx" ON "economic_events" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "economic_events_block_idx" ON "economic_events" USING btree ("chain_key","block_height");--> statement-breakpoint
CREATE INDEX "economic_events_ts_idx" ON "economic_events" USING btree ("timestamp_ms");--> statement-breakpoint
CREATE INDEX "economic_events_type_idx" ON "economic_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "economic_events_attestation_idx" ON "economic_events" USING btree ("attestation_id");--> statement-breakpoint
CREATE INDEX "economic_events_credited_idx" ON "economic_events" USING btree ("credited_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_evaluations_hash_uidx" ON "evidence_evaluations" USING btree ("wallet_id","evidence_hash");--> statement-breakpoint
CREATE INDEX "evidence_evaluations_wallet_idx" ON "evidence_evaluations" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "evidence_evaluations_job_idx" ON "evidence_evaluations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "evidence_evaluations_created_idx" ON "evidence_evaluations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_event_links_uidx" ON "evidence_event_links" USING btree ("evaluation_id","event_id");--> statement-breakpoint
CREATE INDEX "evidence_event_links_event_idx" ON "evidence_event_links" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "evidence_event_links_wallet_idx" ON "evidence_event_links" USING btree ("wallet_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_factors_uidx" ON "evidence_factors" USING btree ("evaluation_id","key");--> statement-breakpoint
CREATE INDEX "evidence_factors_evaluation_idx" ON "evidence_factors" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "farm_test_runs_scenario_idx" ON "farm_test_runs" USING btree ("scenario_key");--> statement-breakpoint
CREATE INDEX "farm_test_runs_wallet_idx" ON "farm_test_runs" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "farm_test_scenarios_wallet_idx" ON "farm_test_scenarios" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_wallet_idx" ON "jobs" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "jobs_type_status_idx" ON "jobs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "jobs_created_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "networks_key_uidx" ON "networks" USING btree ("key");--> statement-breakpoint
CREATE INDEX "networks_chain_id_idx" ON "networks" USING btree ("chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "protocols_key_uidx" ON "protocols" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_logs_uidx" ON "raw_logs" USING btree ("chain_key","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "raw_logs_tx_idx" ON "raw_logs" USING btree ("raw_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_transactions_uidx" ON "raw_transactions" USING btree ("chain_key","tx_hash");--> statement-breakpoint
CREATE INDEX "raw_transactions_wallet_idx" ON "raw_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "raw_transactions_block_idx" ON "raw_transactions" USING btree ("chain_key","block_height");--> statement-breakpoint
CREATE INDEX "raw_transactions_ts_idx" ON "raw_transactions" USING btree ("timestamp_ms");--> statement-breakpoint
CREATE INDEX "repayments_account_idx" ON "repayments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "repayments_position_idx" ON "repayments" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_mode_idx" ON "users" USING btree ("mode");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_connections_uidx" ON "wallet_connections" USING btree ("wallet_id","chain_key");--> statement-breakpoint
CREATE INDEX "wallet_connections_user_idx" ON "wallet_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_networks_uidx" ON "wallet_networks" USING btree ("wallet_id","network_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_uidx" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "wallets_user_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_scenario_idx" ON "wallets" USING btree ("scenario_key");