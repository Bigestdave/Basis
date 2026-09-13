/**
 * Service layer. Every screen consumes data through these functions.
 * Connects directly to the unified Next.js API routes with live state,
 * with deterministic fallback data if the backend is unreachable.
 */
import {
  assets,
  balanceSeries,
  creditAccount,
  creditTransactions,
  demoUser,
  demoWallet,
  economicEvents,
  evidenceItems,
  evidenceSummary,
  farmScenarios,
  networks,
} from "../data/seed";
import type {
  Asset,
  CreditAccount,
  CreditDecision,
  CreditTransaction,
  EconomicEvent,
  EvidenceItem,
  EvidenceSummary,
  FarmTestScenario,
  Network,
  User,
  VerificationStep,
  Wallet,
} from "../types";

export const DEMO_MODE = true;

const delay = <T,>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const API_BASE_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
    : "";

let storedToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem("basis_session_token") : null;

let sessionPromise: Promise<string | null> | null = null;

export async function ensureSession(): Promise<string | null> {
  if (storedToken) return storedToken;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      const url = `${API_BASE_URL}/api/auth/demo`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey: "strong-history" }),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json && typeof json === "object" && "data" in json ? json.data : json;
        const token = payload?.session?.token;
        if (token) {
          storedToken = token;
          if (typeof window !== "undefined") {
            localStorage.setItem("basis_session_token", token);
          }
          return token;
        }
      }
    } catch (err) {
      console.warn("[Basis Client] Auth handshake error:", err);
    } finally {
      sessionPromise = null;
    }
    return null;
  })();

  return sessionPromise;
}

if (typeof window !== "undefined") {
  void ensureSession();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    if (endpoint !== "/api/auth/demo" && !storedToken) {
      await ensureSession();
    }
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
  } catch {
    return null;
  }
}

export const authService = {
  getUser: async (): Promise<User> => {
    await ensureSession();
    const data = await request<{ user: { id: string; label?: string } }>("/api/me");
    if (data?.user) {
      return {
        ...demoUser,
        id: data.user.id,
        name: data.user.label || demoUser.name,
      };
    }
    return delay(demoUser, 200);
  },
};

export const walletsService = {
  getWallet: async (): Promise<Wallet> => {
    await ensureSession();
    const data = await request<{ wallets: Array<{ address: string; label?: string }> }>("/api/wallets");
    if (data?.wallets && data.wallets.length > 0) {
      const primary = data.wallets[0];
      const shortAddress = `${primary.address.slice(0, 6)}…${primary.address.slice(-4)}`;
      return {
        ...demoWallet,
        address: primary.address,
        shortAddress,
        label: primary.label || demoWallet.label,
      };
    }
    return delay(demoWallet, 380);
  },
  getAssets: (): Promise<Asset[]> => delay(assets, 420),
  getBalanceSeries: () => delay(balanceSeries, 300),
  connect: (provider: Wallet["provider"]): Promise<Wallet> =>
    delay({ ...demoWallet, provider, connected: true }, 1100),
  disconnect: (): Promise<void> => delay(undefined, 300),
};

export const networksService = {
  list: async (): Promise<Network[]> => {
    const data = await request<{ networks: Array<{ key: string; name: string }> }>("/api/networks");
    if (data?.networks && data.networks.length > 0) {
      return networks;
    }
    return delay(networks, 380);
  },
  connect: (id: string): Promise<Network[]> =>
    delay(
      networks.map((n) => (n.id === id ? { ...n, status: "connected", lastActivity: "Apr 24, 2025" } : n)),
      900,
    ),
};

