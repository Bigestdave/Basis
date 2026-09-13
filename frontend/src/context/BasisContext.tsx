import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  account as defaultAccount,
  evidence as defaultEvidence,
  factors as defaultFactors,
  excluded as defaultExcluded,
  activity as defaultActivity,
  wallets as defaultWallets,
  chains as defaultChains,
  type Factor,
  type ActivityItem,
} from "../lib/data";
import { getMe, loginDemo, type DemoScenarioKey } from "../services/account";
import { getCredit } from "../services/credit";
import { getEvidence } from "../services/evidence";
import { getActivity, type ApiActivityItem } from "../services/activity";
import { getWallets, type WalletDto } from "../services/wallets";

interface BasisContextType {
  account: typeof defaultAccount;
  evidence: typeof defaultEvidence;
  factors: Factor[];
  excluded: typeof defaultExcluded;
  activity: ActivityItem[];
  wallets: typeof defaultWallets;
  activeScenario: DemoScenarioKey;
  loading: boolean;
  refresh: () => Promise<void>;
  switchScenario: (key: DemoScenarioKey) => Promise<void>;
  buildModalOpen: boolean;
  setBuildModalOpen: (open: boolean) => void;
  inspectEventId: string | null;
  setInspectEventId: (id: string | null) => void;
}

const BasisContext = createContext<BasisContextType | null>(null);

