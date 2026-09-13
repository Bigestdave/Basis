import { api, setStoredSessionToken } from "./api";

export interface UserSession {
  userId: string;
  sessionId: string;
  walletId: string;
  address: string;
  isDemoWallet: boolean;
  scenarioKey: string | null;
  mode: "demo" | "live";
}

export interface MeResponse {
  user: {
    id: string;
    label: string | null;
    mode: string;
  };
  session: {
    id: string;
    expiresAt: string;
  };
  wallet: {
    id: string;
    address: string;
    label: string | null;
    status: string;
    isDemo: boolean;
    scenarioKey: string | null;
  } | null;
  credit?: {
    creditLimit: { usd: number; display: string };
    borrowed: { usd: number; display: string };
    available: { usd: number; display: string };
    utilizationPercent: number;
    status: string;
  } | null;
}

export const DEMO_SCENARIOS = [
  {
    key: "strong-history",
    label: "Strong history",
    subtitle: "Ava Mercado · 8 verified events across Base & Ethereum",
    description: "Diverse counterparties, independent funding sources, organic repayment behavior.",
  },
  {
    key: "manufactured-activity",
    label: "Manufactured activity",
    subtitle: "Sybil ring · Circular wash volume",
    description: "Repeated transactions to circular addresses funded from the same hub. Earns $0 credit.",
  },
  {
    key: "empty-wallet",
    label: "Empty wallet",
    subtitle: "New wallet · 0 events",
    description: "Brand new on-chain wallet with no verified economic events.",
  },
  {
    key: "verification-in-progress",
    label: "Verification in progress",
    subtitle: "Pending Attestcoin proofs",
    description: "Activity is detected and currently awaiting USC BlockProver attestation.",
  },
  {
    key: "proof-detail",
    label: "Attestcoin proof detail",
    subtitle: "Dossier · Full Merkle proofs",
    description: "Pre-evaluated wallet with comprehensive cryptographic proof artifacts.",
  },
] as const;

export type DemoScenarioKey = (typeof DEMO_SCENARIOS)[number]["key"];

export async function loginDemo(scenarioKey: DemoScenarioKey = "strong-history") {
  const data = await api.post<{
    sessionToken: string;
    userId: string;
    walletId: string;
    address: string;
    isDemoWallet: boolean;
    scenarioKey: string | null;
  }>("/api/auth/demo", { scenarioKey });

  if (data?.sessionToken) {
    setStoredSessionToken(data.sessionToken);
  }
  return data;
}

export async function getMe(): Promise<MeResponse | null> {
  try {
    return await api.get<MeResponse>("/api/me");
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/auth/logout", {});
  } finally {
    setStoredSessionToken(null);
  }
}
