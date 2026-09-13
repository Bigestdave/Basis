import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Calendar,
  ChevronRight,
  Landmark,
  RotateCcw,
  Search,
  SearchX,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Button, Card, Checkbox, EmptyState, PageHeader, Select, Skeleton, Tabs } from "../../components/ui";
import { AssetIcon, NetworkIcon } from "../../components/ui/icons";
import { signedAmount } from "../../lib/format";
import type { EconomicEvent, EventCategory } from "../../types";

const TABS = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "swaps", label: "Swaps" },
  { id: "borrow-repay", label: "Borrow / Repay" },
  { id: "credit", label: "Credit" },
  { id: "other", label: "Other" },
];

const TYPE_FILTERS: { id: EventCategory; label: string }[] = [
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "swaps", label: "Swaps" },
  { id: "borrow-repay", label: "Borrow / Repay" },
  { id: "credit", label: "Credit" },
  { id: "other", label: "Other" },
];

function EventIcon({ event }: { event: EconomicEvent }) {
  const map: Record<string, { icon: ReactNode; cls: string }> = {
    received: { icon: <ArrowDown size={16} />, cls: "bg-brand-soft text-brand" },
    sent: { icon: <ArrowRight size={16} />, cls: "bg-brand-soft text-brand" },
    swapped: { icon: <ArrowLeftRight size={16} />, cls: "bg-[#eaf2ff] text-brand" },
    deposit: { icon: <Landmark size={15} />, cls: "bg-[#eef3ff] text-[#3358cc]" },
    withdraw: { icon: <ArrowUp size={16} />, cls: "bg-warn-soft text-[#B54708]" },
    staking: { icon: <ArrowUp size={16} />, cls: "bg-pos-soft text-[#067647]" },
    payment: { icon: <ArrowUp size={16} />, cls: "bg-[#f1ecfe] text-[#6938EF]" },
  };
  const cfg = map[event.type] ?? map.received;
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${cfg.cls}`}>{cfg.icon}</span>;
}

export function ActivityPage() {
  const { events, status, openEvent, networks } = useStore();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState("all");
  const [chain, setChain] = useState("all");
  const [range, setRange] = useState("30");
  const [types, setTypes] = useState<EventCategory[]>([]);
  const loading = status !== "ready";

  const toggleType = (t: EventCategory) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const clearFilters = () => {
    setTypes([]);
    setAsset("all");
    setChain("all");
    setRange("30");
    setQuery("");
    setTab("all");
  };

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (tab !== "all" && e.category !== tab) return false;
      if (types.length && !types.includes(e.category)) return false;
      if (asset !== "all" && e.assetId !== asset) return false;
      if (chain !== "all" && e.network !== chain) return false;
      if (range === "7" && !["Apr 24, 2025", "Apr 22, 2025", "Apr 20, 2025", "Apr 18, 2025"].includes(e.date))
        return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${e.title} ${e.subtitle} ${e.assetSymbol} ${e.protocol ?? ""} ${e.network}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, tab, types, asset, chain, range, query]);

  const assetOptions = [
    { value: "all", label: "All assets" },
    ...Array.from(new Set(events.map((e) => e.assetId))).map((id) => ({
      value: id,
      label: events.find((e) => e.assetId === id)!.assetSymbol,
    })),
  ];
  const chainOptions = [
    { value: "all", label: "All chains" },
    ...networks
      .filter((n) => events.some((e) => e.network === n.id))
      .map((n) => ({ value: n.id, label: n.name })),
  ];
  const rangeOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "all", label: "All time" },
  ];

  const activeFilterCount =
    types.length + (asset !== "all" ? 1 : 0) + (chain !== "all" ? 1 : 0) + (range !== "30" ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <PageHeader title="Activity" subtitle="Your on-chain activity and verified economic events." />

        <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2.5 rounded-[10px] border border-line bg-white px-3 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring/50">
            <Search size={15} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity..."
              className="h-full w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
            />
          </div>
          <Select value={asset} onChange={setAsset} options={assetOptions} className="w-[150px]" />
          <Select value={chain} onChange={setChain} options={chainOptions} className="w-[150px]" />
          <Select
            value={range}
            onChange={setRange}
            options={rangeOptions}
            className="w-[180px]"
            icon={<Calendar size={15} className="text-muted" />}
          />
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
          <div>Type</div>
          <div>Asset</div>
          <div>Amount</div>
          <div>Chain</div>
          <div>Date</div>
          <div />
        </div>

        {loading ? (
          <div className="space-y-4 pt-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="No activity matches these filters"
            description="Try a different time range, chain, or clear your filters to see all verified economic activity."
            action={
              <Button variant="outline" size="sm" icon={<RotateCcw size={14} />} onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => openEvent(e.id)}
              className="group grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_20px] items-center border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle"
            >
              <div className="flex items-center gap-3">
                <EventIcon event={e} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{e.title}</p>
                  <p className="truncate text-[12.5px] text-muted">{e.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <AssetIcon id={e.assetId} size={26} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] text-ink">{e.assetSymbol}</p>
                  <p className="truncate text-[12.5px] text-muted">{e.assetSymbol}</p>
                </div>
              </div>
              <div className={`text-[14px] font-medium tnum ${e.amount >= 0 ? "text-pos" : "text-neg"}`}>
                {signedAmount(e.amount, e.assetSymbol)}
              </div>
              <div className="flex items-center gap-2.5">
                <NetworkIcon id={e.network} size={24} />
                <span className="text-[13.5px] text-ink capitalize">{e.network}</span>
              </div>
              <div className="text-[13.5px] text-muted">{e.date}</div>
              <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
            </button>
          ))
        )}
      </div>

      {/* filters rail */}
      <div className="xl:border-l xl:border-line xl:pl-8">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand">
                {activeFilterCount}
              </span>
            )}
          </div>

          <p className="mb-1 mt-5 text-[13.5px] font-semibold text-ink">Type</p>
          <div className="space-y-0.5">
            {TYPE_FILTERS.map((t) => (
              <Checkbox
                key={t.id}
                label={t.label}
                checked={types.includes(t.id)}
                onChange={() => toggleType(t.id)}
              />
            ))}
          </div>

          <div className="my-5 border-t border-line" />

          <p className="mb-2 text-[13.5px] font-semibold text-ink">Asset</p>
          <Select value={asset} onChange={setAsset} options={assetOptions} className="w-full bg-subtle" />

          <p className="mb-2 mt-4 text-[13.5px] font-semibold text-ink">Chain</p>
          <Select value={chain} onChange={setChain} options={chainOptions} className="w-full bg-subtle" />

          <p className="mb-2 mt-4 text-[13.5px] font-semibold text-ink">Date range</p>
          <Select
            value={range}
            onChange={setRange}
            options={rangeOptions}
            className="w-full bg-subtle"
            icon={<Calendar size={15} className="text-muted" />}
          />

          <Button variant="secondary" full className="mt-5" icon={<RotateCcw size={14} />} onClick={clearFilters}>
            Clear filters
          </Button>
        </Card>
      </div>
    </div>
  );
}
