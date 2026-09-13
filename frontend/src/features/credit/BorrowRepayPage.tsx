import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ChevronUp, ChevronDown, Layers, ShieldCheck } from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Card, IconTile, Modal, ProgressBar } from "../../components/ui";
import { AssetIcon, NetworkIcon } from "../../components/ui/icons";
import { usd } from "../../lib/format";

const ASSETS = [
  { id: "usdc", label: "USDC", sub: "USD Coin" },
  { id: "usdt", label: "USDT", sub: "Tether" },
  { id: "eth", label: "ETH", sub: "Ethereum" },
  { id: "dai", label: "DAI", sub: "Dai" },
];

const NETWORKS = [
  { id: "creditcoin", label: "Creditcoin", sub: "Low fees • Fast settlement" },
  { id: "base", label: "Base", sub: "Low fees • 2s blocks" },
  { id: "ethereum", label: "Ethereum", sub: "Highest liquidity" },
];

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
        {n}
      </span>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
    </div>
  );
}

export function BorrowRepayPage({ mode }: { mode: "borrow" | "repay" }) {
  const { credit, navigate, borrow, repay } = useStore();
  const isBorrow = mode === "borrow";

  const max = isBorrow ? (credit?.available ?? 0) : (credit?.borrowed ?? 0);
  const min = isBorrow ? 100 : 50;

  const [amount, setAmount] = useState<string>(isBorrow ? "1500" : "500");
  const [asset, setAsset] = useState("usdc");
  const [network, setNetwork] = useState("creditcoin");
  const [networkModal, setNetworkModal] = useState(false);
  const [review, setReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const value = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const error =
    value === 0
      ? null
      : value < min
        ? `Minimum amount is ${usd(min)}.`
        : value > max
          ? `Amount exceeds your ${isBorrow ? "available credit" : "outstanding balance"} of ${usd(max)}.`
          : null;
  const valid = value >= min && value <= max;

  const projected = useMemo(() => {
    if (!credit) return 0;
    return isBorrow ? credit.available - value : credit.borrowed - value;
  }, [credit, value, isBorrow]);

  const selectedNetwork = NETWORKS.find((n) => n.id === network)!;
  const selectedAsset = ASSETS.find((a) => a.id === asset)!;

  const step = (delta: number) => {
    const next = Math.max(0, value + delta);
    setAmount(String(next));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isBorrow) await borrow(value, selectedAsset.label);
      else await repay(value, selectedAsset.label);
      setReview(false);
      navigate("credit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_436px]">
      <div className="min-w-0">
        <button
          onClick={() => navigate("credit")}
          className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.028em] text-ink">
          {isBorrow ? "Borrow" : "Repay"}
        </h1>
        <p className="mb-6 mt-2 text-[14px] text-muted">
          {isBorrow
            ? "Access your credit line and get the funds you need, when you need them."
            : "Repay your outstanding balance. Repayments strengthen your economic evidence."}
        </p>

        <Card className="p-6">
          {/* step 1 */}
          <StepLabel n={1} title="Enter amount" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div className="lg:pl-9">
              <label className="text-[13.5px] text-muted">
                {isBorrow ? "How much do you want to borrow?" : "How much do you want to repay?"}
              </label>
              <div
                className={`mt-2 flex h-[54px] items-center gap-2 rounded-[10px] border bg-white px-4 transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand-ring/60 ${
                  error ? "border-neg" : "border-line focus-within:border-brand"
                }`}
              >
                <span className="text-[20px] text-muted">$</span>
                <input
                  inputMode="decimal"
                  value={Number(amount) ? Number(amount).toLocaleString("en-US") : amount}
                  onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
                  className="h-full w-full bg-transparent text-[22px] font-semibold text-ink outline-none tnum placeholder:text-faint"
                  placeholder="0"
                />
                <div className="flex flex-col">
                  <button onClick={() => step(100)} className="px-1 text-faint hover:text-ink" aria-label="Increase">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => step(-100)} className="px-1 text-faint hover:text-ink" aria-label="Decrease">
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
              {error ? (
                <p className="mt-2 text-[12.5px] text-neg">{error}</p>
              ) : (
                <p className="mt-2 flex gap-4 text-[12.5px] text-muted tnum">
                  <span>Min. {usd(min)}</span>
                  <span>Max. {usd(max)}</span>
                </p>
              )}

              {!isBorrow && (
                <div className="mt-3 flex gap-2">
                  {[25, 50, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(String(Math.round((max * p) / 100)))}
                      className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[12px] bg-subtle p-5">
              <p className="text-[13px] text-muted">{isBorrow ? "Available credit" : "Outstanding balance"}</p>
              <p className="mt-1 text-[26px] font-bold leading-none tracking-[-0.025em] text-ink tnum">
                {usd(isBorrow ? (credit?.available ?? 0) : (credit?.borrowed ?? 0))}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <ProgressBar value={credit?.utilization ?? 0} height={6} className="flex-1" />
                <span className="text-[12px] text-muted tnum">{credit?.utilization ?? 0}%</span>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[13px] text-muted">You will have</p>
                <p className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-ink tnum">
                  {usd(Math.max(0, projected))}
                </p>
                <p className="text-[12.5px] text-muted">
                  {isBorrow ? "available after borrowing" : "outstanding after repayment"}
                </p>
              </div>
            </div>
          </div>

          {/* step 2 */}
          <div className="mt-8 border-t border-line pt-6">
            <StepLabel n={2} title="Select asset" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:pl-9">
              {ASSETS.map((a) => {
                const active = a.id === asset;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAsset(a.id)}
                    className={`relative flex items-center gap-3 rounded-[12px] border p-3.5 text-left transition-all duration-150 ${
                      active ? "border-brand bg-[#f7faff] ring-1 ring-brand-ring" : "border-line hover:border-[#d8e1f0]"
                    }`}
                  >
                    <AssetIcon id={a.id} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">{a.label}</p>
                      <p className="truncate text-[12.5px] text-muted">{a.sub}</p>
                    </div>
                    {active && (
                      <span className="absolute right-3 top-1/2 grid h-[18px] w-[18px] -translate-y-1/2 place-items-center rounded-full bg-brand text-white">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* step 3 */}
          <div className="mt-8 border-t border-line pt-6">
            <StepLabel n={3} title="Select network" />
            <div className="lg:pl-9">
              <button
                onClick={() => setNetworkModal(true)}
                className="flex w-full items-center gap-3 rounded-[12px] bg-subtle p-4 text-left transition-colors duration-150 hover:bg-[#f1f4fa]"
              >
                <NetworkIcon id={selectedNetwork.id} size={34} />
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-ink">{selectedNetwork.label}</p>
                  <p className="text-[12.5px] text-muted">{selectedNetwork.sub}</p>
                </div>
                <ChevronRight size={16} className="text-[#c4cbd6]" />
              </button>
            </div>
          </div>

          <Button
            full
            size="lg"
            className="mt-7"
            disabled={!valid}
            iconRight={<ArrowRight size={16} />}
            onClick={() => setReview(true)}
          >
            {isBorrow ? "Review borrow" : "Review repayment"}
          </Button>
        </Card>

        <Card className="mt-6 flex flex-wrap items-center gap-4 bg-subtle p-5">
          <IconTile size={40}>
            <Layers size={18} />
          </IconTile>
          <div className="min-w-[240px] flex-1">
            <p className="text-[14.5px] font-semibold text-ink">Your credit line is dynamic</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              As you verify more economic activity, your credit line can increase. Keep building your evidence to unlock
              more borrowing power.
            </p>
          </div>
          <Button variant="outline" pill size="sm" iconRight={<ArrowRight size={14} />} onClick={() => navigate("credit")}>
            View credit
          </Button>
        </Card>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {isBorrow ? "Borrowing overview" : "Repayment overview"}
          </h3>
          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] text-muted">Amount</span>
              <span className="text-[14px] font-semibold text-ink tnum">{usd(value)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] text-muted">Asset</span>
              <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
                <AssetIcon id={selectedAsset.id} size={20} />
                {selectedAsset.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] text-muted">Network</span>
              <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
                <NetworkIcon id={selectedNetwork.id} size={20} />
                {selectedNetwork.label}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-start justify-between border-t border-line pt-4">
            <div>
              <p className="text-[13.5px] font-medium text-ink">You will have</p>
              <p className="text-[12.5px] text-muted">
                {isBorrow ? "available after borrowing" : "outstanding after repayment"}
              </p>
            </div>
            <span className="text-[17px] font-semibold text-ink tnum">{usd(Math.max(0, projected))}</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <IconTile size={40}>
              <Layers size={18} />
            </IconTile>
            <div>
              <p className="text-[14.5px] font-semibold text-ink">
                {isBorrow ? "Why borrow with BASIS?" : "Why repay early?"}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {isBorrow
                  ? "Your verified economic activity gives you access to flexible, low-cost credit."
                  : "Repayments are verified economic evidence and directly strengthen your credit profile."}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {(isBorrow
              ? ["No credit checks", "On-chain, transparent", "Flexible repayment terms", "Built on verified economic activity"]
              : ["Lower utilization", "Stronger repayment history", "No early repayment fees", "Counts as verified evidence"]
            ).map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-brand-soft text-brand">
                  <Check size={11} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate("evidence")}
            className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
          >
            Learn how BASIS works <ArrowRight size={14} />
          </button>
        </Card>
      </div>

      {/* network modal */}
      <Modal
        open={networkModal}
        onClose={() => setNetworkModal(false)}
        title="Select network"
        subtitle="Where should this transaction settle?"
      >
        <div className="space-y-2">
          {NETWORKS.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setNetwork(n.id);
                setNetworkModal(false);
              }}
              className={`flex w-full items-center gap-3 rounded-[12px] border p-3.5 text-left transition-colors duration-150 ${
                n.id === network ? "border-brand bg-[#f7faff]" : "border-line hover:border-[#d8e1f0]"
              }`}
            >
              <NetworkIcon id={n.id} size={32} />
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink">{n.label}</p>
                <p className="text-[12.5px] text-muted">{n.sub}</p>
              </div>
              {n.id === network && <Badge tone="brand">Selected</Badge>}
            </button>
          ))}
        </div>
      </Modal>

      {/* confirmation */}
      <Modal
        open={review}
        onClose={() => !submitting && setReview(false)}
        title={isBorrow ? "Confirm borrow" : "Confirm repayment"}
        subtitle="Review the details before signing."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReview(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting}>
              {submitting ? "Submitting" : isBorrow ? `Borrow ${usd(value)}` : `Repay ${usd(value)}`}
            </Button>
          </div>
        }
      >
        <div className="rounded-[12px] border border-line">
          <div className="px-4">
            {[
              { l: "Amount", v: usd(value) },
              { l: "Asset", v: selectedAsset.label },
              { l: "Network", v: selectedNetwork.label },
              { l: isBorrow ? "Rate (APR)" : "Accrued interest", v: isBorrow ? "6.40%" : usd(12.4, { decimals: true }) },
              { l: "Settlement", v: "~15 seconds" },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between border-b border-line-soft py-3 last:border-0">
                <span className="text-[13px] text-muted">{r.l}</span>
                <span className="text-[13.5px] font-medium text-ink tnum">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-subtle p-3.5">
          <ShieldCheck size={16} className="mt-0.5 text-brand" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            This transaction is recorded on Creditcoin as verifiable credit history and becomes part of your economic
            evidence.
          </p>
        </div>
      </Modal>
    </div>
  );
}
