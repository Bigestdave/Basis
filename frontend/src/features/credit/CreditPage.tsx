import { useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Hexagon,
  Layers,
  Network,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../../store/store";
import {
  Badge,
  Button,
  Card,
  IconTile,
  InfoHint,
  Modal,
  PageHeader,
  ProgressBar,
  Skeleton,
} from "../../components/ui";
import { LineChart, RingProgress } from "../../components/ui/charts";
import { usd } from "../../lib/format";

const RANGES = [
  { id: "1D", label: "1D" },
  { id: "1W", label: "1W" },
  { id: "1M", label: "1M" },
  { id: "1Y", label: "1Y" },
  { id: "ALL", label: "ALL" },
];

const FACTORS = [
  {
    id: "evidence",
    title: "Economic evidence",
    subtitle: "Verified on-chain activity",
    tone: "brand" as const,
    icon: <ShieldCheck size={17} />,
    body: "BASIS verified 8 economic events across 3 networks. Each event is attested once, so repeated or circular transfers cannot inflate your evidence.",
  },
  {
    id: "capital",
    title: "Capital independence",
    subtitle: "No external funding dependency",
    tone: "violet" as const,
    icon: <Scale size={17} />,
    body: "Your activity is funded from 3 independent sources. Independent capital indicates real economic participation rather than recycled funds.",
  },
  {
    id: "diversity",
    title: "Economic diversity",
    subtitle: "Multiple asset types and chains",
    tone: "positive" as const,
    icon: <Network size={17} />,
    body: "You transact across Ethereum, Base and Creditcoin with 4 asset types and 6 unique counterparties. Diversity reduces concentration risk.",
  },
  {
    id: "behaviour",
    title: "Behavioral coherence",
    subtitle: "Consistent, positive activity",
    tone: "brand" as const,
    icon: <Hexagon size={17} />,
    body: "Deposits, borrows and repayments occur in a coherent order over time, including one completed repayment cycle on Aave v3.",
  },
];

export function CreditPage() {
  const { credit, creditTransactions, navigate, status } = useStore();
  const [range, setRange] = useState("1M");
  const [factor, setFactor] = useState<(typeof FACTORS)[number] | null>(null);
  const [tierOpen, setTierOpen] = useState(false);
  const loading = status !== "ready";

  const history = credit?.history ?? [];
  const sliced =
    range === "1D"
      ? history.slice(-6)
      : range === "1W"
        ? history.slice(-12)
        : range === "1M"
          ? history.slice(-24)
          : range === "1Y"
            ? history.slice(-34)
            : history;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_436px]">
      <div className="min-w-0 space-y-6">
        <PageHeader
          title="Credit"
          subtitle="Your credit line is built from verified economic activity across connected networks."
        />

        <Card className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
              <p className="flex items-center gap-1.5 text-[13.5px] text-muted">
                Available credit <InfoHint text="Credit you can borrow right now." />
              </p>
              {loading ? (
                <Skeleton className="mt-3 h-12 w-48" />
              ) : (
                <p className="mt-1 text-[42px] font-bold leading-none tracking-[-0.035em] text-ink tnum">
                  {usd(credit?.available ?? 0)}
                </p>
              )}

              <div className="mt-6 flex items-start gap-6">
                {[
                  { v: usd(credit?.limit ?? 0), l: "Credit limit" },
                  { v: usd(credit?.borrowed ?? 0), l: "Borrowed" },
                  { v: `${credit?.utilization ?? 0}%`, l: "Utilization" },
                ].map((s, i) => (
                  <div key={s.l} className={i > 0 ? "border-l border-line pl-6" : undefined}>
                    <p className="text-[16px] font-semibold text-ink tnum">{s.v}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <Button pill full onClick={() => navigate("borrow")}>
                  Borrow
                </Button>
                <Button pill full variant="secondary" onClick={() => navigate("repay")}>
                  Repay
                </Button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-2 flex justify-end">
                <div className="inline-flex items-center gap-1 rounded-full bg-soft p-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-all duration-150 ${
                        range === r.id ? "bg-white text-brand shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-muted hover:text-ink"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <Skeleton className="h-[168px]" />
              ) : (
                <LineChart
                  data={sliced}
                  height={168}
                  labels={["Apr 17", "Apr 20", "Apr 23", "Apr 24"]}
                />
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="p-6">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Credit limit &amp; usage</h3>
            <div className="mt-5 flex items-center gap-7">
              <RingProgress value={credit?.utilization ?? 0} label={`${credit?.utilization ?? 0}%`} sublabel="utilization" />
              <div className="flex-1">
                {[
                  { l: "Total credit limit", v: usd(credit?.limit ?? 0) },
                  { l: "Used", v: usd(credit?.borrowed ?? 0) },
                  { l: "Available", v: usd(credit?.available ?? 0) },
                ].map((r) => (
                  <div key={r.l} className="flex items-center justify-between border-b border-line-soft py-3 last:border-0">
                    <span className="text-[13.5px] text-muted">{r.l}</span>
                    <span className="text-[14px] font-semibold text-ink tnum">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Your credit tier</h3>
            <button
              onClick={() => setTierOpen(true)}
              className="mt-5 flex w-full items-center gap-4 rounded-[12px] border border-line bg-subtle p-4 text-left transition-colors duration-150 hover:border-[#d8e1f0]"
            >
              <IconTile size={40}>
                <Hexagon size={18} />
              </IconTile>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-ink">{credit?.tier ?? "—"}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
                  Build more activity to unlock higher tiers.
                </p>
              </div>
              <ChevronRight size={16} className="text-[#c4cbd6]" />
            </button>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Recent credit activity</h3>
            <button onClick={() => navigate("activity")} className="text-[13.5px] font-medium text-brand hover:underline">
              View all
            </button>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
            <div>Type</div>
            <div>Details</div>
            <div>Amount</div>
            <div>Date</div>
            <div />
          </div>

          {loading ? (
            <div className="space-y-4 pt-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            creditTransactions.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(t.type === "credit-increase" ? "evidence" : "activity")}
                className="group grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_20px] items-center border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
              >
                <div className="flex items-center gap-3">
                  <IconTile
                    size={34}
                    tone={t.type === "credit-increase" ? "positive" : t.type === "borrow" ? "brand" : "violet"}
                  >
                    {t.type === "credit-increase" ? (
                      <ArrowUp size={15} />
                    ) : t.type === "borrow" ? (
                      <ArrowDown size={15} />
                    ) : (
                      <ArrowLeftRight size={15} />
                    )}
                  </IconTile>
                  <span className="truncate text-[14px] font-medium text-ink">{t.label}</span>
                </div>
                <div className="truncate text-[13.5px] text-muted">{t.details}</div>
                <div className={`text-[14px] font-medium tnum ${t.amount >= 0 ? "text-pos" : "text-ink"}`}>
                  {t.amount >= 0 ? "+" : "-"}
                  {usd(Math.abs(t.amount))}
                </div>
                <div className="text-[13.5px] text-muted">{t.date}</div>
                <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
              </button>
            ))
          )}
        </Card>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Your credit line</h3>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-[30px] font-bold leading-none tracking-[-0.03em] text-ink tnum">
              {usd(credit?.available ?? 0)}
              <span className="ml-1 text-[16px] font-medium text-muted">/ {usd(credit?.limit ?? 0)}</span>
            </p>
            <span className="text-[13px] text-muted tnum">{credit?.utilization ?? 0}%</span>
          </div>
          <ProgressBar value={credit?.utilization ?? 0} className="mt-3" />
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <p className="text-[12.5px] text-muted">Available</p>
              <p className="mt-1 text-[19px] font-semibold text-ink tnum">{usd(credit?.available ?? 0)}</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted">Used</p>
              <p className="mt-1 text-[19px] font-semibold text-ink tnum">{usd(credit?.borrowed ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">How your credit is built</h3>
          <div className="mt-3">
            {FACTORS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFactor(f)}
                className="group flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 hover:bg-subtle"
              >
                <IconTile size={38} tone={f.tone}>
                  {f.icon}
                </IconTile>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink">{f.title}</p>
                  <p className="text-[12.5px] text-muted">{f.subtitle}</p>
                </div>
                <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-[#dbe6ff] bg-[#f2f6ff] p-5">
          <div className="flex gap-3">
            <IconTile size={40} className="bg-white">
              <Layers size={18} />
            </IconTile>
            <div>
              <p className="text-[14.5px] font-semibold text-ink">Build more credit</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Increase your activity, diversify your assets, and unlock a higher credit line.
              </p>
              <Button
                size="sm"
                className="mt-3"
                iconRight={<ArrowRight size={14} />}
                onClick={() => navigate("build-credit")}
              >
                Learn how
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={!!factor}
        onClose={() => setFactor(null)}
        title={factor?.title ?? ""}
        subtitle={factor?.subtitle}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setFactor(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setFactor(null);
                navigate("evidence");
              }}
            >
              View evidence
            </Button>
          </div>
        }
      >
        <p className="text-[14px] leading-relaxed text-muted">{factor?.body}</p>
      </Modal>

      <Modal
        open={tierOpen}
        onClose={() => setTierOpen(false)}
        title="Credit tiers"
        subtitle="Tiers reflect the strength of your verified economic evidence."
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setTierOpen(false)}>Got it</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {[
            { name: "Starter", range: "Up to $5,000", note: "Wallet connected, limited evidence." },
            { name: "Standard", range: "$5,000 – $25,000", note: "Verified multi-source economic activity." },
            { name: "Prime", range: "$25,000+", note: "Sustained repayment history across protocols." },
          ].map((t) => (
            <div
              key={t.name}
              className={`rounded-[12px] border p-4 ${
                t.name === credit?.tier ? "border-brand bg-brand-soft/40" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[14.5px] font-semibold text-ink">{t.name}</p>
                {t.name === credit?.tier ? <Badge tone="brand">Current</Badge> : <span className="text-[13px] text-muted">{t.range}</span>}
              </div>
              <p className="mt-1 text-[13px] text-muted">{t.note}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