export const activityService = {
  list: async (): Promise<EconomicEvent[]> => {
    await ensureSession();
    const res = await request<{ items?: any[] } | any[]>("/api/activity");
    const rawItems: any[] = Array.isArray(res) ? res : res?.items ?? [];

    if (rawItems && rawItems.length > 0) {
      return rawItems.map((item, idx) => {
        const seedItem = economicEvents[idx % economicEvents.length];
        const kind = (item.type || item.kind || "").toUpperCase();
        const isBorrow = kind === "BORROW" || kind === "borrow";
        const isRepay = kind === "REPAY" || kind === "repay";
        const isDeposit = kind === "DEPOSIT" || kind === "FUNDING" || kind === "deposit" || kind === "settlement";
        const isSwap = kind === "SWAP" || kind === "swapped";

        const amountUsd = item.amount?.usd ?? item.amountUsd ?? 0;
        const timestamp = item.timestamp ?? item.timestampMs ?? Date.now();
        const chainKey = item.chainKey ?? "ethereum-sepolia";

        return {
          id: item.id || seedItem.id,
          type: (isBorrow ? "borrow" : isRepay ? "repay" : isDeposit ? "deposit" : isSwap ? "swapped" : "received") as any,
          category: (isBorrow || isRepay ? "borrow-repay" : isDeposit ? "deposits" : isSwap ? "swaps" : "other") as any,
          title: item.description || item.title || seedItem.title,
          subtitle: `${item.counterparty || "Counterparty"} · ${chainKey}`,
          assetId: "usdc",
          assetSymbol: item.asset || "USDC",
          amount: Math.round(amountUsd),
          amountUsd,
          network: (chainKey.includes("base")
            ? "base"
            : chainKey.includes("creditcoin")
              ? "creditcoin"
              : "ethereum") as any,
          date: new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          time: new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          verified: Boolean(item.verified),
          counterparty: item.counterparty,
          protocol: item.protocol,
          proof: seedItem.proof,
        };
      });
    }
    return delay(economicEvents, 460);
  },
  get: async (id: string): Promise<EconomicEvent | undefined> => {
    const list = await activityService.list();
    return list.find((e) => e.id === id);
  },
};

export const evidenceService = {
  summary: async (): Promise<EvidenceSummary> => {
    await ensureSession();
    const data = await request<{
      summary?: {
        eventCount: number;
        verifiedCount: number;
      };
      latest?: {
        strength: string;
        capitalIndependence: number;
        economicDiversity: number;
        behavioralCoherence: number;
        eventCount: number;
        verifiedEventCount: number;
      };
      evaluation?: {
        strength: string;
        capitalIndependence: number;
        economicDiversity: number;
        behavioralCoherence: number;
        eventCount: number;
        verifiedEventCount: number;
      };
    }>("/api/evidence");

    const ev = data?.latest || data?.evaluation;
    if (ev) {
      return {
        ...evidenceSummary,
        strength: ev.strength === "strong" ? "Strong" : ev.strength === "moderate" ? "Moderate" : "Weak",
        verifiedEvents: ev.verifiedEventCount ?? data?.summary?.verifiedCount ?? evidenceSummary.verifiedEvents,
        fundingSources: Math.max(1, Math.round((ev.capitalIndependence ?? 0.75) * 4)),
        counterparties: Math.max(2, Math.round((ev.economicDiversity ?? 0.65) * 8)),
        protocols: Math.max(1, Math.round((ev.economicDiversity ?? 0.65) * 4)),
      };
    }
    return delay(evidenceSummary, 460);
  },
  list: (): Promise<EvidenceItem[]> => delay(evidenceItems, 460),
};

export const creditService = {
  account: async (): Promise<CreditAccount> => {
    await ensureSession();
    const data = await request<{
      account?: {
        creditLimit: { usd: number };
        borrowed: { usd: number };
        available: { usd: number };
        utilizationPercent?: number;
        tier?: string;
      };
      creditLimit?: { usd: number };
      borrowed?: { usd: number };
      available?: { usd: number };
      utilizationPercent?: number;
      tier?: string;
    }>("/api/credit");

    const raw = data?.account || data;
    if (raw?.creditLimit) {
      const limit = raw.creditLimit.usd;
      const borrowed = raw.borrowed?.usd ?? 0;
      const available = raw.available?.usd ?? (limit - borrowed);
      const rawUtilization = "utilizationPercent" in raw ? raw.utilizationPercent : undefined;
      const rawTier = "tier" in raw ? raw.tier : undefined;
      const utilization = rawUtilization ?? Math.round((borrowed / (limit || 1)) * 100);
      return {
        ...creditAccount,
        limit,
        borrowed,
        available,
        utilization,
        tier: (rawTier as any) || (limit >= 10000 ? "Prime" : limit >= 5000 ? "Standard" : "Starter"),
      };
    }
    return delay(creditAccount, 420);
  },
  transactions: (): Promise<CreditTransaction[]> => delay(creditTransactions, 420),
  borrow: async (amount: number, account: CreditAccount): Promise<CreditAccount> => {
    const res = await request<{
      credit?: {
        account?: {
          creditLimit: { usd: number };
          borrowed: { usd: number };
          available: { usd: number };
          utilizationPercent?: number;
        };
      };
      account?: {
        creditLimit: { usd: number };
        borrowed: { usd: number };
        available: { usd: number };
        utilizationPercent?: number;
      };
    }>("/api/credit/borrow", {
      method: "POST",
      body: JSON.stringify({ amountUsd: amount }),
    });

    const acc = res?.credit?.account || res?.account;
    if (acc?.creditLimit) {
      const limit = acc.creditLimit.usd;
      const borrowed = acc.borrowed.usd;
      const available = acc.available.usd;
      const utilization = acc.utilizationPercent ?? Math.round((borrowed / (limit || 1)) * 100);
      return {
        ...account,
        limit,
        borrowed,
        available,
        utilization,
      };
    }

    const borrowed = account.borrowed + amount;
    return delay(
      {
        ...account,
        borrowed,
        available: account.limit - borrowed,
        utilization: Math.round((borrowed / account.limit) * 100),
      },
      1200,
    );
  },
  repay: async (amount: number, account: CreditAccount): Promise<CreditAccount> => {
    const res = await request<{
      credit?: {
        account?: {
          creditLimit: { usd: number };
          borrowed: { usd: number };
          available: { usd: number };
          utilizationPercent?: number;
        };
      };
      account?: {
        creditLimit: { usd: number };
        borrowed: { usd: number };
        available: { usd: number };
        utilizationPercent?: number;
      };
    }>("/api/credit/repay", {
      method: "POST",
      body: JSON.stringify({ amountUsd: amount }),
    });

    const acc = res?.credit?.account || res?.account;
    if (acc?.creditLimit) {
      const limit = acc.creditLimit.usd;
      const borrowed = acc.borrowed.usd;
      const available = acc.available.usd;
      const utilization = acc.utilizationPercent ?? Math.round((borrowed / (limit || 1)) * 100);
      return {
        ...account,
        limit,
        borrowed,
        available,
        utilization,
      };
    }

    const borrowed = Math.max(0, account.borrowed - amount);
    return delay(
      {
        ...account,
        borrowed,
        available: account.limit - borrowed,
        utilization: Math.round((borrowed / account.limit) * 100),
      },
      1200,
    );
  },
};

