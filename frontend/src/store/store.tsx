import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { lastCreditDecision } from "../data/seed";
import {
  activityService,
  authService,
  buildCreditService,
  creditService,
  evidenceService,
  networksService,
  walletsService,
} from "../services";
import type {
  Asset,
  CreditAccount,
  CreditDecision,
  CreditTransaction,
  EconomicEvent,
  EvidenceItem,
  EvidenceSummary,
  Network,
  RouteId,
  Toast,
  ToastKind,
  User,
  Wallet,
} from "../types";

type Loadable = "idle" | "loading" | "ready" | "error";

interface Store {
  route: RouteId;
  navigate: (route: RouteId) => void;

  status: Loadable;
  reload: () => void;

  user: User | null;
  wallet: Wallet | null;
  walletConnected: boolean;
  connectWallet: (provider: Wallet["provider"]) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  connecting: boolean;

  assets: Asset[];
  balanceSeries: { label: string; value: number }[];
  networks: Network[];
  connectNetwork: (id: string) => Promise<void>;
  connectingNetwork: string | null;

  events: EconomicEvent[];
  evidence: EvidenceItem[];
  evidenceSummary: EvidenceSummary | null;

  credit: CreditAccount | null;
  creditTransactions: CreditTransaction[];
  borrow: (amount: number, asset: string) => Promise<void>;
  repay: (amount: number, asset: string) => Promise<void>;

  decision: CreditDecision | null;
  applyDecision: (d: CreditDecision) => void;
  runDecision: () => Promise<CreditDecision>;

  selectedEventId: string | null;
  openEvent: (id: string | null) => void;

  toasts: Toast[];
  pushToast: (kind: ToastKind, title: string, description?: string) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<Store | null>(null);

let toastSeq = 0;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<RouteId>("home");
  const [status, setStatus] = useState<Loadable>("idle");

  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletConnected, setWalletConnected] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [balanceSeries, setBalanceSeries] = useState<{ label: string; value: number }[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [connectingNetwork, setConnectingNetwork] = useState<string | null>(null);

  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);

  const [credit, setCredit] = useState<CreditAccount | null>(null);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [decision, setDecision] = useState<CreditDecision | null>(lastCreditDecision);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    Promise.all([
      authService.getUser(),
      walletsService.getWallet(),
      walletsService.getAssets(),
      walletsService.getBalanceSeries(),
      networksService.list(),
      activityService.list(),
      evidenceService.list(),
      evidenceService.summary(),
      creditService.account(),
      creditService.transactions(),
    ])
      .then(([u, w, a, bs, n, ev, evd, evs, c, ct]) => {
        if (!alive) return;
        setUser(u);
        setWallet(w);
        setAssets(a);
        setBalanceSeries(bs);
        setNetworks(n);
        setEvents(ev);
        setEvidence(evd);
        setEvidenceSummary(evs);
        setCredit(c);
        setCreditTransactions(ct);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [nonce]);

  const pushToast = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, kind, title, description }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const navigate = useCallback((r: RouteId) => {
    setRoute(r);
    setSelectedEventId(null);
    window.scrollTo({ top: 0 });
  }, []);

  const connectWallet = useCallback(
    async (provider: Wallet["provider"]) => {
      setConnecting(true);
      try {
        const w = await walletsService.connect(provider);
        setWallet(w);
        setWalletConnected(true);
        pushToast("success", "Wallet connected", `${provider} · ${w.shortAddress}`);
        setRoute("wallets");
      } finally {
        setConnecting(false);
      }
    },
    [pushToast],
  );

  const disconnectWallet = useCallback(async () => {
    await walletsService.disconnect();
    setWalletConnected(false);
    pushToast("info", "Wallet disconnected", "Reconnect to keep building evidence.");
    setRoute("connect-wallet");
  }, [pushToast]);

  const connectNetwork = useCallback(
    async (id: string) => {
      setConnectingNetwork(id);
      try {
        const next = await networksService.connect(id);
        setNetworks(next);
        pushToast("success", "Network connected", `${next.find((n) => n.id === id)?.name} is now syncing activity.`);
      } finally {
        setConnectingNetwork(null);
      }
    },
    [pushToast],
  );

  const borrow = useCallback(
    async (amount: number, asset: string) => {
      if (!credit) return;
      const next = await creditService.borrow(amount, credit);
      setCredit(next);
      setCreditTransactions((t) => [
        {
          id: `ct_${Date.now()}`,
          type: "borrow",
          label: "Borrowed",
          details: asset,
          amount: -amount,
          date: "Apr 24, 2025",
        },
        ...t,
      ]);
      pushToast("success", `Borrowed $${amount.toLocaleString()}`, `${asset} settled on Creditcoin.`);
    },
    [credit, pushToast],
  );

  const repay = useCallback(
    async (amount: number, asset: string) => {
      if (!credit) return;
      const next = await creditService.repay(amount, credit);
      setCredit(next);
      setCreditTransactions((t) => [
        {
          id: `ct_${Date.now()}`,
          type: "repay",
          label: "Repayment",
          details: asset,
          amount,
          date: "Apr 24, 2025",
        },
        ...t,
      ]);
      pushToast("success", `Repaid $${amount.toLocaleString()}`, "Repayment recorded as economic evidence.");
    },
    [credit, pushToast],
  );

  const runDecision = useCallback(async () => {
    const d = await buildCreditService.decide(credit?.limit ?? 10000);
    setDecision(d);
    return d;
  }, [credit]);

  const applyDecision = useCallback(
    (d: CreditDecision) => {
      setCredit((c) =>
        c
          ? {
              ...c,
              limit: d.newLimit,
              available: d.newLimit - c.borrowed,
              utilization: Math.round((c.borrowed / d.newLimit) * 100),
            }
          : c,
      );
      setCreditTransactions((t) => [
        {
          id: `ct_${Date.now()}`,
          type: "credit-increase",
          label: "Credit increased",
          details: "Verified economic activity",
          amount: d.delta,
          date: "Apr 24, 2025",
        },
        ...t,
      ]);
    },
    [],
  );

  const value = useMemo<Store>(
    () => ({
      route,
      navigate,
      status,
      reload: () => setNonce((n) => n + 1),
      user,
      wallet,
      walletConnected,
      connectWallet,
      disconnectWallet,
      connecting,
      assets,
      balanceSeries,
      networks,
      connectNetwork,
      connectingNetwork,
      events,
      evidence,
      evidenceSummary,
      credit,
      creditTransactions,
      borrow,
      repay,
      decision,
      applyDecision,
      runDecision,
      selectedEventId,
      openEvent: setSelectedEventId,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      route,
      navigate,
      status,
      user,
      wallet,
      walletConnected,
      connectWallet,
      disconnectWallet,
      connecting,
      assets,
      balanceSeries,
      networks,
      connectNetwork,
      connectingNetwork,
      events,
      evidence,
      evidenceSummary,
      credit,
      creditTransactions,
      borrow,
      repay,
      decision,
      applyDecision,
      runDecision,
      selectedEventId,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
