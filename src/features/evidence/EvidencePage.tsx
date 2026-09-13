import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  FileText,
  Layers,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Card, EmptyState, InfoHint, PageHeader, Select, Skeleton, Tabs } from "../../components/ui";
import { DonutChart } from "../../components/ui/charts";
import { NetworkIcon } from "../../components/ui/icons";
import { usd } from "../../lib/format";
import type { EvidenceCategory } from "../../types";

const TABS = [
  { id: "all", label: "All evidence" },
  { id: "transfers", label: "Transactions" },
  { id: "defi", label: "DeFi activity" },
  { id: "payments", label: "Payments" },
  { id: "wallet-balance", label: "Wallet balance" },
  { id: "other", label: "Other" },
];

const ROW_ICON: Record<EvidenceCategory, { icon: ReactNode; cls: string }> = {
  defi: { icon: <ArrowUp size={15} />, cls: "bg-brand-soft text-brand" },
  payments: { icon: <ArrowUp size={15} />, cls: "bg-[#f1ecfe] text-[#6938EF]" },
  transfers: { icon: <ArrowDown size={15} />, cls: "bg-[#eaf2ff] text-brand" },
  staking: { icon: <ArrowUpDown size={15} />, cls: "bg-pos-soft text-[#067647]" },
  "wallet-balance": { icon: <Wallet size={15} />, cls: "bg-soft text-muted" },
  other: { icon: <ArrowUp size={15} />, cls: "bg-warn-soft text-[#B54708]" },
};

export function EvidencePage() {
  const { evidence, evidenceSummary, status, openEvent, navigate } = useStore();
  const [tab, setTab] = useState("all");
  const [chain, setChain] = useState("all");
  const [range, setRange] = useState("30");
  const loading = status !== "ready";

  const filtered = useMemo(
    () =>
      evidence.filter((e) => {
        if (tab !== "all" && e.category !== tab) return false;
        if (chain !== "all" && e.sourceNetwork !== chain) return false;
        return true;
      }),
    [evidence, tab, chain],
  );

  const s = evidenceSummary;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_436px]">
      <div className="min-w-0">
        <PageHeader title="Evidence" subtitle="Verified on-chain activity that powers your credit." />

        <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

        <Card className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="flex items-start gap-4 border-b border-line p-6 lg:border-b-0 lg:border-r">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-[13.5px] text-muted">
                  Total verified evidence <InfoHint text="Total USD value of independently attested economic events." />
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-9 w-44" />
                ) : (
                  <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.03em] text-ink tnum">
                    {usd(s?.totalVerified ?? 0, { decimals: true })}
                  </p>
                )}
                <p className="mt-2 text-[13.5px] font-medium text-pos tnum">
                  ↗ {usd(s?.change ?? 0, { decimals: true })} ({s?.changePct.toFixed(2)}%)
                </p>
                <p className="mt-1 text-[12.5px] text-muted">Across all connected networks</p>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-5 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <p className="text-[13px] text-muted">Verification status</p>
                  <p className="text-[14.5px] font-semibold text-ink">{s?.verificationPct ?? 0}% verified</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <FileText size={16} />
                </span>
                <div>
                  <p className="text-[13px] text-muted">Sources</p>
                  <p className="text-[14.5px] font-semibold text-ink">{s?.sourceCount ?? 0} on-chain sources</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Verified activity</h3>
            <div className="flex gap-3">
              <Select
                value={chain}
                onChange={setChain}
                options={[
                  { value: "all", label: "All chains" },
                  { value: "ethereum", label: "Ethereum" },
                  { value: "base", label: "Base" },
                  { value: "solana", label: "Solana" },
                ]}
                className="w-[145px]"
              />
              <Select
                value={range}
                onChange={setRange}
                options={[
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "all", label: "All time" },
                ]}
                className="w-[170px]"
                icon={<Calendar size={15} className="text-muted" />}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
            <div>Type</div>
            <div>Source</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Status</div>
            <div />
          </div>

          {loading ? (
            <div className="space-y-4 pt-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title="No evidence in this category yet"
              description="Connect more networks or build credit to let BASIS verify additional economic activity."
              action={
                <Button size="sm" onClick={() => navigate("build-credit")}>
                  Build my credit
                </Button>
              }
            />
          ) : (
            filtered.map((e) => {
              const cfg = ROW_ICON[e.category];
              return (
                <button
                  key={e.id}
                  onClick={() => openEvent(e.eventId)}
                  className="group grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_20px] items-center border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle"
                >
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${cfg.cls}`}>{cfg.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">{e.type}</p>
                      <p className="truncate text-[12.5px] text-muted">{e.sourceKind}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <NetworkIcon id={e.sourceNetwork} size={24} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-ink">{e.source}</p>
                      <p className="truncate text-[12.5px] text-muted">{e.sourceKind}</p>
                    </div>
                  </div>
                  <div>
                    <p className={`text-[13.5px] font-medium tnum ${e.positive ? "text-pos" : "text-neg"}`}>
                      {e.amountLabel}
                    </p>
                    <p className="text-[12.5px] text-muted tnum">{usd(e.amountUsd, { decimals: true })}</p>
                  </div>
                  <div>
                    <p className="text-[13.5px] text-muted">{e.date}</p>
                    <p className="text-[12.5px] text-faint tnum">{e.time}</p>
                  </div>
                  <div>
                    <Badge tone="positive" dot>
                      Verified
                    </Badge>
                  </div>
                  <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
                </button>
              );
            })
          )}
        </Card>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Evidence by category</h3>
          {loading ? (
            <Skeleton className="mt-4 h-[168px]" />
          ) : (
            <div className="mt-4 flex items-center gap-5">
              <DonutChart
                segments={(s?.breakdown ?? []).map((b) => ({ pct: b.pct, color: b.color }))}
                size={150}
                thickness={19}
                center={
                  <div>
                    <p className="text-[15px] font-bold tracking-[-0.02em] text-ink tnum">
                      {usd(s?.totalVerified ?? 0, { decimals: true })}
                    </p>
                    <p className="text-[11.5px] text-muted">Total verified</p>
                  </div>
                }
              />
              <div className="flex-1 space-y-2.5">
                {(s?.breakdown ?? []).map((b) => (
                  <div key={b.category} className="flex items-center gap-2 text-[12.5px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                    <span className="flex-1 truncate text-ink">{b.label}</span>
                    <span className="text-muted tnum">{b.pct}%</span>
                    <span className="w-[68px] text-right text-muted tnum">{usd(b.value, { decimals: true })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Top verified sources</h3>
            <button onClick={() => navigate("networks")} className="text-[13.5px] font-medium text-brand hover:underline">
              View all
            </button>
          </div>
          <div className="mt-3">
            {(s?.topSources ?? []).map((src) => (
              <button
                key={src.id}
                onClick={() => navigate("networks")}
                className="group flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
              >
                <NetworkIcon id={src.network} size={32} />
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink">{src.name}</p>
                  <p className="text-[12.5px] text-muted">{src.activities} activities</p>
                </div>
                <span className="text-[13.5px] font-medium text-ink tnum">{usd(src.value, { decimals: true })}</span>
                <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-[#dbe6ff] bg-[#f2f6ff] p-5">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand">
              <Layers size={18} />
            </span>
            <div>
              <p className="text-[14.5px] font-semibold text-ink">Why this matters</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Your verified activity gives BASIS confidence in your financial behavior, helping you unlock higher credit
                limits and better rates.
              </p>
              <button
                onClick={() => navigate("build-credit")}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
              >
                Learn more <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
