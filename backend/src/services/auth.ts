/**
 * Wallet authentication.
 *
 *   1. connect wallet          (client)
 *   2. POST /api/auth/nonce    -> server generates a single-use nonce + message
 *   3. wallet signs the message (client-side only; keys never leave the wallet)
 *   4. POST /api/auth/verify   -> server verifies the signature
 *   5. server creates a session and associates the wallet with the user
 *
 * A client-supplied address is never trusted: ownership is proved by signature.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authNonces, creditAccounts, sessions, users, wallets } from "@/db/schema";
import { APP_MODE, NONCE_TTL_MS, SESSION_TTL_MS } from "@/lib/config";
import {
  deterministicId,
  isEvmAddress,
  normalizeAddress,
  randomHex,
} from "@/lib/deterministic";
import { AppError } from "@/lib/errors";
import { getSignerForAddress } from "@/providers";
import { demoScenarioForAddress } from "@/providers/demo/fixtures";
import { audit } from "./audit";
import { projectAccount } from "@/domain/credit/account";

export function walletIdForAddress(address: string): string {
  const normalized = normalizeAddress(address);
  const scenario = demoScenarioForAddress(normalized);
  return scenario ? `wal_demo_${scenario.key}` : deterministicId("wallet", normalized);
}

export function userIdForAddress(address: string): string {
  const normalized = normalizeAddress(address);
  const scenario = demoScenarioForAddress(normalized);
  return scenario ? `usr_demo_${scenario.key}` : deterministicId("user", normalized);
}

export function buildAuthMessage(input: { address: string; nonce: string; origin: string; issuedAt: number; expiresAt: number }): string {
  return [
    "BASIS wants you to sign in with your wallet:",
    input.address,
    "",
    "Signing proves control of this address. BASIS converts your verified on-chain",
    "economic activity into evidence and then into credit. This signature does not",
    "authorise any transaction and BASIS never asks for a private key or seed phrase.",
    "",
    `Nonce: ${input.nonce}`,
    `URI: ${input.origin}`,
    `Issued At: ${new Date(input.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(input.expiresAt).toISOString()}`,
    "Version: 1",
  ].join("\n");
}

export interface NonceResult {
  nonce: string;
  message: string;
  address: string;
  expiresAt: number;
  mode: string;
}

export async function issueNonce(input: {
  address: string;
  origin: string;
  ip: string;
}): Promise<NonceResult> {
  if (!isEvmAddress(input.address)) {
    throw new AppError("wallet_unsupported", "Address is not a valid EVM address. BASIS currently supports EVM wallets.");
  }
  const address = normalizeAddress(input.address);
  const nonce = randomHex(16);
  const now = Date.now();
  const expiresAt = now + NONCE_TTL_MS;
  const message = buildAuthMessage({ address, nonce, origin: input.origin, issuedAt: now, expiresAt });

  await db.insert(authNonces).values({
    nonce,
    address,
    message,
    status: "PENDING",
    ipAddress: input.ip,
    expiresAt: new Date(expiresAt),
  });

  await audit({
    action: "auth.nonce_issued",
    userId: userIdForAddress(address),
    referenceId: nonce,
    ipAddress: input.ip,
    metadata: { address },
  });

  return { nonce, message, address, expiresAt, mode: APP_MODE };
}

export interface VerifyResult {
  sessionToken: string;
  expiresAt: number;
  userId: string;
  walletId: string;
  address: string;
  isDemoWallet: boolean;
  scenarioKey: string | null;
}

export async function verifySignatureAndCreateSession(input: {
  address: string;
  signature: string;
  nonce: string;
  ip: string;
  userAgent?: string | null;
}): Promise<VerifyResult> {
  const address = normalizeAddress(input.address);
  const rows = await db.select().from(authNonces).where(eq(authNonces.nonce, input.nonce)).limit(1);
  const nonceRow = rows[0];
  if (!nonceRow) {
    throw new AppError("nonce_unknown", "This authentication challenge is not recognised. Request a new nonce.");
  }
  if (nonceRow.status === "CONSUMED") {
    throw new AppError("nonce_reused", "This authentication challenge has already been used. Request a new nonce.");
  }
  if (nonceRow.expiresAt.getTime() < Date.now()) {
    await db.update(authNonces).set({ status: "EXPIRED" }).where(eq(authNonces.nonce, input.nonce));
    throw new AppError("nonce_expired", "This authentication challenge expired. Request a new nonce.");
  }
  if (nonceRow.address !== address) {
    throw new AppError("signature_invalid", "The challenge was issued for a different address.");
  }

  const signer = await getSignerForAddress(address);
  const verification = await signer.verify({
    address,
    message: nonceRow.message,
    signature: input.signature,
  });

  if (!verification.valid) {
    await audit({
      action: "auth.signature_verified",
      userId: userIdForAddress(address),
      referenceId: input.nonce,
      result: "failure",
      ipAddress: input.ip,
      metadata: { reason: verification.reason ?? "invalid" },
    });
    throw new AppError(
      "signature_invalid",
      verification.reason ?? "Signature verification failed. Confirm you signed the exact challenge message.",
    );
  }

  // Consume the nonce exactly once.
  await db
    .update(authNonces)
    .set({ status: "CONSUMED", consumedAt: new Date(), walletId: walletIdForAddress(address) })
    .where(and(eq(authNonces.nonce, input.nonce), eq(authNonces.status, "PENDING")));

  const scenario = demoScenarioForAddress(address);
  const userId = userIdForAddress(address);
  const walletId = walletIdForAddress(address);

  await db
    .insert(users)
    .values({ id: userId, mode: scenario ? "demo" : APP_MODE, label: scenario?.label ?? null })
    .onConflictDoUpdate({ target: users.id, set: { lastSeenAt: new Date() } });

  await db
    .insert(wallets)
    .values({
      id: walletId,
      userId,
      address,
      family: "evm",
      label: scenario?.label ?? "Connected wallet",
      isDemo: Boolean(scenario),
      scenarioKey: scenario?.key ?? null,
      status: "CONNECTED",
    })
    .onConflictDoUpdate({ target: wallets.id, set: { status: "CONNECTED", updatedAt: new Date() } });

  await ensureCreditAccount(walletId, userId, scenario?.startingCreditLimitUsdCents ?? 0, scenario?.startingBorrowedUsdCents ?? 0);

  const sessionToken = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sessionToken,
    userId,
    walletId,
    mode: scenario ? "demo" : APP_MODE,
    ipAddress: input.ip,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  await audit({
    action: "auth.signature_verified",
    userId,
    walletId,
    referenceId: input.nonce,
    ipAddress: input.ip,
    metadata: { signerType: verification.signerType, address },
  });
  await audit({ action: "auth.session_created", userId, walletId, referenceId: sessionToken, ipAddress: input.ip });
  await audit({ action: "wallet.verified", userId, walletId, referenceId: walletId, metadata: { signerType: verification.signerType } });

  return {
    sessionToken,
    expiresAt: expiresAt.getTime(),
    userId,
    walletId,
    address,
    isDemoWallet: Boolean(scenario),
    scenarioKey: scenario?.key ?? null,
  };
}

/**
 * Demo affordance: produce a signature for a *simulated* demo wallet so the exact
 * same verification path runs. Refuses for any address that is not a demo wallet
 * and refuses entirely in live mode.
 */