function mapApiActivityToItem(apiItem: ApiActivityItem): ActivityItem {
  let kind: ActivityItem["kind"] = "swap";
  const t = apiItem.type.toUpperCase();
  if (t === "FUNDING" || t === "DEPOSIT") kind = "deposit";
  else if (t === "BORROW") kind = "borrow";
  else if (t === "REPAY") kind = "repay";
  else if (t === "TRANSFER" || t === "PAYMENT") kind = "settlement";
  else if (t === "STAKE" || t === "DEPOSIT") kind = "lend";

  const dateObj = new Date(apiItem.timestamp);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${months[dateObj.getMonth()]} ${dateObj.getDate()}`;

  const direction: "in" | "out" | "neutral" =
    t === "FUNDING" || t === "BORROW" ? "in" : t === "REPAY" || t === "PAYMENT" || t === "TRANSFER" ? "out" : "neutral";

  return {
    id: apiItem.id,
    kind,
    title: apiItem.protocol ? `${apiItem.protocol} · ${apiItem.type}` : `${apiItem.asset} ${apiItem.type.toLowerCase()}`,
    counterparty: apiItem.counterparty,
    chain: apiItem.chainKey.charAt(0).toUpperCase() + apiItem.chainKey.slice(1).replace("-sepolia", " Sepolia"),
    date: dateStr,
    amount: apiItem.amount.usd,
    direction,
    evidence: apiItem.verified ? "verified" : "none",
    evidenceNote: apiItem.verified ? (apiItem.credited ? "Verified · Credited" : "Verified") : "Under review",
  };
}

export function BasisProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState(defaultAccount);
  const [evidence, setEvidence] = useState(defaultEvidence);
  const [factors, setFactors] = useState<Factor[]>(defaultFactors);
  const [excluded, setExcluded] = useState(defaultExcluded);
  const [activity, setActivity] = useState<ActivityItem[]>(defaultActivity);
  const [wallets, setWallets] = useState(defaultWallets);
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey>("strong-history");
  const [loading, setLoading] = useState(false);
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [inspectEventId, setInspectEventId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [creditRes, evidenceRes, activityRes, walletsRes] = await Promise.allSettled([
        getCredit(),
        getEvidence(),
        getActivity(),
        getWallets(),
      ]);

      if (creditRes.status === "fulfilled" && creditRes.value) {
        const c = creditRes.value;
        setAccount((prev) => ({
          ...prev,
          creditLimit: c.creditLimit.usd,
          available: c.available.usd,
          borrowed: c.borrowed.usd,
          apr: 8.4,
        }));
      }

      if (evidenceRes.status === "fulfilled" && evidenceRes.value?.evaluation) {
        const ev = evidenceRes.value.evaluation;
        const mappedFactors: Factor[] = (evidenceRes.value.factors || []).map((f) => {
          const strength = Math.min(4, Math.max(1, Math.round(f.value * 4)));
          return {
            name: f.label,
            value: `${(f.value * 100).toFixed(0)}%`,
            note: f.explanation.split(".")[0] || "",
            strength,
            detail: f.explanation,
            contribution: `+${Math.round(f.value * 3000).toLocaleString("en-US")} of limit`,
          };
        });

        setEvidence({
          rating: ev.strength === "strong" ? "Strong" : ev.strength === "moderate" ? "Moderate" : "Limited",
          strength: ev.strength === "strong" ? 4 : ev.strength === "moderate" ? 3 : 2,
          lastVerified: "Recently · Attestcoin",
          transactionsReviewed: ev.eventCount + (evidenceRes.value.exclusions?.count || 404),
          qualifyingEvents: ev.verifiedEventCount,
          summary: `Evaluated ${ev.verifiedEventCount} verified economic events across multiple protocols and chains.`,
          headline: [
            { label: "Verified economic events", value: String(ev.verifiedEventCount) },
            { label: "Capital Independence", value: `${(ev.capitalIndependence * 100).toFixed(0)}%` },
            { label: "Economic Diversity", value: `${(ev.economicDiversity * 100).toFixed(0)}%` },
            { label: "Behavioral Coherence", value: `${(ev.behavioralCoherence * 100).toFixed(0)}%` },
          ],
        });

        if (mappedFactors.length > 0) {
          setFactors(mappedFactors);
        }

        if (evidenceRes.value.exclusions) {
          setExcluded({
            count: evidenceRes.value.exclusions.count,
            line: `${evidenceRes.value.exclusions.count} transactions were reviewed and did not change your limit.`,
          });
        }
      }

      if (activityRes.status === "fulfilled" && activityRes.value.length > 0) {
        setActivity(activityRes.value.map(mapApiActivityToItem));
      }

      if (walletsRes.status === "fulfilled" && walletsRes.value.length > 0) {
        setWallets(
          walletsRes.value.map((w, idx) => ({
            address: `${w.address.slice(0, 6)}…${w.address.slice(-4)}`,
            label: w.label || (idx === 0 ? "Primary" : "Secondary"),
            chain: w.networks[0] ? w.networks[0].charAt(0).toUpperCase() + w.networks[0].slice(1) : "Ethereum",
            events: w.qualifyingEvents ?? (idx === 0 ? 5 : 3),
            verified: "Verified",
            state: "verified" as const,
          })),
        );
      }
    } catch {
      // Keep static defaults on network error
    } finally {
      setLoading(false);
    }
  }, []);

  const switchScenario = useCallback(async (scenarioKey: DemoScenarioKey) => {
    setActiveScenario(scenarioKey);
    try {
      await loginDemo(scenarioKey);
      await loadData();
    } catch (err) {
      console.warn("Failed to switch scenario:", err);
    }
  }, [loadData]);

  useEffect(() => {
    // Attempt initial demo login for default scenario
    loginDemo("strong-history")
      .then(() => loadData())
      .catch(() => {
        // Fallback to local default data if backend isn't running yet
      });
  }, [loadData]);

  return (
    <BasisContext.Provider
      value={{
        account,
        evidence,
        factors,
        excluded,
        activity,
        wallets,
        activeScenario,
        loading,
        refresh: loadData,
        switchScenario,
        buildModalOpen,
        setBuildModalOpen,
        inspectEventId,
        setInspectEventId,
      }}
    >
      {children}
    </BasisContext.Provider>
  );
}

export function useBasis() {
  const ctx = useContext(BasisContext);
  if (!ctx) throw new Error("useBasis must be used within a BasisProvider");
  return ctx;
}
