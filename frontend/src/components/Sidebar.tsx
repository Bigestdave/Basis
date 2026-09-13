import type { ComponentType } from "react";
import { cn } from "../utils/cn";
import { account } from "../lib/data";
import {
  ActivityIcon,
  BasisMark,
  CreditIcon,
  EvidenceIcon,
  FlaskIcon,
  NetworkIcon,
  OverviewIcon,
  SettingsIcon,
  WalletIcon,
  CloseIcon,
  ChevronDown,
} from "./Icons";
import { DEMO_SCENARIOS, type DemoScenarioKey } from "../services/account";

export type NavKey = "overview" | "credit" | "evidence" | "activity" | "wallets" | "networks" | "farm-test";

export const NAV: { key: NavKey; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { key: "overview", label: "Overview", icon: OverviewIcon },
  { key: "credit", label: "Credit line", icon: CreditIcon },
  { key: "evidence", label: "Evidence", icon: EvidenceIcon },
  { key: "activity", label: "Activity", icon: ActivityIcon },
  { key: "wallets", label: "Wallets", icon: WalletIcon },
  { key: "networks", label: "Networks", icon: NetworkIcon },
  { key: "farm-test", label: "Farm Test", icon: FlaskIcon },
];

export function SidebarContent({
  current,
  onNavigate,
  onClose,
  walletAddress = account.primaryWallet,
  chainName = account.primaryChain,
  activeScenario = "strong-history",
  onSelectScenario,
}: {
  current: NavKey;
  onNavigate: (k: NavKey) => void;
  onClose?: () => void;
  walletAddress?: string;
  chainName?: string;
  activeScenario?: string;
  onSelectScenario?: (key: DemoScenarioKey) => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <BasisMark size={26} />
          <span className="text-[15.5px] font-semibold tracking-[0.14em] text-ink">BASIS</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface lg:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      <nav className="mt-2 flex flex-col gap-0.5 px-3">
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = key === current;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={cn(
                "flex h-11 items-center gap-3 rounded-full px-4 text-[14.5px] transition-colors",
                active
                  ? "bg-blue-soft font-semibold text-blue"
                  : "font-medium text-ink hover:bg-surface",
              )}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-4">
        {/* Demo Scenario Switcher */}
        {onSelectScenario && (
          <div className="mx-1 mb-3 rounded-xl border border-line bg-surface/50 p-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">
              Demo Environment
            </div>
            <select
              value={activeScenario}
              onChange={(e) => onSelectScenario(e.target.value as DemoScenarioKey)}
              className="mt-1.5 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink outline-none transition-colors hover:border-ink-3"
            >
              {DEMO_SCENARIOS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          className="flex h-11 w-full items-center gap-3 rounded-full px-4 text-[14.5px] font-medium text-ink-2 hover:bg-surface hover:text-ink"
        >
          <SettingsIcon size={20} />
          Settings
        </button>

        <div className="mx-1 mt-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pos" />
            </span>
            <span className="text-[12px] font-medium text-ink-2">Wallet connected</span>
          </div>
          <div className="num mt-1.5 text-[13px] font-medium text-ink">{walletAddress}</div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {chainName} · 2 more verified
          </div>
        </div>
      </div>
    </div>
  );
}