export async function demoSign(input: { address: string; message: string }): Promise<{ signature: string; signerType: string }> {
  const address = normalizeAddress(input.address);
  const scenario = demoScenarioForAddress(address);
  if (!scenario) {
    throw new AppError("demo_mode_only", "Demo signing is only available for BASIS demo wallets.");
  }
  const signer = await getSignerForAddress(address);
  if (!signer.signDemo) {
    throw new AppError("demo_mode_only", "The active signer does not support demo signing.");
  }
  const result = await signer.signDemo({ address, message: input.message });
  await audit({
    action: "auth.demo_sign",
    userId: userIdForAddress(address),
    walletId: walletIdForAddress(address),
    metadata: { scenarioKey: scenario.key },
  });
  return result;
}

export async function ensureCreditAccount(
  walletId: string,
  userId: string,
  startingLimitUsdCents = 0,
  startingBorrowedUsdCents = 0,
): Promise<string> {
  const accountId = deterministicId("account", walletId);
  await db
    .insert(creditAccounts)
    .values({
      id: accountId,
      walletId,
      userId,
      creditLimitUsdCents: startingLimitUsdCents,
      borrowedUsdCents: startingBorrowedUsdCents,
      provider: APP_MODE === "live" ? "creditcoin" : "demo",
      onchain: false,
    })
    .onConflictDoNothing({ target: creditAccounts.id });
  return accountId;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function getAccountSnapshot(walletId: string) {
  const rows = await db
    .select({ account: creditAccounts, wallet: wallets, user: users })
    .from(creditAccounts)
    .innerJoin(wallets, eq(wallets.id, creditAccounts.walletId))
    .innerJoin(users, eq(users.id, creditAccounts.userId))
    .where(eq(creditAccounts.walletId, walletId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const projected = projectAccount({
    creditLimitUsdCents: row.account.creditLimitUsdCents,
    borrowedUsdCents: row.account.borrowedUsdCents,
  });
  return { row: row.account, wallet: row.wallet, user: row.user, projected };
}
