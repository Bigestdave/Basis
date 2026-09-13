import { useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ChevronRight,
  Copy,
  ExternalLink,
  Landmark,
  Lock,
  ShieldCheck,
  Waypoints,
  Wallet as WalletIcon,
  Zap,
} from "lucide-react";
import { useStore } from "../../store/store";
import {
  Badge,
  Button,
  Card,
  Delta,
  InfoHint,
  SegmentedControl,
  Skeleton,
  StatusDot,
} from "../../components/ui";
import { LineChart } from "../../components/ui/charts";
import { AssetIcon, NetworkIcon, WalletBrandIcon } from "../../components/ui/icons";
import { num, usd } from "../../lib/format";
import type { Wallet } from "../../types";

const PROVIDERS: { id: Wallet["provider"]; sub: string }[] = [
  { id: "MetaMask", sub: "Browser extension" },
  { id: "WalletConnect", sub: "Mobile & Web" },
  { id: "Coinbase Wallet", sub: "Mobile & Web" },
];

const REASONS = [
  { icon: <ShieldCheck size={18} />, title: "Verify your activity", body: "Prove your on-chain activity and behavior." },
  { icon: <Waypoints size={18} />, title: "Build your evidence", body: "Turn your activity into verifiable economic data." },
  { icon: <Zap size={18} />, title: "Unlock your credit", body: "Get a credit line based on your verified history." },
  { icon: <Lock size={18} />, title: "Keep it secure", body: "Your data stays private and in your control." },
];

function Watermark() {
  return (
    <svg
      className="pointer-events-none absolute right-[-60px] top-24 -z-10 hidden opacity-[0.35] lg:block"
      width="420"
      height="420"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
    >
      <path d="M100 20 170 60v80l-70 40-70-40V60l70-40Z" stroke="#dbe5f5" strokeWidth="2" />
      <path d="M100 50 145 75v50l-45 25-45-25V75l45-25Z" stroke="#e6edf8" strokeWidth="2" />
    </svg>
  );
}

