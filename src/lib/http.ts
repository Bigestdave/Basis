/**
 * HTTP layer: session resolution, authorization, rate limiting, validation and
 * a single error boundary so every route returns the same envelope.
 *
 * Response envelope:
 *   success -> { data: ... , meta?: ... }
 *   failure -> { error: { code, message, details } }
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { sessions, users, wallets } from "@/db/schema";
import { rateLimitConfig, SESSION_COOKIE_NAME } from "@/lib/config";
import { AppError, badRequest, forbidden, isAppError, notFound, toAppError, unauthorized } from "@/lib/errors";
import { randomHex } from "@/lib/deterministic";
import { z } from "zod";

export interface AuthContext {
  userId: string;
  sessionId: string;
  mode: string;
  walletId: string | null;
  address: string | null;
  isDemoWallet: boolean;
}

export interface HandlerContext {
  request: NextRequest;
  params: Record<string, string>;
  auth: AuthContext | null;
  ip: string;
  url: URL;
}

export type AuthRequirement = "required" | "optional" | "none";
export type RateBucket = "auth" | "mutation" | "read";

/* -------------------------------------------------------------------------- */
/* Rate limiting (in-process sliding window)                                  */
/* -------------------------------------------------------------------------- */

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, bucket: RateBucket): { ok: boolean; retryAfterMs: number } {
  const max =
    bucket === "auth" ? rateLimitConfig.authMax : bucket === "mutation" ? rateLimitConfig.mutationMax : rateLimitConfig.readMax;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rateLimitConfig.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  existing.count += 1;
  if (existing.count > max) return { ok: false, retryAfterMs: existing.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export function readSessionToken(request: NextRequest): string | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && cookie.length >= 32) return cookie;
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export async function resolveAuth(request: NextRequest): Promise<AuthContext | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const rows = await db
    .select({ session: sessions, user: users, wallet: wallets })
    .from(sessions)
    .leftJoin(users, eq(users.id, sessions.userId))
    .leftJoin(wallets, eq(wallets.id, sessions.walletId))
    .where(
      and(
        eq(sessions.id, token),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.session || !row.user) return null;
  return {
    userId: row.user.id,
    sessionId: row.session.id,
    mode: row.session.mode,
    walletId: row.wallet?.id ?? null,
    address: row.wallet?.address ?? null,
    isDemoWallet: row.wallet?.isDemo ?? false,
  };
}

export function newSessionToken(): string {
  return randomHex(32);
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export async function parseBody<T extends z.ZodTypeAny>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("validation_error", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation_error", "Request validation failed.", {
      details: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  return parsed.data;
}

export function parseQuery(url: URL, schema: z.ZodTypeAny) {
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation_error", "Query validation failed.", {
      details: { issues: parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  return parsed.data;
}

/* -------------------------------------------------------------------------- */
/* Response helpers                                                           */
/* -------------------------------------------------------------------------- */

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown>; headers?: HeadersInit }): Response {
  const body = init?.meta ? { data, meta: init.meta } : { data };
  return Response.json(body, { status: init?.status ?? 200, headers: init?.headers });
}

export function fail(error: AppError, headers?: HeadersInit): Response {
  const init: ResponseInit & { headers?: HeadersInit } = { status: error.status, headers };
  if (error.code === "rate_limited") {
    init.headers = { ...headers, "retry-after": String(Math.ceil((error.details.retryAfterMs as number ?? 0) / 1000)) };
  }
  return Response.json(error.toJSON(), init);
}

export interface RouteOptions {
  auth?: AuthRequirement;
  rateLimit?: RateBucket;
}

/**
 * Uniform route wrapper. Every handler goes through auth + rate limiting +
 * the single error boundary.
 */
export function route(
  options: RouteOptions,
  handler: (ctx: HandlerContext & { body: <T extends z.ZodTypeAny>(schema: T) => Promise<z.infer<T>> }) => Promise<Response>,
) {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    const params = context?.params ? await context.params : {};
    const ip = clientIp(request);
    try {
      const bucket = options.rateLimit ?? "read";
      const limitKey = `${bucket}:${ip}:${new URL(request.url).pathname}`;
      const limited = consumeRateLimit(limitKey, bucket);
      if (!limited.ok) {
        throw new AppError("rate_limited", "Too many requests. Please slow down.", {
          details: { retryAfterMs: limited.retryAfterMs },
        });
      }

      const auth = await resolveAuth(request);
      if (options.auth === "required" && !auth) throw unauthorized();
      if (options.auth === "required" && auth && !auth.walletId) {
        throw new AppError("wallet_rejected", "No wallet is attached to this session. Connect a wallet first.");
      }

      const url = new URL(request.url);
      return await handler({
        request,
        params,
        auth,
        ip,
        url,
        body: <T extends z.ZodTypeAny>(schema: T) => parseBody<T>(request, schema),
      });
    } catch (err) {
      const appError = toAppError(err);
      if (appError.status >= 500) {
        console.error("[basis] route error", { code: appError.code, message: appError.message, path: request.nextUrl.pathname });
      }
      return fail(appError);
    }
  };
}

/** Assert the session's wallet matches the resource being accessed. */
export function assertWalletAccess(auth: AuthContext, walletId: string): void {
  if (auth.walletId !== walletId) {
    throw new AppError("forbidden", "This wallet does not belong to the authenticated session.");
  }
}

export { isAppError, notFound, forbidden, badRequest, unauthorized };
