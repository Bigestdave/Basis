import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { INITIAL_MIGRATION_STATEMENTS } from "./migrations/initial";

const envUrl = process.env.DATABASE_URL || "";
const isExplicitPgLite = process.env.USE_PGLITE === "true";
const isLocalDefault = !envUrl || envUrl.includes("localhost:5432/basis");
const usePostgres = Boolean(envUrl) && !isLocalDefault && !isExplicitPgLite;

const globalForDb = globalThis as typeof globalThis & {
  __basisPglite?: PGlite;
  __basisPool?: Pool;
  __basisDb?: any;
  __basisBootstrapPromise?: Promise<void>;
};

let poolInstance: Pool | undefined;
let pgliteInstance: PGlite | undefined;
let dbInstance: any;

function initDriver(): void {
  if (dbInstance) return;

  if (usePostgres) {
    poolInstance =
      globalForDb.__basisPool ??
      new Pool({
        connectionString: envUrl,
        ssl:
          envUrl.includes("supabase.co") || envUrl.includes("pooler.supabase.com")
            ? { rejectUnauthorized: false }
            : undefined,
      });

    if (process.env.NODE_ENV !== "production") {
      globalForDb.__basisPool = poolInstance;
    }

    dbInstance = drizzleNodePg(poolInstance, { schema });
  } else {
    const dataDir =
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
        ? "/tmp/.pglite"
        : path.join(process.cwd(), ".pglite");

    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // Ignore directory creation failure in locked environments
    }

    pgliteInstance =
      globalForDb.__basisPglite ??
      new PGlite(dataDir);

    if (process.env.NODE_ENV !== "production") {
      globalForDb.__basisPglite = pgliteInstance;
    }

    dbInstance = drizzlePglite(pgliteInstance, { schema });
  }
}

async function rawQuery(sql: string, params?: any[]): Promise<{ rows: any[] }> {
  initDriver();
  if (usePostgres) {
    return poolInstance!.query(sql, params);
  }
  return pgliteInstance!.query(sql, params);
}

async function rawExec(sql: string): Promise<any> {
  initDriver();
  if (usePostgres) {
    return poolInstance!.query(sql);
  }
  return pgliteInstance!.exec(sql);
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    initDriver();
    if (poolInstance) {
      const val = (poolInstance as any)[prop];
      return typeof val === "function" ? val.bind(poolInstance) : val;
    }
    if (prop === "end") return async () => {};
    if (prop === "query") return rawQuery;
    return undefined;
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzleNodePg<typeof schema>>, {
  get(_target, prop) {
    initDriver();
    const value = (dbInstance as any)[prop];
    return typeof value === "function" ? value.bind(dbInstance) : value;
  },
});

export async function ensureDatabaseReady(): Promise<void> {
  if (globalForDb.__basisBootstrapPromise) {
    return globalForDb.__basisBootstrapPromise;
  }

  globalForDb.__basisBootstrapPromise = (async () => {
    try {
      initDriver();

      // 1. Check if the users table exists
      const checkRes = await rawQuery(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1;"
      );
      const exists = checkRes.rows && checkRes.rows.length > 0;

      if (!exists) {
        console.log("[Basis DB] Initializing schema tables...");
        for (const stmt of INITIAL_MIGRATION_STATEMENTS) {
          try {
            await rawExec(stmt);
          } catch (stmtErr: any) {
            if (!stmtErr.message?.includes("already exists")) {
              console.warn("[Basis DB] Migration warning:", stmtErr.message);
            }
          }
        }
        console.log("[Basis DB] Schema tables initialized successfully.");
      }

      // 2. Check if demo accounts exist
      const userCountRes = await rawQuery("SELECT COUNT(*)::int as cnt FROM users;");
      const cnt = Number(userCountRes.rows[0]?.cnt || 0);

      if (cnt === 0) {
        console.log("[Basis DB] Database empty. Running initial demo seed...");
        const { seedInitialData } = await import("./seed");
        await seedInitialData();
        console.log("[Basis DB] Initial demo seed completed.");
      }
    } catch (err) {
      console.error("[Basis DB] Error ensuring database ready:", err);
    }
  })();

  return globalForDb.__basisBootstrapPromise;
}
