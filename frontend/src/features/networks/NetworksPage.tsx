import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeftRight, ChevronRight, Landmark, Search } from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Card, EmptyState, InfoHint, PageHeader, Skeleton, StatusDot } from "../../components/ui";
import { NetworkIcon } from "../../components/ui/icons";
import { signedAmount } from "../../lib/format";
import type { NetworkId } from "../../types";

export function NetworksPage() {
  const { networks, events, status, connectNetwork, connectingNetwork, openEvent, pushToast } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NetworkId>("ethereum");
  const loading = status !== "ready";

  const connected = networks.filter((n) => n.status === "connected");
  const filtered = useMemo(
    () => networks.filter((n) => n.name.toLowerCase().includes(query.toLowerCase())),
    [networks, query],
  );

  const active = networks.find((n) => n.id === selected);
  const activeEvents = events.filter((e) => e.network === selected).slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0">
        <PageHeader title="Networks" subtitle="Your connected blockchains and protocols." />

        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[19px] font-semibold tracking-[-0.015em] text-ink">
            Connected networks <InfoHint text="BASIS reads verified economic activity from these chains." />
          </h2>
          <span className="inline-flex items-center gap-2 text-[13px] text-muted">
            <StatusDot /> {connected.length} connected
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px]" />)
            : connected.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  className={`group flex items-start gap-3 rounded-[14px] border bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-150 ${
                    selected === n.id ? "border-brand ring-1 ring-brand-ring" : "border-line hover:border-[#d8e1f0]"
                  }`}
                >
                  <NetworkIcon id={n.id} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{n.name}</p>
                    <p className="text-[12.5px] text-muted">{n.chainType}</p>
                    <Badge tone="positive" className="mt-2">
                      Connected
                    </Badge>
                  </div>
                  <ChevronRight size={16} className="mt-1 text-[#c4cbd6] group-hover:text-muted" />
                </button>
              ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">All networks</h2>
          <div className="flex h-10 w-[240px] items-center gap-2.5 rounded-[10px] border border-line bg-white px-3 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring/50">
            <Search size={15} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search networks..."
              className="h-full w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
          <div>Network</div>
          <div>Chain type</div>
          <div>Status</div>
          <div>Last activity</div>
          <div />
        </div>

        {loading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mt-4 h-12" />)
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No networks found"
            description={`Nothing matched “${query}”. BASIS currently supports 7 networks.`}
            action={
              <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={`group grid cursor-pointer grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_20px] items-center border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle ${
                selected === n.id ? "bg-subtle" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <NetworkIcon id={n.id} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{n.name}</p>
                  <p className="truncate text-[12.5px] text-muted">{n.symbol}</p>
                </div>
              </div>
              <div className="text-[13.5px] text-muted">{n.chainType}</div>
              <div>
                {n.status === "connected" ? (
                  <Badge tone="positive" dot>
                    Connected
                  </Badge>
                ) : n.status === "unavailable" ? (
                  <Badge tone="negative" dot>
                    Unavailable
                  </Badge>
                ) : (
                  <Badge dot>Available</Badge>
                )}
              </div>
              <div className="text-[13.5px] text-muted">{n.lastActivity ?? "—"}</div>
              <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
            </div>
          ))
        )}
      </div>

      {/* detail rail */}
      <div>
        <Card className="p-6">
          {active && (
            <>
              <div className="flex items-start gap-4">
                <NetworkIcon id={active.id} size={52} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{active.name}</h3>
                    {active.status === "connected" ? (
                      <Badge tone="positive">Connected</Badge>
                    ) : (
                      <Badge>Available</Badge>
                    )}
                  </div>
                  <p className="text-[13px] text-muted">{active.chainType}</p>
                </div>
              </div>

              <p className="mt-5 text-[14px] leading-relaxed text-muted">{active.description}</p>

              <div className="mt-6 grid grid-cols-3 gap-4">
                {[
                  { l: "Block time", v: active.blockTime ?? "—" },
                  { l: "Gas price", v: active.gasPrice ?? "—" },
                  { l: "Total transactions", v: active.totalTransactions ?? "—" },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-[12.5px] text-muted">{s.l}</p>
                    <p className="mt-1 text-[15px] font-semibold text-ink tnum">{s.v}</p>
                  </div>
                ))}
              </div>

              {active.status !== "connected" && (
                <Button
                  full
                  className="mt-6"
                  loading={connectingNetwork === active.id}
                  onClick={() => void connectNetwork(active.id)}
                >
                  {connectingNetwork === active.id ? "Connecting" : `Connect ${active.name}`}
                </Button>
              )}

              <div className="mt-6 border-t border-line pt-5">
                <h4 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Network activity</h4>
                {activeEvents.length === 0 ? (
                  <EmptyState
                    title="No verified activity yet"
                    description={
                      active.status === "connected"
                        ? "BASIS hasn't observed economic activity on this network yet."
                        : "Connect this network to include its activity in your economic evidence."
                    }
                  />
                ) : (
                  <div className="mt-2">
                    {activeEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => openEvent(e.id)}
                        className="group flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                          {e.type === "deposit" ? (
                            <Landmark size={15} />
                          ) : e.type === "swapped" ? (
                            <ArrowLeftRight size={15} />
                          ) : (
                            <ArrowDown size={15} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-ink">
                            {e.title} {e.type === "received" ? e.assetSymbol : e.subtitle}
                          </p>
                          <p className={`text-[13px] font-medium tnum ${e.amount >= 0 ? "text-pos" : "text-neg"}`}>
                            {signedAmount(e.amount, e.assetSymbol)}
                          </p>
                          <p className="truncate text-[12.5px] text-muted">
                            {active.name} · {e.date}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() =>
                  pushToast("info", `${active.name} details`, "Full network detail page is not available in demo mode.")
                }
                className="mt-5 flex w-full items-center justify-between rounded-[12px] bg-subtle px-4 py-3.5 text-[14px] font-medium text-ink transition-colors hover:bg-[#f1f4fa]"
              >
                View network details
                <ChevronRight size={16} className="text-[#c4cbd6]" />
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
