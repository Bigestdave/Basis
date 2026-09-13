import React, { useEffect, useRef, useState } from "react";
import {
  Aperture,
  Bell,
  ChartLine,
  CheckCircle2,
  ChevronDown,
  CircleArrowDown,
  CircleHelp,
  FlaskConical,
  Grid3x3,
  Home,
  Info,
  Layers,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkle,
  TriangleAlert,
  Wallet,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useStore } from "../../store/store";
import type { RouteId } from "../../types";
import { BasisLogo } from "../ui/icons";
import { StatusDot, WalletAddress } from "../ui";

const NAV: { id: RouteId; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "credit", label: "Credit", icon: CircleArrowDown },
  { id: "activity", label: "Activity", icon: ChartLine },
  { id: "evidence", label: "Evidence", icon: Aperture },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "networks", label: "Networks", icon: Waypoints },
  { id: "settings", label: "Settings", icon: Settings },
];

const ROUTE_GROUP: Partial<Record<RouteId, RouteId>> = {
  borrow: "credit",
  repay: "credit",
  "credit-result": "evidence",
  "build-credit": "credit",
  "connect-wallet": "wallets",
};

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { id: RouteId; label: string; icon: React.ElementType };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors duration-150",
        active ? "bg-[#e8f0fe] font-semibold text-brand" : "text-ink-soft hover:bg-[#eef2f8]",
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.1 : 1.8} className={active ? "text-brand" : "text-[#3b4657]"} />
      {item.label}
    </button>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { route, navigate, wallet, walletConnected } = useStore();
  const activeRoute = ROUTE_GROUP[route] ?? route;

  return (
    <div className="basis-sidebar flex h-full w-[240px] shrink-0 flex-col border-r border-line">
      <div className="flex h-[72px] items-center gap-2.5 px-6">
        <BasisLogo size={30} />
        <span className="text-[21px] font-bold tracking-[0.04em] text-ink">BASIS</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeRoute === item.id}
            onClick={() => {
              navigate(item.id);
              onNavigate?.();
            }}
          />
        ))}
      </nav>

      <div className="mt-6 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Demo</p>
        <NavItem
          item={{ id: "farm-test", label: "Farm test", icon: FlaskConical }}
          active={activeRoute === "farm-test"}
          onClick={() => {
            navigate("farm-test");
            onNavigate?.();
          }}
        />
      </div>

      <div className="mt-auto px-6 pb-6">
        <div className="border-t border-line pt-4">
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            <StatusDot tone={walletConnected ? "positive" : "neutral"} />
            {walletConnected ? "Wallet connected" : "Wallet not connected"}
          </div>
          {wallet && <WalletAddress address={wallet.address} className="mt-1.5" />}
        </div>
      </div>
    </div>
  );
}

function Dropdown({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "animate-fade-up absolute right-0 top-[calc(100%+10px)] z-40 w-64 overflow-hidden rounded-[12px] border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-subtle"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">
        {label}
        {hint && <span className="block text-[12px] text-faint">{hint}</span>}
      </span>
    </button>
  );
}

