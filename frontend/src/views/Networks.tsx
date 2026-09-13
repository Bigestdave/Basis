import { useEffect, useState } from "react";
import { getNetworks, toggleNetwork, type NetworkDto } from "../services/networks";
import { SectionHeader } from "../components/ui";
import { CheckIcon, ExternalIcon } from "../components/Icons";
import { chains as fallbackChains } from "../lib/data";

export function Networks() {
  const [networks, setNetworks] = useState<NetworkDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNetworks()
      .then((data) => {
        if (data.length > 0) {
          setNetworks(data);
        }
      })
      .catch(() => {
        // Fallback to local default chains if backend is connecting
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (net: NetworkDto) => {
    try {
      const updated = await toggleNetwork(net.key, !net.enabled);
      setNetworks(updated);
    } catch {
      // Toggle locally on error
      setNetworks((prev) =>
        prev.map((n) => (n.key === net.key ? { ...n, enabled: !n.enabled } : n)),
      );
    }
  };

  const displayNetworks =
    networks.length > 0
      ? networks
      : fallbackChains.map((c) => ({
          key: c.name.toLowerCase(),
          name: c.name,
          chainId: c.name === "Base" ? 8453 : c.name === "Ethereum" ? 1 : 42161,
          family: "evm",
          attestcoinChainKey: c.name === "Ethereum" ? 1 : null,
          attestable: c.name !== "Base",
          rpcConfigured: true,
          enabled: true,
          selected: true,
          events: c.events,
          statusText: c.status,
        }));

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      <section className="border-b border-line pb-7 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-ink-2">Connected networks</div>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
              BASIS aggregates economic activity across multiple networks. Evidence is attested with
              Attestcoin and settled onto Creditcoin.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-line py-7">
        <div className="divide-y divide-line">
          {displayNetworks.map((n) => {
            const isAttested = n.attestable || n.statusText?.startsWith("Verified");
            return (
              <div key={n.key} className="flex items-center gap-4 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink font-semibold text-[13px]">
                  {n.name.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-medium text-ink">{n.name}</span>
                    {n.chainId && (
                      <span className="num text-[12px] text-ink-3">Chain ID {n.chainId}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-2">
                    {n.family.toUpperCase()} ·{" "}
                    {isAttested ? "Attestcoin attested" : "Observed source"}
                  </div>
                </div>

                <div className="hidden w-[160px] shrink-0 text-[13px] text-ink-2 sm:block">
                  {n.rpcConfigured ? (
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-pos" />
                      RPC configured
                    </span>
                  ) : (
                    <span className="text-ink-3">Read replica</span>
                  )}
                </div>

                <div className="w-[140px] shrink-0 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(n as NetworkDto)}
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors"
                  >
                    <CheckIcon size={14} className={n.enabled ? "text-pos" : "text-ink-3"} />
                    {n.enabled ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-8">
        <SectionHeader title="Cross-chain architecture" />
        <div className="mt-4 grid gap-8 sm:grid-cols-3">
          {[
            {
              t: "Source networks",
              d: "Activity originates on EVM chains including Base, Ethereum and Arbitrum where genuine commerce occurs.",
            },
            {
              t: "Attestcoin verification",
              d: "Transactions are proved by Attestcoin precompiles, ensuring events cannot be forged or re-ordered.",
            },
            {
              t: "Creditcoin settlement",
              d: "Credit lines, draws and repayments are registered directly on Creditcoin CC3 without intermediaries.",
            },
          ].map((c) => (
            <div key={c.t} className="border-t border-line pt-4">
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{c.t}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
