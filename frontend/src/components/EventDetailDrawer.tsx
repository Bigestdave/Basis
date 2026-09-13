import { useEffect, useState } from "react";
import { getEventDetail, type EventTechnicalDetail } from "../services/evidence";
import { CheckIcon, CloseIcon, ExternalIcon } from "./Icons";
import { Divider, KeyValue, Strength } from "./ui";
import { usd } from "../lib/data";

export function EventDetailDrawer({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EventTechnicalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventDetail(eventId)
      .then(setDetail)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/20 backdrop-blur-[2px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full w-full max-w-[460px] flex-col border-l border-line bg-white shadow-2xl">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">Event verification</span>
            {detail?.event.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pos/10 px-2 py-0.5 text-[11.5px] font-medium text-pos">
                <CheckIcon size={12} />
                Attested
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="scroll-area flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="py-12 text-center text-[13.5px] text-ink-2">
              Loading verification details...
            </div>
          ) : detail ? (
            <div className="space-y-6">
              <div>
                <div className="text-[12px] font-medium text-ink-3 uppercase tracking-wider">
                  Economic Interpretation
                </div>
                <div className="mt-1 text-[18px] font-semibold text-ink">
                  {detail.event.type}
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                  {detail.event.description}
                </p>
              </div>

              <div className="border-t border-line pt-4">
                <KeyValue
                  k="Settlement amount"
                  v={usd(detail.event.amount?.usd ?? 0)}
                />
                <KeyValue k="Network" v={detail.event.chainKey} />
                <KeyValue k="Block number" v={String(detail.event.blockHeight)} />
                <KeyValue
                  k="Transaction hash"
                  v={`${detail.event.txHash.slice(0, 10)}…${detail.event.txHash.slice(-8)}`}
                />
                <KeyValue
                  k="Origin / From"
                  v={`${detail.event.from.slice(0, 8)}…${detail.event.from.slice(-6)}`}
                />
                <KeyValue
                  k="Target / To"
                  v={`${detail.event.to.slice(0, 8)}…${detail.event.to.slice(-6)}`}
                />
                {detail.event.protocol && (
                  <KeyValue k="Protocol" v={detail.event.protocol} />
                )}
              </div>

              <Divider />

              {/* Attestcoin Cryptographic Proof */}
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[14.5px] font-semibold text-ink">Attestcoin (USC) Proof</h3>
                  <span className="text-[12px] text-ink-3">Precompile 0xFD2</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                  Proves inclusion of the source transaction in an attested block before counting as
                  economic evidence.
                </p>

                <div className="mt-4 border-t border-line pt-2">
                  <KeyValue
                    k="Attestation status"
                    v={detail.attestation?.verified ? "Verified on-chain" : "Pending"}
                  />
                  <KeyValue
                    k="BlockProver result"
                    v={detail.attestation?.verified ? "Proof valid (true)" : "Pending check"}
                  />
                  <KeyValue
                    k="Merkle siblings"
                    v={`${detail.attestation?.merkleSiblings ?? 12} hashes`}
                  />
                  {detail.attestation?.merkleRoot && (
                    <KeyValue
                      k="Merkle root"
                      v={`${detail.attestation.merkleRoot.slice(0, 10)}…${detail.attestation.merkleRoot.slice(-6)}`}
                    />
                  )}
                  {detail.attestation?.continuityLowerEndpointDigest && (
                    <KeyValue
                      k="Continuity digest"
                      v={`${detail.attestation.continuityLowerEndpointDigest.slice(0, 10)}…${detail.attestation.continuityLowerEndpointDigest.slice(-6)}`}
                    />
                  )}
                  <KeyValue
                    k="Trust boundary"
                    v="Server-side verified"
                    muted
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-[13.5px] text-ink-2">
              Event details could not be loaded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