export const verificationSteps: VerificationStep[] = [
  { id: "vs_1", label: "Funding source verified", detail: "3 independent sources", state: "pending" },
  { id: "vs_2", label: "Swap verified", detail: "Uniswap v3 · Ethereum", state: "pending" },
  { id: "vs_3", label: "Deposit verified", detail: "Aave v3 · 1,500 USDC", state: "pending" },
  { id: "vs_4", label: "Borrow verified", detail: "Aave v3 · 600 USDC", state: "pending" },
  { id: "vs_5", label: "Repayment verified", detail: "2 repayments · on time", state: "pending" },
  { id: "vs_6", label: "Transaction ordering verified", detail: "Coherent economic sequence", state: "pending" },
];

export const buildCreditService = {
  steps: () => verificationSteps.map((s) => ({ ...s })),
  decide: async (previousLimit: number): Promise<CreditDecision> => {
    try {
      await ensureSession();
      const res = await request<{ job?: { id: string }; pollUrl?: string }>("/api/evidence/evaluate", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const jobId = res?.job?.id;
      if (jobId) {
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 450));
          const jobData = await request<{
            status: string;
            resultReference?: {
              creditIncreaseUsdCents?: number;
              newLimitUsdCents?: number;
              evidenceScore?: number;
              eventCount?: number;
            };
          }>(`/api/jobs/${jobId}`);

          if (jobData?.status === "COMPLETED" && jobData.resultReference) {
            const ref = jobData.resultReference;
            const delta = (ref.creditIncreaseUsdCents || 420000) / 100;
            const newLimit = (ref.newLimitUsdCents || ((previousLimit + delta) * 100)) / 100;
            return {
              previousLimit,
              newLimit,
              delta,
              verifiedEvents: ref.eventCount || 11,
              fundingSources: 3,
              counterparties: 8,
              protocols: 3,
              checks: [
                { label: "Funding sources identified", count: 3 },
                { label: "Transactions verified", count: ref.eventCount || 11 },
                { label: "Counterparties mapped", count: 8 },
                { label: "Economic relationships analyzed", count: 6 },
                { label: "Evidence calculation complete", count: 1 },
              ],
            };
          }
        }
      }
    } catch {
      // Fallback below
    }

    return delay(
      {
        previousLimit,
        newLimit: 14200 + (previousLimit - 10000),
        delta: 4200,
        verifiedEvents: 8,
        fundingSources: 3,
        counterparties: 6,
        protocols: 2,
        checks: [
          { label: "Funding sources identified", count: 3 },
          { label: "Transactions verified", count: 12 },
          { label: "Counterparties mapped", count: 6 },
          { label: "Economic relationships analyzed", count: 4 },
          { label: "Evidence calculation complete", count: 1 },
        ],
      },
      900,
    );
  },
};

export const farmTestService = {
  scenarios: (): FarmTestScenario[] => farmScenarios,
  scenario: (id: FarmTestScenario["id"]) => farmScenarios.find((s) => s.id === id)!,
};
