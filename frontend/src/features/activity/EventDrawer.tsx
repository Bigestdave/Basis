import { ArrowUpRight, BadgeCheck, Copy, ExternalLink } from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Drawer, IconTile, KeyValue } from "../../components/ui";
import { AssetIcon, NetworkIcon } from "../../components/ui/icons";
import { shorten, signedAmount, usd } from "../../lib/format";
import { networks } from "../../data/seed";

function MonoField({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const { pushToast } = useStore();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft py-3 last:border-0">
      <span className="text-[12.5px] uppercase tracking-[0.06em] text-faint">{label}</span>
      <button
        onClick={() => {
          if (!copyable) return;
          navigator.clipboard?.writeText(value);
          pushToast("info", "Copied", label);
        }}
        className={`text-right font-mono text-[12.5px] text-ink ${copyable ? "hover:text-brand" : "cursor-default"}`}
      >
        {value}
        {copyable && <Copy size={12} className="ml-1.5 inline text-faint" />}
      </button>
    </div>
  );
}

export function EventDrawer() {
  const { selectedEventId, openEvent, events, pushToast } = useStore();
  const event = events.find((e) => e.id === selectedEventId) ?? null;
  const network = networks.find((n) => n.id === event?.network);

  return (
    <Drawer
      open={!!event}
      onClose={() => openEvent(null)}
      title={event?.title ?? ""}
      subtitle={event ? `${event.date} · ${event.time} · ${network?.name}` : undefined}
      width={480}
      footer={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            full
            iconRight={<ExternalLink size={15} />}
            onClick={() => pushToast("info", "Explorer link", "Opening block explorer is disabled in demo mode.")}
          >
            View on explorer
          </Button>
          <Button variant="secondary" full onClick={() => openEvent(null)}>
            Close
          </Button>
        </div>
      }
    >
      {event && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <AssetIcon id={event.assetId} size={44} />
            <div>
              <p
                className={`text-[26px] font-bold leading-none tracking-[-0.02em] tnum ${
                  event.amount >= 0 ? "text-pos" : "text-ink"
                }`}
              >
                {signedAmount(event.amount, event.assetSymbol)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted tnum">{usd(event.amountUsd, { decimals: true })}</p>
            </div>
            <div className="ml-auto">
              {event.verified ? (
                <Badge tone="positive" dot>
                  Verified
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  Pending
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-[12px] border border-line">
            <div className="px-4">
              <KeyValue label="Type" value={event.title} className="border-b border-line-soft" />
              <KeyValue label="Protocol / counterparty" value={event.protocol ?? "—"} className="border-b border-line-soft" />
              <KeyValue
                label="Network"
                value={
                  <span className="inline-flex items-center gap-2">
                    <NetworkIcon id={event.network} size={18} />
                    {network?.name}
                  </span>
                }
                className="border-b border-line-soft"
              />
              <KeyValue label="Date" value={`${event.date} · ${event.time}`} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">Cross-chain evidence</p>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-pos">
                <BadgeCheck size={14} />
                Verified by Attestcoin
              </span>
            </div>
            <div className="rounded-[12px] bg-subtle px-4 py-1">
              <MonoField label="Network" value={network?.name ?? "—"} />
              <MonoField label="Block" value={event.proof.block.toLocaleString("en-US")} />
              <MonoField label="Transaction" value={shorten(event.proof.txHash, 10, 6)} copyable />
              <MonoField label="Event" value={event.proof.event} />
              <MonoField label="From" value={shorten(event.proof.from, 8, 6)} copyable />
              <MonoField label="To" value={shorten(event.proof.to, 8, 6)} copyable />
              <MonoField label="Asset" value={event.assetSymbol} />
              <MonoField
                label="Amount"
                value={`${Math.abs(event.amount).toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })} ${event.assetSymbol}`}
              />
              <MonoField label="Timestamp" value={`${event.date} ${event.time} UTC`} />
              <MonoField label="Attestation" value={event.proof.attestation} copyable />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-[12px] border border-line bg-white p-4">
            <IconTile tone="positive" size={36}>
              <BadgeCheck size={17} />
            </IconTile>
            <div>
              <p className="text-[13.5px] font-semibold text-ink">Attestcoin verification</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                This event was independently attested at {event.proof.attestedAt} and counted once toward your economic
                evidence.
              </p>
              <button
                onClick={() => pushToast("info", "Attestation record", event.proof.attestation)}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
              >
                View attestation record
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