export function ConnectWalletView() {
  const { connectWallet, connecting, pushToast } = useStore();
  const [provider, setProvider] = useState<Wallet["provider"]>("MetaMask");

  return (
    <div className="relative mx-auto max-w-[900px] pb-10 pt-6">
      <Watermark />
      <div className="flex flex-col items-center text-center">
        <span className="relative grid h-[86px] w-[86px] place-items-center rounded-full bg-[#eff4fe]">
          <WalletIcon size={34} className="text-brand" strokeWidth={1.6} />
          <span className="absolute bottom-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-brand text-[15px] font-medium leading-none text-white">
            +
          </span>
        </span>
        <h1 className="mt-6 text-[38px] font-bold leading-tight tracking-[-0.03em] text-ink">Connect your wallet</h1>
        <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted">
          Connect your wallet to see your verified economic activity and build your BASIS credit line.
        </p>
      </div>

      <Card className="mt-9 p-5">
        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">Supported wallets</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`flex items-center gap-3 rounded-[12px] border p-4 text-left transition-all duration-150 ${
                provider === p.id ? "border-brand bg-[#f7faff] ring-1 ring-brand-ring" : "border-line hover:border-[#d8e1f0]"
              }`}
            >
              <WalletBrandIcon id={p.id} size={38} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{p.id}</p>
                <p className="truncate text-[12.5px] text-muted">{p.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <p className="mb-5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">Why connect?</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((r, i) => (
            <div key={r.title} className={`text-center ${i > 0 ? "lg:border-l lg:border-line lg:pl-6" : ""}`}>
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
                {r.icon}
              </span>
              <p className="mt-3 text-[14px] font-semibold text-ink">{r.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{r.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-8 flex flex-col items-center">
        <Button
          size="lg"
          pill
          className="min-w-[272px]"
          loading={connecting}
          icon={!connecting ? <WalletIcon size={17} /> : undefined}
          iconRight={!connecting ? <ArrowRight size={16} /> : undefined}
          onClick={() => void connectWallet(provider)}
        >
          {connecting ? `Connecting to ${provider}` : "Connect wallet"}
        </Button>
        <button
          onClick={() => pushToast("info", "BASIS documentation", "Docs are not available in demo mode.")}
          className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
        >
          Learn how BASIS works <ExternalLink size={13} />
        </button>
      </div>
    </div>
  );
}

export function WalletsPage() {
  const { walletConnected, wallet, assets, balanceSeries, networks, events, status, navigate, openEvent, pushToast } =
    useStore();
  const [range, setRange] = useState("1D");
  const loading = status !== "ready";

  if (!walletConnected) return <ConnectWalletView />;

  const connected = networks.filter((n) => n.status === "connected");
  const sliced =
    range === "1D"
      ? balanceSeries.slice(-10)
      : range === "1W"
        ? balanceSeries.slice(-18)
        : range === "1M"
          ? balanceSeries.slice(-28)
          : balanceSeries;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.028em] text-ink">Wallet</h1>
            <p className="mt-2 text-[14px] text-muted">Your connected wallet and verified economic activity.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(wallet?.address ?? "");
                pushToast("info", "Address copied", wallet?.shortAddress);
              }}
              className="inline-flex h-8 items-center gap-2 rounded-full bg-soft px-3 font-mono text-[12.5px] text-ink transition-colors hover:bg-[#eaeef4]"
            >
              0x71...92A
              <Copy size={12} className="text-muted" />
            </button>
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[12.5px] font-medium text-ink ring-1 ring-line">
              <StatusDot /> Connected
            </span>
            <Button size="sm" pill onClick={() => navigate("build-credit")}>
              Verify history
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div>
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              Total wallet balance <InfoHint text="Aggregated value across all connected networks." />
            </p>
            {loading ? (
              <Skeleton className="mt-3 h-11 w-56" />
            ) : (
              <p className="mt-2 text-[40px] font-bold leading-none tracking-[-0.035em] text-ink tnum">
                {usd(wallet?.totalBalance ?? 0, { decimals: true })}
              </p>
            )}
            <Delta value={wallet?.change24hValue ?? 0} pctValue={wallet?.change24hPct ?? 0} className="mt-2.5" />
            <SegmentedControl
              className="mt-5"
              value={range}
              onChange={setRange}
              options={[
                { id: "1D", label: "1D" },
                { id: "1W", label: "1W" },
                { id: "1M", label: "1M" },
                { id: "1Y", label: "1Y" },
                { id: "ALL", label: "ALL" },
              ]}
            />
          </div>
          <div className="pt-2">
            {loading ? (
              <Skeleton className="h-[150px]" />
            ) : (
              <LineChart
                data={sliced}
                height={142}
                grid
                labels={["Apr 17", "Apr 18", "Apr 19", "Apr 20", "Apr 21", "Apr 22", "Apr 23", "Apr 24"]}
              />
            )}
          </div>
        </div>

        <div className="mt-9 border-t border-line pt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">Assets</h2>
            <button
              onClick={() => pushToast("info", "All assets", "Full asset list is limited in demo mode.")}
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
          {loading
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mt-4 h-12" />)
            : assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pushToast("info", `${a.name}`, `${usd(a.value, { decimals: true })} · ${a.change24h}% today`)}
                  className="group grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_20px] items-center border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle"
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
              ))}
        </div>

        <div className="mt-9 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">Recent activity</h2>
            <button
              onClick={() => navigate("activity")}
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
            >
              View all activity <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_20px] border-b border-line pb-3 text-[13px] text-muted">
            <div>Type</div>
            <div>Asset</div>
            <div>Amount</div>
            <div>Date</div>
            <div />
          </div>
          {loading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="mt-4 h-12" />)
            : events.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  onClick={() => openEvent(e.id)}
                  className="group grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_20px] items-center border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                      {e.type === "deposit" ? (
                        <Landmark size={15} />
                      ) : e.type === "swapped" ? (
                        <ArrowLeftRight size={15} />
                      ) : (
                        <ArrowDown size={15} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">{e.title}</p>
                      <p className="truncate text-[12.5px] text-muted">{e.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <AssetIcon id={e.assetId} size={24} />
                    <span className="text-[13.5px] text-ink">{e.assetSymbol}</span>
                  </div>
                  <div className={`text-[13.5px] font-medium tnum ${e.amount >= 0 ? "text-pos" : "text-neg"}`}>
                    {e.amount >= 0 ? "+" : "-"}
                    {Math.abs(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                    {e.assetSymbol}
                  </div>
                  <div className="text-[13.5px] text-muted">{e.date}</div>
                  <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] group-hover:text-muted" />
                </button>
              ))}
        </div>
      </div>

      {/* rail */}
      <div className="xl:border-l xl:border-line xl:pl-8">
        <p className="flex items-center gap-1.5 text-[16px] font-semibold text-ink">
          Connected networks <InfoHint text="Networks BASIS reads to build your economic evidence." />
        </p>
        <div className="mt-3">
          {connected.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate("networks")}
              className="group flex w-full items-center gap-3 border-b border-line-soft py-4 text-left last:border-0 hover:bg-subtle"
            >
              <NetworkIcon id={n.id} size={32} />
              <span className="flex-1 text-[14.5px] font-medium text-ink">{n.name}</span>
              <Badge tone="positive">Connected</Badge>
              <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
            </button>
          ))}
        </div>
        <Button variant="outline" full className="mt-5" onClick={() => navigate("networks")}>
          Connect another network
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => navigate("connect-wallet")}>
          Manage wallet connection
        </Button>
      </div>
    </div>
  );
}
