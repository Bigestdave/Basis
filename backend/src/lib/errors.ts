/**
 * Typed error taxonomy. Every failure the frontend can encounter has an explicit
 * code so the UI can render a useful state instead of a generic spinner/error.
 */

export type ErrorCode =
  // auth / wallet
  | "wallet_rejected"
  | "wallet_unsupported"
  | "wrong_network"
  | "signature_invalid"
  | "nonce_expired"
  | "nonce_unknown"
  | "nonce_reused"
  | "unauthenticated"
  | "forbidden"
  | "session_expired"
  | "demo_mode_only"
  | "live_mode_only"
  // validation
  | "validation_error"
  | "not_found"
  | "conflict"
  | "rate_limited"
  // chain / attestation
  | "rpc_unavailable"
  | "chain_unsupported"
  | "transaction_not_found"
  | "attestation_unavailable"
  | "attestation_failed"
  | "attestation_pending"
  // evidence
  | "insufficient_evidence"
  | "no_new_events"
  | "evaluation_cooldown"
  | "stale_events"
  | "duplicate_evaluation"
  // credit
  | "credit_account_missing"
  | "borrow_exceeds_available"
  | "borrow_amount_invalid"
  | "repay_exceeds_borrowed"
  | "repay_amount_invalid"
  | "credit_limit_exceeded"
  | "credit_update_failed"
  | "duplicate_transaction"
  // infra
  | "database_failure"
  | "job_failed"
  | "job_timeout"
  | "job_not_found"
  | "internal_error";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; details?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.details = options.details ?? {};
    this.cause = options.cause;
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case "validation_error":
    case "borrow_amount_invalid":
    case "repay_amount_invalid":
      return 400;
    case "unauthenticated":
    case "session_expired":
    case "nonce_expired":
    case "nonce_unknown":
    case "signature_invalid":
      return 401;
    case "forbidden":
    case "wallet_rejected":
      return 403;
    case "not_found":
    case "job_not_found":
    case "transaction_not_found":
    case "credit_account_missing":
      return 404;
    case "conflict":
    case "nonce_reused":
    case "duplicate_evaluation":
    case "duplicate_transaction":
    case "evaluation_cooldown":
    case "borrow_exceeds_available":
    case "repay_exceeds_borrowed":
    case "credit_limit_exceeded":
    case "no_new_events":
    case "insufficient_evidence":
    case "stale_events":
    case "wrong_network":
    case "chain_unsupported":
      return 409;
    case "rate_limited":
      return 429;
    case "attestation_pending":
      return 202;
    default:
      return 500;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new AppError("validation_error", message, { details });

export const unauthorized = (message = "Authentication required") =>
  new AppError("unauthenticated", message);

export const forbidden = (message = "Not authorized for this resource") =>
  new AppError("forbidden", message);

export const notFound = (message: string, details?: Record<string, unknown>) =>
  new AppError("not_found", message, { details });

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Wrap an unknown throwable into an AppError without losing the original code. */
export function toAppError(err: unknown, fallbackMessage = "Unexpected server error"): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Error) {
    return new AppError("internal_error", fallbackMessage, {
      details: { reason: err.message },
      cause: err,
    });
  }
  return new AppError("internal_error", fallbackMessage, { cause: err });
}
