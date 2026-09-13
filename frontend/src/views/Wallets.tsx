import { useState } from "react";
import { wallets as fallbackWallets } from "../lib/data";
import { Button, SectionHeader, TextLink } from "../components/ui";
import { CheckIcon, ExternalIcon, PlusIcon, WalletIcon } from "../components/Icons";
import { useBasis } from "../context/BasisContext";
import { authenticateLiveWallet } from "../services/wallets";

export function Wallets() {
  const { wallets: liveWallets, refresh } = useBasis();
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const walletList = liveWallets && liveWallets.length > 0 ? liveWallets : fallbackWallets;

  const handleConnect = async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      await authenticateLiveWallet();
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setWalletError(msg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      <section className="border-b border-line pb-7 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-[58ch] text-[14px] leading-relaxed text-ink-2">
            {walletList.length} wallets are linked to your account. Verified history on any of them can support
            your credit line — activity that only moves value between them does not.
          </p>
          <div className="flex flex-col items-end gap-2">
            <Button onClick={handleConnect} disabled={connecting}>
              <PlusIcon size={16} className="-ml-1 mr-1.5" />
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
            {walletError && (
              <span className="text-[12px] text-red-500 max-w-[260px] text-right">{walletError}</span>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-line py-7">
        <div className="divide-y divide-line">
          {walletList.map((w) => (
            <div key={w.address} className="flex items-center gap-4 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2">
                <WalletIcon size={18} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="num text-[14.5px] font-medium text-ink">{w.address}</span>
                  <ExternalIcon size={14} className="text-ink-3" />
                </div>
                <div className="mt-0.5 text-[13px] text-ink-2">
                  {w.label} · {w.chain}
                </div>
              </div>

              <div className="hidden w-[150px] shrink-0 text-[13px] text-ink-2 sm:block">
                {w.events} qualifying {w.events === 1 ? "event" : "events"}
              </div>

              <div className="w-[132px] shrink-0 text-right">
                {w.state === "verified" ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                    <CheckIcon size={14} className="text-ink-3" />
                    Verified {w.verified}
                  </span>
                ) : (
                  <TextLink>Verify history</TextLink>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-8">
        <SectionHeader title="How verification works" />
        <div className="mt-4 grid gap-8 sm:grid-cols-3">
          {[
            {
              t: "Read-only access",
              d: "BASIS never holds your keys and cannot move funds. Linking a wallet grants nothing beyond the ability to read its public history.",
            },
            {
              t: "Cross-chain attestation",
              d: "Each qualifying event is attested with Attestcoin, so activity on one chain can support credit issued on another.",
            },
            {
              t: "Continuous review",
              d: "Verified evidence is refreshed daily. A wallet that goes quiet does not lose its history, but it stops adding to it.",
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