function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user, navigate, disconnectWallet, pushToast } = useStore();
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-line bg-white/85 px-6 backdrop-blur-md lg:px-8">
      <button
        onClick={onOpenMobileNav}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-soft lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            pushToast("info", `No results for “${query.trim()}”`, "Search covers assets, chains and transactions.");
          }
        }}
        className="w-full max-w-[540px]"
      >
        <div className="flex h-10 items-center gap-2.5 rounded-full bg-[#f1f4f9] px-4 transition-colors duration-150 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-ring">
          <Search size={16} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets, chains, or transactions..."
            className="h-full w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-[#98a1b0]"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => {
              setNotifications((v) => !v);
              setApps(false);
              setProfile(false);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:text-ink"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
          </button>
          <Dropdown open={notifications} onClose={() => setNotifications(false)} className="w-80">
            <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
              Notifications
            </p>
            <div className="space-y-0.5">
              <MenuItem
                icon={<CheckCircle2 size={16} className="text-pos" />}
                label="Credit increased by $4,200"
                hint="Verified economic activity · Apr 24"
                onClick={() => {
                  setNotifications(false);
                  navigate("credit");
                }}
              />
              <MenuItem
                icon={<Info size={16} />}
                label="8 new verified events"
                hint="Evidence updated · Apr 24"
                onClick={() => {
                  setNotifications(false);
                  navigate("evidence");
                }}
              />
              <MenuItem
                icon={<TriangleAlert size={16} className="text-warn" />}
                label="Solana not connected"
                hint="Connect to include staking evidence"
                onClick={() => {
                  setNotifications(false);
                  navigate("networks");
                }}
              />
            </div>
          </Dropdown>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setHelp((v) => !v);
              setApps(false);
              setProfile(false);
              setNotifications(false);
            }}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:text-ink"
            aria-label="Help"
            title="Help"
          >
            <CircleHelp size={16} />
          </button>
          <Dropdown open={help} onClose={() => setHelp(false)}>
            <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">Help</p>
            <MenuItem
              icon={<Info size={16} />}
              label="How BASIS works"
              hint="Activity → evidence → credit"
              onClick={() => {
                setHelp(false);
                navigate("build-credit");
              }}
            />
            <MenuItem
              icon={<FlaskConical size={16} />}
              label="Why can't I farm credit?"
              onClick={() => {
                setHelp(false);
                navigate("farm-test");
              }}
            />
            <MenuItem
              icon={<CircleHelp size={16} />}
              label="Contact support"
              onClick={() => {
                setHelp(false);
                pushToast("info", "Support", "Support chat is unavailable in demo mode.");
              }}
            />
          </Dropdown>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setApps((v) => !v);
              setProfile(false);
              setNotifications(false);
            }}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:text-ink"
            aria-label="Product menu"
          >
            <Grid3x3 size={16} />
          </button>
          <Dropdown open={apps} onClose={() => setApps(false)}>
            <p className="px-2.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
              BASIS tools
            </p>
            <MenuItem
              icon={<Layers size={16} />}
              label="Build credit"
              hint="Verify your economic history"
              onClick={() => {
                setApps(false);
                navigate("build-credit");
              }}
            />
            <MenuItem
              icon={<FlaskConical size={16} />}
              label="Farm test"
              hint="Can you farm your credit?"
              onClick={() => {
                setApps(false);
                navigate("farm-test");
              }}
            />
            <MenuItem
              icon={<Sparkle size={16} />}
              label="Credit result"
              hint="Latest credit decision"
              onClick={() => {
                setApps(false);
                navigate("credit-result");
              }}
            />
          </Dropdown>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfile((v) => !v);
              setApps(false);
              setNotifications(false);
            }}
            className="flex items-center gap-1.5 rounded-full pl-0.5 pr-1 transition-opacity hover:opacity-85"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0b1524] text-[13px] font-semibold text-white">
              {user?.initials ?? "—"}
            </span>
            <ChevronDown size={15} className="text-muted" />
          </button>
          <Dropdown open={profile} onClose={() => setProfile(false)}>
            <div className="border-b border-line px-2.5 pb-3 pt-2">
              <p className="text-[14px] font-semibold text-ink">{user?.name}</p>
              <p className="text-[12.5px] text-muted">{user?.email}</p>
            </div>
            <div className="pt-1">
              <MenuItem
                icon={<Settings size={16} />}
                label="Settings"
                onClick={() => {
                  setProfile(false);
                  navigate("settings");
                }}
              />
              <MenuItem
                icon={<Wallet size={16} />}
                label="Wallets"
                onClick={() => {
                  setProfile(false);
                  navigate("wallets");
                }}
              />
              <MenuItem
                icon={<LogOut size={16} />}
                label="Disconnect wallet"
                onClick={() => {
                  setProfile(false);
                  void disconnectWallet();
                }}
              />
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex w-[340px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up flex items-start gap-3 rounded-[12px] border border-line bg-white p-3.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]"
        >
          <span
            className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
              t.kind === "success" && "bg-pos-soft text-[#067647]",
              t.kind === "info" && "bg-brand-soft text-brand",
              t.kind === "error" && "bg-neg-soft text-neg",
            )}
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={14} />
            ) : t.kind === "error" ? (
              <TriangleAlert size={14} />
            ) : (
              <Info size={14} />
            )}
          </span>
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
            {t.description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.description}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-faint transition-colors hover:text-muted">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="basis-bg flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar />
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="animate-fade absolute inset-0 bg-[#0b1524]/30" onClick={() => setMobileNav(false)} />
          <div className="animate-fade relative h-full">
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNav(true)} />
        <main className="min-w-0 flex-1 px-6 py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
