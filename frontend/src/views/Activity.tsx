import { useMemo, useState } from "react";
import { activity as fallbackActivity, evidence as fallbackEvidence } from "../lib/data";
import type { ActivityItem } from "../lib/data";
import { ActivityRow } from "../components/ActivityRow";
import { cn } from "../utils/cn";
import { useBasis } from "../context/BasisContext";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "lend", label: "Lending" },
  { key: "credit", label: "Credit" },
  { key: "swap", label: "Swaps" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const MONTHS: Record<string, string> = {
  Feb: "February 2026",
  Jan: "January 2026",
  Dec: "December 2025",
};

function matches(item: ActivityItem, f: FilterKey) {
  if (f === "all") return true;
  if (f === "credit") return item.kind === "borrow" || item.kind === "repay";
  if (f === "deposit") return item.kind === "deposit" || item.kind === "settlement";
  return item.kind === f;
}

export function Activity() {
  const { activity: liveActivity, evidence: liveEvidence, setInspectEventId } = useBasis();
  const activityData = liveActivity || fallbackActivity;
  const evidenceData = liveEvidence || fallbackEvidence;

  const [filter, setFilter] = useState<FilterKey>("all");
  const [evidenceOnly, setEvidenceOnly] = useState(false);

  const groups = useMemo(() => {
    const rows = activityData.filter(
      (a) => matches(a, filter) && (!evidenceOnly || a.evidence === "verified"),
    );
    const out: { month: string; items: ActivityItem[] }[] = [];
    rows.forEach((r) => {
      const month = MONTHS[r.date.split(" ")[0]] ?? "Earlier";
      const last = out[out.length - 1];
      if (last && last.month === month) last.items.push(r);
      else out.push({ month, items: [r] });
    });
    return out;
  }, [activityData, filter, evidenceOnly]);

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      <section className="pb-6 pt-8">
        <p className="max-w-[64ch] text-[14px] leading-relaxed text-ink-2">
          {evidenceData.transactionsReviewed} transactions reviewed across three chains.{" "}
          <span className="font-medium text-ink">
            {evidenceData.qualifyingEvents} qualified as economic evidence
          </span>{" "}
          and support your credit line.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[13.5px] font-medium transition-colors",
                filter === f.key
                  ? "bg-ink text-white"
                  : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setEvidenceOnly((v) => !v)}
            className="ml-auto flex items-center gap-2.5 text-[13.5px] font-medium text-ink-2 hover:text-ink"
          >
            Evidence only
            <span
              className={cn(
                "relative h-[22px] w-[38px] rounded-full transition-colors",
                evidenceOnly ? "bg-blue" : "bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all",
                  evidenceOnly ? "left-[19px]" : "left-[3px]",
                )}
              />
            </span>
          </button>
        </div>
      </section>

      <div className="hidden items-center gap-4 border-t border-line pb-2 pt-4 sm:flex">
        <div className="min-w-0 flex-1 pl-[52px] text-[12px] text-ink-3">Transaction</div>
        <div className="w-[168px] shrink-0 text-[12px] text-ink-3">Evidence</div>
        <div className="w-[120px] shrink-0 text-right text-[12px] text-ink-3">Amount</div>
      </div>

      {groups.map((g) => (
        <section key={g.month} className="border-t border-line py-5">
          <div className="text-[13px] font-medium text-ink-2">{g.month}</div>
          <div className="mt-1.5 divide-y divide-line">
            {g.items.map((a) => (
              <ActivityRow
                key={a.id}
                item={a}
                onClick={a.evidence === "verified" ? () => setInspectEventId(a.id) : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <div className="border-t border-line py-16 text-center">
          <div className="text-[14.5px] font-medium text-ink">No activity in this view</div>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            Try a different filter or turn off the evidence-only view.
          </p>
        </div>
      )}

      <p className="border-t border-line py-6 text-[12px] leading-relaxed text-ink-3">
        Amounts are shown in USD at the time of settlement. Chain-level records are available on
        each transaction.
      </p>
    </div>
  );
}
