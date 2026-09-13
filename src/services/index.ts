/**
 * Service layer. Every screen consumes data through these functions.
 * In demo mode they connect to the local Next.js backend when reachable,
 * with seamless fallback to deterministic seed data.
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

const delay = <T,>(value: T, ms = 420): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const API_BASE_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
    : "";

let storedToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem("basis_session_token") : null;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
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

async function ensureSession(): Promise<void> {
  if (storedToken) return;
  try {
    const data = await request<{ session: { token: string } }>("/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ scenarioKey: "strong-history" }),
    });
    if (data?.session?.token) {
      storedToken = data.session.token;
      if (typeof window !== "undefined") {
        localStorage.setItem("basis_session_token", storedToken);
      }
    }
  } catch {
    // Fallback gracefully without server
  }
}

if (typeof window !== "undefined") {
  ensureSession();
}

export const authService = {
  getUser: async (): Promise<User> => {
    await ensureSession();
    const data = await request<{ user: { id: string } }>("/api/me");
    if (data?.user) {
      return {
        ...demoUser,
        id: data.user.id,
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
    const data = await request<
      Array<{
        id: string;
        title: string;
        kind: string;
        amountUsd: number;
        chainKey: string;
        timestamp: number;
        counterparty: string;
        protocol?: string;
        evidenceStatus: string;
      }>
    >("/api/activity");

    if (data && data.length > 0) {
      return data.map((item, idx) => {
        const seedItem = economicEvents[idx % economicEvents.length];
        const isBorrowRepay = item.kind === "borrow" || item.kind === "repay";
        const isDeposit = item.kind === "deposit" || item.kind === "settlement";
        return {
          id: item.id,
          type: (item.kind === "borrow"
            ? "borrow"
            : item.kind === "repay"
              ? "repay"
              : isDeposit
                ? "deposit"
                : "swapped") as any,
          category: (isBorrowRepay ? "borrow-repay" : isDeposit ? "deposits" : "swaps") as any,
          title: item.title || seedItem.title,
          subtitle: `${item.counterparty || "Counterparty"} · ${item.chainKey}`,
          assetId: "usdc",
          assetSymbol: "USDC",
          amount: Math.round(item.amountUsd),
          amountUsd: item.amountUsd,
          network: (item.chainKey.includes("base")
            ? "base"
            : item.chainKey.includes("creditcoin")
              ? "creditcoin"
              : "ethereum") as any,
          date: new Date(item.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          time: new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          verified: item.evidenceStatus === "verified",
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
      evaluation?: {
        strength: string;
        capitalIndependence: number;
        economicDiversity: number;
        behavioralCoherence: number;
        eventCount: number;
        verifiedEventCount: number;
      };
    }>("/api/evidence");

    if (data?.evaluation) {
      const ev = data.evaluation;
      return {
        ...evidenceSummary,
        strength: ev.strength === "strong" ? "Strong" : ev.strength === "moderate" ? "Moderate" : "Weak",
        verifiedEvents: ev.verifiedEventCount || evidenceSummary.verifiedEvents,
        fundingSources: Math.max(1, Math.round(ev.capitalIndependence * 4)),
        counterparties: Math.max(2, Math.round(ev.economicDiversity * 8)),
        protocols: Math.max(1, Math.round(ev.economicDiversity * 4)),
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
      creditLimit: { usd: number };
      borrowed: { usd: number };
      available: { usd: number };
      utilization: number;
      tier?: string;
    }>("/api/credit");

    if (data?.creditLimit) {
      const limit = data.creditLimit.usd;
      const borrowed = data.borrowed.usd;
      const available = data.available.usd;
      const utilization = Math.round((borrowed / (limit || 1)) * 100);
      return {
        ...creditAccount,
        limit,
        borrowed,
        available,
        utilization,
        tier: (data.tier as any) || (limit >= 10000 ? "Prime" : limit >= 5000 ? "Standard" : "Starter"),
      };
    }
    return delay(creditAccount, 420);
  },
  transactions: (): Promise<CreditTransaction[]> => delay(creditTransactions, 420),
  borrow: async (amount: number, account: CreditAccount): Promise<CreditAccount> => {
    const res = await request<{
      account: {
        creditLimit: { usd: number };
        borrowed: { usd: number };
        available: { usd: number };
      };
    }>("/api/credit/borrow", {
      method: "POST",
      body: JSON.stringify({ amountUsd: amount }),
    });

    if (res?.account) {
      const limit = res.account.creditLimit.usd;
      const borrowed = res.account.borrowed.usd;
      const available = res.account.available.usd;
      const utilization = Math.round((borrowed / (limit || 1)) * 100);
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
      account: {
        creditLimit: { usd: number };
        borrowed: { usd: number };
        available: { usd: number };
      };
    }>("/api/credit/repay", {
      method: "POST",
      body: JSON.stringify({ amountUsd: amount }),
    });

    if (res?.account) {
      const limit = res.account.creditLimit.usd;
      const borrowed = res.account.borrowed.usd;
      const available = res.account.available.usd;
      const utilization = Math.round((borrowed / (limit || 1)) * 100);
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
      await request("/api/evidence/build", { method: "POST", body: JSON.stringify({}) });
      const evData = await request<{
        decision?: {
          decisionAmountUsd: number;
        };
      }>("/api/evidence/evaluate", { method: "POST", body: JSON.stringify({}) });

      if (evData?.decision) {
        const delta = evData.decision.decisionAmountUsd || 4200;
        return {
          previousLimit,
          newLimit: previousLimit + delta,
          delta,
          verifiedEvents: 11,
          fundingSources: 3,
          counterparties: 8,
          protocols: 3,
          checks: [
            { label: "Funding sources identified", count: 3 },
            { label: "Transactions verified", count: 11 },
            { label: "Counterparties mapped", count: 8 },
            { label: "Economic relationships analyzed", count: 6 },
            { label: "Evidence calculation complete", count: 1 },
          ],
        };
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
