/**
 * Credit service: account view, borrow and repay.
 *
 * All arithmetic is delegated to the pure domain functions in
 * `src/domain/credit/account.ts`, which throw typed errors for every invalid
 * transition (negative amounts, over-borrow, over-repay, limit below balance).
 * Persistence uses an optimistic version check plus a unique idempotency key so
 * a retried request can never double-spend credit.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  borrowPositions,
  creditAccounts,
  creditDecisions,
  creditTransactions,
  repayments,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { deterministicId, sha256Hex } from "@/lib/deterministic";
import { usdToCents } from "@/lib/money";
import { validateBorrow, validateRepay } from "@/domain/credit/account";
import { getProvidersForWallet } from "@/providers";
import { audit } from "./audit";
import { serializeAccount, serializeDecision, money } from "./serializers";

export interface CreditView {
  account: ReturnType<typeof serializeAccount> | null;
  latestDecision: ReturnType<typeof serializeDecision> | null;
  decisions: ReturnType<typeof serializeDecision>[];
  transactions: Array<{
    id: string;
    kind: string;
    amount: ReturnType<typeof money>;
    limitAfter: ReturnType<typeof money>;
    borrowedAfter: ReturnType<typeof money>;
    availableAfter: ReturnType<typeof money>;
    referenceId: string | null;
    createdAt: number;
  }>;
  positions: Array<{
    id: string;
    principal: ReturnType<typeof money>;
    outstanding: ReturnType<typeof money>;
    status: string;
    openedAt: number;
    closedAt: number | null;
  }>;
}

export async function getCreditView(walletId: string): Promise<CreditView> {
  const [accountRows, decisionRows, txnRows, positionRows] = await Promise.all([
    db.select().from(creditAccounts).where(eq(creditAccounts.walletId, walletId)).limit(1),
    db.select().from(creditDecisions).where(eq(creditDecisions.walletId, walletId)).orderBy(desc(creditDecisions.createdAt)).limit(25),
    db.select().from(creditTransactions).where(eq(creditTransactions.walletId, walletId)).orderBy(desc(creditTransactions.createdAt)).limit(50),
    db.select().from(borrowPositions).where(eq(borrowPositions.walletId, walletId)).orderBy(desc(borrowPositions.openedAt)).limit(50),
  ]);

  const account = accountRows[0] ?? null;
  return {
    account: account ? serializeAccount(account) : null,
    latestDecision: decisionRows[0] ? serializeDecision(decisionRows[0]) : null,
    decisions: decisionRows.map(serializeDecision),
    transactions: txnRows.map((t) => ({
      id: t.id,
      kind: t.kind,
      amount: money(t.amountUsdCents),
      limitAfter: money(t.limitAfterUsdCents),
      borrowedAfter: money(t.borrowedAfterUsdCents),
      availableAfter: money(t.balanceAfterUsdCents),
      referenceId: t.referenceId,
      createdAt: t.createdAt.getTime(),
    })),
    positions: positionRows.map((p) => ({
      id: p.id,
      principal: money(p.principalUsdCents),
      outstanding: money(p.outstandingUsdCents),
      status: p.status,
      openedAt: p.openedAt.getTime(),
      closedAt: p.closedAt ? p.closedAt.getTime() : null,
    })),
  };
}

export interface BorrowInput {
  walletId: string;
  userId: string;
  address: string;
  isDemo: boolean;
  amountUsd: number;
  idempotencyKey?: string | null;
  ipAddress?: string | null;
}

export async function borrow(input: BorrowInput) {
  const amountCents = usdToCents(input.amountUsd);
  const idempotencyKey = input.idempotencyKey?.trim() || `borrow:${input.walletId}:${sha256Hex(`${amountCents}:${Date.now()}`).slice(0, 16)}`;

  const existing = await db.select().from(creditTransactions).where(eq(creditTransactions.idempotencyKey, idempotencyKey)).limit(1);
  if (existing[0]) {
    throw new AppError("duplicate_transaction", "This borrow request has already been processed.", {
      details: { transactionId: existing[0].id },
    });
  }

  const accountRows = await db.select().from(creditAccounts).where(eq(creditAccounts.walletId, input.walletId)).limit(1);
  const account = accountRows[0];
  if (!account) {
    throw new AppError("credit_account_missing", "No credit account exists for this wallet. Build credit from verified economic evidence first.");
  }
  if (account.status !== "ACTIVE") {
    throw new AppError("forbidden", `Credit account is ${account.status}; borrowing is not permitted.`);
  }

  const next = validateBorrow(
    { creditLimitUsdCents: account.creditLimitUsdCents, borrowedUsdCents: account.borrowedUsdCents },
    amountCents,
  );

  const positionId = deterministicId("position", input.walletId, idempotencyKey);
  const transactionId = deterministicId("txn", positionId);

  await db.insert(borrowPositions).values({
    id: positionId,
    accountId: account.id,
    walletId: input.walletId,
    userId: input.userId,
    principalUsdCents: amountCents,
    outstandingUsdCents: amountCents,
    transactionId,
    status: "OPEN",
  });

  await db.insert(creditTransactions).values({
    id: transactionId,
    accountId: account.id,
    walletId: input.walletId,
    userId: input.userId,
    kind: "BORROW",
    amountUsdCents: amountCents,
    limitAfterUsdCents: next.creditLimitUsdCents,
    borrowedAfterUsdCents: next.borrowedUsdCents,
    balanceAfterUsdCents: next.availableUsdCents,
    referenceId: positionId,
    idempotencyKey,
    metadata: { positionId } as never,
  });

  const updated = await db
    .update(creditAccounts)
    .set({
      borrowedUsdCents: next.borrowedUsdCents,
      updatedAt: new Date(),
      version: account.version + 1,
    })
    .where(and(eq(creditAccounts.id, account.id), eq(creditAccounts.version, account.version)))
    .returning({ id: creditAccounts.id });

  if (updated.length === 0) {
    throw new AppError("credit_update_failed", "The credit account changed while this borrow was being processed. Please retry.");
  }

  const bundle = await getProvidersForWallet(input.isDemo);
  const settlement = await bundle.credit.borrow(
    { walletId: input.walletId, walletAddress: input.address, userId: input.userId, accountId: account.id, mode: bundle.mode },
    { amountUsdCents: amountCents, positionId, transactionId },
  );
  if (settlement.reference) {
    await db.update(borrowPositions).set({ onchainReference: settlement.reference }).where(eq(borrowPositions.id, positionId));
  }

  await audit({
    action: "credit.borrow_created",
    userId: input.userId,
    walletId: input.walletId,
    referenceId: positionId,
    ipAddress: input.ipAddress,
    metadata: { amountCents, settlement: settlement.settled, reference: settlement.reference },
  });

  const view = await getCreditView(input.walletId);
  return { positionId, transactionId, amount: money(amountCents), settlement, credit: view };
}

export interface RepayInput extends Omit<BorrowInput, "amountUsd"> {
  amountUsd: number;
  positionId?: string | null;
}

export async function repay(input: RepayInput) {
  const amountCents = usdToCents(input.amountUsd);
  const idempotencyKey = input.idempotencyKey?.trim() || `repay:${input.walletId}:${sha256Hex(`${amountCents}:${Date.now()}`).slice(0, 16)}`;

  const existing = await db.select().from(creditTransactions).where(eq(creditTransactions.idempotencyKey, idempotencyKey)).limit(1);
  if (existing[0]) {
    throw new AppError("duplicate_transaction", "This repayment has already been processed.", {
      details: { transactionId: existing[0].id },
    });
  }

  const accountRows = await db.select().from(creditAccounts).where(eq(creditAccounts.walletId, input.walletId)).limit(1);
  const account = accountRows[0];
  if (!account) throw new AppError("credit_account_missing", "No credit account exists for this wallet.");

  const next = validateRepay(
    { creditLimitUsdCents: account.creditLimitUsdCents, borrowedUsdCents: account.borrowedUsdCents },
    amountCents,
  );

  // Apply to the oldest open position first (FIFO), then cascade.
  const openPositions = input.positionId
    ? await db.select().from(borrowPositions).where(and(eq(borrowPositions.id, input.positionId), eq(borrowPositions.walletId, input.walletId)))
    : await db
        .select()
        .from(borrowPositions)
        .where(and(eq(borrowPositions.walletId, input.walletId), eq(borrowPositions.status, "OPEN")))
        .orderBy(borrowPositions.openedAt);

  let remaining = amountCents;
  let appliedPositionId: string | null = null;
  for (const position of openPositions) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, position.outstandingUsdCents);
    const outstanding = position.outstandingUsdCents - applied;
    await db
      .update(borrowPositions)
      .set({ outstandingUsdCents: outstanding, status: outstanding === 0 ? "REPAID" : "OPEN", closedAt: outstanding === 0 ? new Date() : null })
      .where(eq(borrowPositions.id, position.id));
    remaining -= applied;
    appliedPositionId = appliedPositionId ?? position.id;
  }

  const repaymentId = deterministicId("txn", input.walletId, idempotencyKey);
  const transactionId = `ctx_${sha256Hex(`repay|${repaymentId}`).slice(0, 32)}`;

  await db.insert(repayments).values({
    id: repaymentId,
    accountId: account.id,
    walletId: input.walletId,
    positionId: appliedPositionId,
    amountUsdCents: amountCents,
    transactionId,
  });

  await db.insert(creditTransactions).values({
    id: transactionId,
    accountId: account.id,
    walletId: input.walletId,
    userId: input.userId,
    kind: "REPAY",
    amountUsdCents: amountCents,
    limitAfterUsdCents: next.creditLimitUsdCents,
    borrowedAfterUsdCents: next.borrowedUsdCents,
    balanceAfterUsdCents: next.availableUsdCents,
    referenceId: repaymentId,
    idempotencyKey,
    metadata: { repaymentId, positionId: appliedPositionId } as never,
  });

  const updated = await db
    .update(creditAccounts)
    .set({
      borrowedUsdCents: next.borrowedUsdCents,
      totalRepaidUsdCents: account.totalRepaidUsdCents + amountCents,
      updatedAt: new Date(),
      version: account.version + 1,
    })
    .where(and(eq(creditAccounts.id, account.id), eq(creditAccounts.version, account.version)))
    .returning({ id: creditAccounts.id });

  if (updated.length === 0) {
    throw new AppError("credit_update_failed", "The credit account changed while this repayment was being processed. Please retry.");
  }

  const bundle = await getProvidersForWallet(input.isDemo);
  const settlement = await bundle.credit.repay(
    { walletId: input.walletId, walletAddress: input.address, userId: input.userId, accountId: account.id, mode: bundle.mode },
    { amountUsdCents: amountCents, repaymentId, transactionId, positionId: appliedPositionId },
  );

  await audit({
    action: "credit.repayment_created",
    userId: input.userId,
    walletId: input.walletId,
    referenceId: repaymentId,
    ipAddress: input.ipAddress,
    metadata: { amountCents, settlement: settlement.settled, reference: settlement.reference },
  });

  const view = await getCreditView(input.walletId);
  return { repaymentId, transactionId, amount: money(amountCents), settlement, credit: view };
}
