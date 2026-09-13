import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  FileText,
  Coins,
  Layers,
  Users,
  Waypoints,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Button, Card, EmptyState, IconTile } from "../../components/ui";
import { usd } from "../../lib/format";

export function CreditResultPage() {
  const { decision, navigate } = useStore();

  if (!decision) {
    return (
      <div className="mx-auto max-w-[720px] pt-10">
        <Card className="p-2">
          <EmptyState
            icon={<Layers size={20} />}
            title="No credit decision yet"
            description="Run an analysis of your economic history and BASIS will produce a credit decision here."
            action={<Button onClick={() => navigate("build-credit")}>Build my credit</Button>}
          />
        </Card>
      </div>
    );
  }

  const metrics = [
    { icon: <FileText size={18} />, value: decision.verifiedEvents, label: "Verified events", note: "Your on-chain activity was verified." },
    { icon: <Coins size={18} />, value: decision.fundingSources, label: "Funding sources", note: "Independent capital sources identified." },
    { icon: <Users size={18} />, value: decision.counterparties, label: "Unique counterparties", note: "Different addresses and entities." },
    { icon: <Waypoints size={18} />, value: decision.protocols, label: "Protocols", note: "Multiple DeFi protocols used." },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0">
        <button
          onClick={() => navigate("credit")}
          className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="animate-fade-up flex flex-col items-center pt-4 text-center">
          <span className="relative grid h-[92px] w-[92px] place-items-center rounded-full bg-[#f1f6ff]">
            <Layers size={36} className="text-brand" strokeWidth={1.6} />
            <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-pos text-white">
              <ArrowRight size={14} className="-rotate-90" />
            </span>
          </span>
          <h1 className="mt-6 text-[36px] font-bold leading-tight tracking-[-0.03em] text-ink">
            Your credit has increased
          </h1>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted">
            BASIS has analyzed your verified economic activity and identified additional credit capacity.
          </p>
        </div>

        <div className="mt-8 rounded-[14px] border border-[#cdedd9] bg-[#f4fcf7] p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-[13.5px] text-muted">Previous credit</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.03em] text-ink tnum">
                {usd(decision.previousLimit)}
              </p>
            </div>
            <ArrowRight size={22} className="text-[#8fa3b8]" />
            <div>
              <p className="text-[13.5px] text-muted">New credit</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.03em] text-pos tnum">
                {usd(decision.newLimit)}
              </p>
            </div>
            <span className="rounded-lg bg-pos-soft px-3 py-1.5 text-[15px] font-semibold text-[#067647] tnum">
              +{usd(decision.delta)}
            </span>
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-[17px] font-semibold tracking-[-0.015em] text-ink">What made the difference?</h2>
        <Card className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m, i) => (
              <div key={m.label} className={`text-center ${i > 0 ? "lg:border-l lg:border-line lg:pl-4" : ""}`}>
                <IconTile size={42} className="mx-auto">
                  {m.icon}
                </IconTile>
                <p className="mt-3 text-[26px] font-bold leading-none tracking-[-0.02em] text-ink tnum">{m.value}</p>
                <p className="mt-1.5 text-[13px] font-medium text-ink">{m.label}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-muted">{m.note}</p>
              </div>
            ))}
          </div>
        </Card>

        <Button full size="lg" className="mt-7" iconRight={<ArrowRight size={16} />} onClick={() => navigate("credit")}>
          View credit
        </Button>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate("evidence")}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
          >
            View evidence details <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <IconTile size={34}>
              <ShieldCheck size={16} />
            </IconTile>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Credit update summary</h3>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Your credit increased based on verified economic activity across multiple chains and protocols.
          </p>
          <div className="mt-4 border-t border-line pt-3">
            {[
              { l: "Previous credit", v: usd(decision.previousLimit), cls: "text-ink" },
              { l: "New credit", v: usd(decision.newLimit), cls: "text-ink" },
              { l: "Increase", v: `+${usd(decision.delta)}`, cls: "text-pos" },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between py-2">
                <span className="text-[13.5px] text-muted">{r.l}</span>
                <span className={`text-[14.5px] font-semibold tnum ${r.cls}`}>{r.v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <IconTile size={34}>
              <Layers size={16} />
            </IconTile>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Key activity</h3>
          </div>
          <div className="mt-3">
            {decision.checks.map((c) => (
              <div key={c.label} className="flex items-center gap-3 py-2.5">
                <CircleCheck size={17} className="shrink-0 text-pos" />
                <span className="flex-1 text-[13.5px] text-muted">{c.label}</span>
                <span className="text-[13.5px] font-semibold text-ink tnum">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <IconTile size={34}>
              <ShieldCheck size={16} />
            </IconTile>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Next steps</h3>
          </div>
          <p className="mt-3 text-[13px] text-muted">Now that your credit has increased, you can:</p>
          <div className="mt-2">
            {[
              { icon: <Layers size={16} />, t: "Borrow funds", d: "Access your available credit line.", r: "borrow" as const },
              { icon: <ShieldCheck size={16} />, t: "Explore your evidence", d: "See the activity that increased your credit.", r: "evidence" as const },
              { icon: <Wallet size={16} />, t: "Manage your networks", d: "Add more chains for greater coverage.", r: "networks" as const },
            ].map((n) => (
              <button
                key={n.t}
                onClick={() => navigate(n.r)}
                className="group flex w-full items-center gap-3 border-b border-line-soft py-3 text-left last:border-0 hover:bg-subtle"
              >
                <IconTile size={34}>{n.icon}</IconTile>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink">{n.t}</p>
                  <p className="text-[12.5px] text-muted">{n.d}</p>
                </div>
                <ArrowRight size={15} className="text-[#c4cbd6] group-hover:text-muted" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
