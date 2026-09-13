import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  BadgeCheck,
  ChevronRight,
  Compass,
  CreditCard,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Card, Delta, IconTile, ProgressBar, Skeleton, StatusDot } from "../../components/ui";
import { AssetIcon, NetworkIcon } from "../../components/ui/icons";
import { num, usd } from "../../lib/format";
import type { RouteId } from "../../types";

function StatCard({
  icon,
  label,
  value,
  hint,
  delta,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta?: { value: number; pct: number };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-[14px] border border-line bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-150 hover:border-[#d8e1f0] hover:shadow-[0_4px_14px_-6px_rgba(16,24,40,0.12)]"
    >
      <IconTile size={38}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-muted">{label}</p>
        <p className="mt-0.5 truncate text-[26px] font-bold tracking-[-0.025em] text-ink tnum">{value}</p>
        {delta ? <Delta value={delta.value} pctValue={delta.pct} className="mt-1 text-[13px]" /> : null}
        {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      </div>
      <ChevronRight size={16} className="mt-1 shrink-0 text-[#c4cbd6] transition-colors group-hover:text-muted" />
    </button>
  );
}

const QUICK_ACTIONS: { label: string; icon: ReactNode; route: RouteId }[] = [
  { label: "Borrow", icon: <ArrowUp size={18} />, route: "borrow" },
  { label: "Repay", icon: <ArrowDown size={18} />, route: "repay" },
  { label: "Swap", icon: <ArrowLeftRight size={18} />, route: "activity" },
  { label: "Deposit", icon: <CreditCard size={18} />, route: "wallets" },
  { label: "Withdraw", icon: <ArrowUpFromLine size={18} />, route: "wallets" },
  { label: "Explore", icon: <Compass size={18} />, route: "networks" },
];

export function HomePage() {
  const { user, wallet, credit, assets, networks, creditTransactions, navigate, status, pushToast } = useStore();
  const loading = status !== "ready";
  const connected = networks.filter((n) => n.status === "connected");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_436px]">
      {/* ------------------------------------------------------------ main */}
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-[34px] font-bold leading-[1.1] tracking-[-0.028em] text-ink">
              Good morning, {user?.initials ?? "—"}
              <BadgeCheck size={20} className="text-brand" />
            </h1>
            <p className="mt-2 text-[14px] text-muted">Your economic activity is building your credit.</p>
          </div>
          <Badge tone="positive" dot className="mt-2">
            Verified
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-[108px]" />
              <Skeleton className="h-[108px]" />
              <Skeleton className="h-[108px]" />
            </>
          ) : (
            <>
              <StatCard
                icon={<Wallet size={17} />}
                label="Total wallet balance"
                value={usd(wallet?.totalBalance ?? 0, { decimals: true })}
                delta={{ value: wallet?.change24hValue ?? 0, pct: wallet?.change24hPct ?? 0 }}
                onClick={() => navigate("wallets")}
              />
              <StatCard
                icon={<Layers size={17} />}
                label="Available credit"
                value={usd(credit?.available ?? 0)}
                hint="From verified activity"
                onClick={() => navigate("credit")}
              />
              <StatCard
                icon={<TrendingUp size={17} />}
                label="Total earned"
                value={usd(248.32, { decimals: true })}
                hint="This month"
                onClick={() => navigate("activity")}
              />
            </>
          )}
        </div>

        {/* credit line */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">Credit line</h2>
            <div className="flex items-center gap-2">
              <Button pill onClick={() => navigate("borrow")} className="px-7">
                Borrow
              </Button>
              <Button pill variant="secondary" onClick={() => navigate("repay")} className="px-7">
                Repay
              </Button>
            </div>
          </div>

          {loading ? (
            <Skeleton className="mt-6 h-[110px]" />
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-start gap-x-10 gap-y-5">
                <div>
                  <p className="text-[44px] font-bold leading-none tracking-[-0.035em] text-ink tnum">
                    {usd(credit?.available ?? 0)}
                  </p>
                  <Delta value={wallet?.change24hValue ?? 0} pctValue={wallet?.change24hPct ?? 0} className="mt-2.5" />
                </div>
                <div className="flex items-start gap-8 pt-1">
                  {[
                    { v: usd(credit?.limit ?? 0), l: "Credit limit", accent: true },
                    { v: usd(credit?.borrowed ?? 0), l: "Borrowed" },
                    { v: `${credit?.utilization ?? 0}%`, l: "Utilization" },
                  ].map((s, i) => (
                    <div key={s.l} className={i > 0 ? "border-l border-line pl-8" : undefined}>
                      <p className="text-[17px] font-semibold text-ink tnum">{s.v}</p>
                      <p className={`mt-1 text-[13px] ${s.accent ? "text-brand" : "text-muted"}`}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <ProgressBar value={credit?.utilization ?? 0} className="flex-1" />
                <span className="w-10 text-right text-[13px] text-muted tnum">{credit?.utilization ?? 0}%</span>
              </div>
            </>
          )}
        </Card>

        {/* assets */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">Your assets</h2>
            <button
              onClick={() => navigate("wallets")}
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
            >
              View all assets <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
            <div>Asset</div>
            <div>Balance</div>
            <div>Value</div>
            <div />
          </div>

          {loading ? (
            <div className="space-y-4 pt-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            assets.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("wallets")}
                className="group grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_20px] items-center border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
              >
                <div className="flex items-center gap-3">
                  <AssetIcon id={a.id} size={32} />
                  <div>
                    <p className="text-[14px] font-medium text-ink">{a.name}</p>
                    <p className="text-[12.5px] text-muted">{a.symbol}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[14px] text-ink tnum">{a.balance === null ? "—" : num(a.balance)}</p>
                  <p className="text-[12.5px] text-muted">{a.balance === null ? "" : a.symbol}</p>
                </div>
                <div>
                  <p className="text-[14px] text-ink tnum">{usd(a.value, { decimals: true })}</p>
                  <p className="text-[12.5px] text-pos tnum">↗ {a.change24h.toFixed(2)}%</p>
                </div>
                <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
              </button>
            ))
          )}
        </Card>

        {/* footer banner */}
        <Card className="flex flex-wrap items-center gap-4 bg-subtle p-5">
          <IconTile size={40}>
            <Layers size={18} />
          </IconTile>
          <div className="min-w-[240px] flex-1">
            <p className="text-[14.5px] font-semibold text-ink">Your credit grows with your economic activity</p>
            <p className="mt-0.5 text-[13px] text-muted">
              The more you use, the more you build. Connect, transact, and unlock more.
            </p>
          </div>
          <Button
            variant="outline"
            pill
            size="sm"
            iconRight={<ArrowRight size={14} />}
            onClick={() => navigate("build-credit")}
          >
            Learn more
          </Button>
        </Card>
      </div>

      {/* ------------------------------------------------------------ rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Quick actions</h3>
          <div className="mt-4 grid grid-cols-3 gap-y-5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  if (a.label === "Swap" || a.label === "Deposit" || a.label === "Withdraw") {
                    pushToast("info", `${a.label} is not available in demo mode`, "Try Borrow or Repay instead.");
                  }
                  navigate(a.route);
                }}
                className="group flex flex-col items-center gap-2"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand transition-colors duration-150 group-hover:bg-[#dde8ff]">
                  {a.icon}
                </span>
                <span className="text-[13px] text-ink">{a.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Connected networks</h3>
            <button onClick={() => navigate("networks")} className="text-[13.5px] font-medium text-brand hover:underline">
              View all
            </button>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="space-y-3 pt-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : (
              connected.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate("networks")}
                  className="group flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
                >
                  <NetworkIcon id={n.id} size={32} />
                  <span className="flex-1 text-[14px] font-medium text-ink">{n.name}</span>
                  <Badge tone="positive">Connected</Badge>
                  <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Recent activity</h3>
            <button onClick={() => navigate("activity")} className="text-[13.5px] font-medium text-brand hover:underline">
              View all
            </button>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="space-y-3 pt-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              creditTransactions.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("credit")}
                  className="group flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
                >
                  <IconTile
                    size={36}
                    tone={t.type === "credit-increase" ? "positive" : t.type === "borrow" ? "violet" : "brand"}
                  >
                    {t.type === "credit-increase" ? (
                      <ArrowUp size={16} />
                    ) : t.type === "borrow" ? (
                      <ArrowDown size={16} />
                    ) : (
                      <ArrowLeftRight size={16} />
                    )}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{t.label}</p>
                    <p className="truncate text-[12.5px] text-muted">{t.details}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13.5px] font-medium tnum ${t.amount >= 0 ? "text-pos" : "text-ink"}`}>
                      {t.amount >= 0 ? "+ " : "-"}
                      {usd(Math.abs(t.amount))}
                    </p>
                    <p className="text-[12.5px] text-muted">{t.date}</p>
                  </div>
                  <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="flex items-center gap-2 px-1 text-[12px] text-faint">
          <StatusDot tone="neutral" />
          Demo data · deterministic testnet scenario
        </div>
      </div>
    </div>
  );
}
