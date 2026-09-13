/**
 * Pure credit-account arithmetic and invariants.
 *
 *   available  = creditLimit - borrowed
 *   utilization = borrowed / creditLimit
 *
 * These functions never touch the database and never trust a caller-supplied
 * balance: they take the persisted account state and return the next state, or
 * throw a typed AppError. The repository layer wraps them in a transaction.
 */
import { AppError } from "@/lib/errors";
import { clamp } from "@/lib/money";

export interface AccountState {
  creditLimitUsdCents: number;
  borrowedUsdCents: number;
}

export interface AccountMutation {
  creditLimitUsdCents: number;
  borrowedUsdCents: number;
  availableUsdCents: number;
  utilization: number;
}

export function projectAccount(state: AccountState): AccountMutation {
  const creditLimit = Math.max(0, Math.round(state.creditLimitUsdCents));
  const borrowed = Math.max(0, Math.round(state.borrowedUsdCents));
  const available = Math.max(0, creditLimit - borrowed);
  return {
    creditLimitUsdCents: creditLimit,
    borrowedUsdCents: borrowed,
    availableUsdCents: available,
    utilization: creditLimit > 0 ? Math.round(clamp(borrowed / creditLimit, 0, 1) * 10_000) / 10_000 : 0,
  };
}

export function validateBorrow(state: AccountState, amountUsdCents: number): AccountMutation {
  if (!Number.isFinite(amountUsdCents)) {
    throw new AppError("borrow_amount_invalid", "Borrow amount must be a finite number.");
  }
  const amount = Math.round(amountUsdCents);
  if (amount <= 0) {
    throw new AppError("borrow_amount_invalid", "Borrow amount must be greater than zero.");
  }
  const current = projectAccount(state);
  if (current.creditLimitUsdCents <= 0) {
    throw new AppError("credit_account_missing", "No credit limit has been established yet. Build credit from verified economic evidence first.");
  }
  if (amount > current.availableUsdCents) {
    throw new AppError(
      "borrow_exceeds_available",
      `Requested $${(amount / 100).toFixed(2)} but only $${(current.availableUsdCents / 100).toFixed(2)} of credit is available.`,
      { details: { requestedUsdCents: amount, availableUsdCents: current.availableUsdCents } },
    );
  }
  const next = projectAccount({
    creditLimitUsdCents: current.creditLimitUsdCents,
    borrowedUsdCents: current.borrowedUsdCents + amount,
  });
  if (next.borrowedUsdCents > next.creditLimitUsdCents) {
    throw new AppError("credit_limit_exceeded", "Borrowing would push the outstanding balance past the credit limit.");
  }
  return next;
}

export function validateRepay(state: AccountState, amountUsdCents: number): AccountMutation {
  if (!Number.isFinite(amountUsdCents)) {
    throw new AppError("repay_amount_invalid", "Repayment amount must be a finite number.");
  }
  const amount = Math.round(amountUsdCents);
  if (amount <= 0) {
    throw new AppError("repay_amount_invalid", "Repayment amount must be greater than zero.");
  }
  const current = projectAccount(state);
  if (current.borrowedUsdCents <= 0) {
    throw new AppError("repay_exceeds_borrowed", "There is no outstanding balance to repay.");
  }
  if (amount > current.borrowedUsdCents) {
    throw new AppError(
      "repay_exceeds_borrowed",
      `Repayment of $${(amount / 100).toFixed(2)} exceeds the outstanding balance of $${(current.borrowedUsdCents / 100).toFixed(2)}.`,
      { details: { requestedUsdCents: amount, borrowedUsdCents: current.borrowedUsdCents } },
    );
  }
  return projectAccount({
    creditLimitUsdCents: current.creditLimitUsdCents,
    borrowedUsdCents: current.borrowedUsdCents - amount,
  });
}

export function validateLimitUpdate(
  state: AccountState,
  nextLimitUsdCents: number,
  capUsdCents: number,
): AccountMutation {
  const next = Math.max(0, Math.round(nextLimitUsdCents));
  if (next > capUsdCents) {
    throw new AppError("credit_limit_exceeded", `Credit limit cannot exceed the absolute cap of $${(capUsdCents / 100).toFixed(2)}.`);
  }
  if (next < state.borrowedUsdCents) {
    throw new AppError(
      "credit_limit_exceeded",
      "Credit limit cannot be lowered below the outstanding borrowed balance.",
    );
  }
  return projectAccount({ creditLimitUsdCents: next, borrowedUsdCents: state.borrowedUsdCents });
}
