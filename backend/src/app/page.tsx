import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { economicEvents, creditAccounts, evidenceEvaluations, creditDecisions, jobs, attestations } from "@/db/schema";
import { serverInfo } from "@/lib/config";

export const dynamic = "force-dynamic";

async function count(table: PgTable) {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.n ?? 0;
}

/**
 * Backend status console. The BASIS product UI is a separate frontend that talks
 * to the API documented in docs/API.md; this page exists so the running server's
 * health, mode and ledger contents can be verified without a client.
 */
export default async function HomePage() {
  let database = "connected";
  let stats = null as null | Record<string, number>;
  try {
    await db.execute(sql`select 1`);
    stats = {
      economicEvents: await count(economicEvents),
      attestations: await count(attestations),
      evaluations: await count(evidenceEvaluations),
      creditDecisions: await count(creditDecisions),
      creditAccounts: await count(creditAccounts),
      jobs: await count(jobs),
    };
  } catch {
    database = "unreachable";
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-12 font-mono text-neutral-200">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">BASIS backend</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Economic activity → economic evidence → credit. Mode: <span className="text-white">{serverInfo.appMode}</span> · database:{" "}
          <span className="text-white">{database}</span>
        </p>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats
            ? Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">{key}</div>
                  <div className="mt-1 text-xl text-white">{value}</div>
                </div>
              ))
            : null}
        </section>

        <section className="mt-8 rounded border border-neutral-800 bg-neutral-900 p-4 text-xs leading-relaxed">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Engine</div>
          <p className="mt-2 text-neutral-300">
            S = C^0.45 × D^0.30 × Q^0.25 &nbsp;·&nbsp; creditIncrease = ${serverInfo.creditConfig.maxBatchIncreaseUsdCents / 100} × S
          </p>
          <p className="mt-1 text-neutral-500">
            evidence v{serverInfo.evidenceEngineVersion} · credit v{serverInfo.creditEngineVersion} · threshold{" "}
            {serverInfo.creditConfig.minEvidenceThreshold}
          </p>
          <p className="mt-3 text-neutral-500">
            Attestcoin {serverInfo.attestcoin.enabled ? "enabled" : "demo"} ({serverInfo.attestcoin.blockProverAddress}) · Creditcoin{" "}
            {serverInfo.creditcoin.enabled ? "enabled" : "demo"} (chainId {serverInfo.creditcoin.chainId})
          </p>
        </section>

        <section className="mt-8 text-xs text-neutral-500">
          <div className="text-[11px] uppercase tracking-wide text-neutral-600">Endpoints</div>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {[
              "GET  /api/health",
              "GET  /api/settings",
              "POST /api/auth/nonce",
              "POST /api/auth/verify",
              "POST /api/auth/demo",
              "GET  /api/me",
              "GET  /api/wallets",
              "GET  /api/networks",
              "POST /api/evidence/sync",
              "POST /api/evidence/evaluate",
              "GET  /api/evidence",
              "GET  /api/evidence/:id",
              "GET  /api/evaluations/:id",
              "GET  /api/jobs/:id",
              "GET  /api/credit",
              "POST /api/credit/borrow",
              "POST /api/credit/repay",
              "GET  /api/activity",
              "GET  /api/farm-test/scenarios",
              "POST /api/farm-test/run",
              "GET  /api/audit",
            ].map((endpoint) => (
              <li key={endpoint} className="whitespace-pre text-neutral-400">
                {endpoint}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-neutral-600">
            Seed: <span className="text-neutral-400">npx tsx scripts/seed.ts</span> · Tests:{" "}
            <span className="text-neutral-400">npx tsx --test tests/*.test.ts</span> · Calibrate:{" "}
            <span className="text-neutral-400">npx tsx scripts/calibrate.ts</span>
          </p>
        </section>
      </div>
    </main>
  );
}
