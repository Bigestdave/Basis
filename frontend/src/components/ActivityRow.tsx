import type { ActivityItem } from "../lib/data";
import { usd } from "../lib/data";
import { cn } from "../utils/cn";
import { ArrowIn, ArrowOut, CheckIcon, CreditIcon, LayersIcon, SwapIcon } from "./Icons";
import { IconDisc } from "./ui";

function KindIcon({ kind }: { kind: ActivityItem["kind"] }) {
  switch (kind) {
    case "deposit":
    case "settlement":
      return <ArrowIn size={18} />;
    case "repay":
      return <ArrowOut size={18} />;
    case "lend":
      return <LayersIcon size={18} />;
    case "borrow":
      return <CreditIcon size={18} />;
    default:
      return <SwapIcon size={18} />;
  }
}

export function ActivityRow({ item, onClick }: { item: ActivityItem; onClick?: () => void }) {
  const sign = item.direction === "in" ? "+" : item.direction === "out" ? "−" : "";
  const counted = item.evidence === "verified";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-surface",
        onClick && "cursor-pointer",
      )}
    >
      <IconDisc>
        <KindIcon kind={item.kind} />
      </IconDisc>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium text-ink">{item.title}</div>
        <div className="mt-0.5 truncate text-[13px] text-ink-2">
          {item.counterparty} · {item.chain}
        </div>
      </div>

      <div className="hidden w-[168px] shrink-0 items-center gap-1.5 sm:flex">
        {counted ? (
          <>
            <CheckIcon size={13} className="shrink-0 text-ink-3" />
            <span className="truncate text-[12.5px] text-ink-2">{item.evidenceNote}</span>
          </>
        ) : (
          <span className="truncate text-[12.5px] text-ink-3">{item.evidenceNote}</span>
        )}
      </div>

      <div className="w-[120px] shrink-0 text-right">
        <div
          className={cn(
            "num text-[14.5px] font-medium",
            counted ? "text-ink" : "text-ink-2",
          )}
        >
          {sign}
          {usd(item.amount)}
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-3">{item.date}</div>
      </div>
    </div>
  );
}
