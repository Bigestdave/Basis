import { buildActions, usd } from "../lib/data";
import type { NavKey } from "../components/Sidebar";
import { ActivityRow } from "../components/ActivityRow";
import { Chevron, SectionHeader, StatCell, Strength } from "../components/ui";
import { useBasis } from "../context/BasisContext";

function UtilizationBar({
  borrowed,
  creditLimit,
  available,
}: {
  borrowed: number;
  creditLimit: number;
  available: number;
}) {
  const pct = creditLimit > 0 ? (borrowed / creditLimit) * 100 : 0;
  return (
    <div className="mt-7">
      <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-blue" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px]">
        <span className="flex items-center gap-2 text-ink-2">
          <span className="h-[7px] w-[7px] rounded-full bg-blue" />
          Borrowed <span className="num font-medium text-ink">{usd(borrowed, false)}</span>
        </span>
        <span className="flex items-center gap-2 text-ink-2">
          <span className="h-[7px] w-[7px] rounded-full bg-surface-2" />
          Available{" "}
          <span className="num font-medium text-ink">{usd(available, false)}</span>
        </span>
      </div>
    </div>
  );
}

export function Overview({ go }: { go: (k: NavKey) => void }) {
  const {
    account,
    evidence,
    excluded,
    factors,
    activity,
    setBuildModalOpen,
    setInspectEventId,
  } = useBasis();

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      {/* ------------------------------------------------- credit position */}
      <section className="border-b border-line pb-7 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-ink-2">Available credit</div>
            <div className="num mt-2.5 text-[46px] font-semibold leading-none tracking-[-0.035em] text-ink sm:text-[54px]">
              {usd(account.available)}
            </div>
          </div>
          <div className="pt-1 text-right">
            <div className="text-[12.5px] text-ink-3">{account.asOf}</div>
            <div className="mt-1.5 text-[12.5px] text-ink-2">Next review {account.reviewDate}</div>
          </div>
        </div>

        <UtilizationBar
          borrowed={account.borrowed}
          creditLimit={account.creditLimit}
          available={account.available}
        />

        <div className="mt-7 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
          <StatCell
            label="Credit limit"
            value={usd(account.creditLimit)}
            note="Set by verified evidence"
          />
          <div className="sm:border-l sm:border-line sm:pl-8">
            <StatCell
              label="Borrowed"
              value={usd(account.borrowed)}
              note={`${account.apr}% APR variable`}
            />
          </div>
          <div className="sm:border-l sm:border-line sm:pl-8">
            <StatCell
              label="Next payment"
              value={usd(account.nextPayment)}
              note={`Due ${account.nextPaymentDate} · Auto-pay on`}
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- evidence */}
      <section className="border-b border-line py-8">
        <SectionHeader
          title={`Why your limit is ${usd(account.creditLimit, false)}`}
          action="Full evidence"
          onAction={() => go("evidence")}
        />

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
                {evidence.rating}
              </span>
              <Strength value={evidence.strength} max={5} />
            </div>
            <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed text-ink-2">
              {evidence.summary}
            </p>
          </div>
          <div className="text-[12.5px] text-ink-3">
            Verified {evidence.lastVerified}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
          {evidence.headline.map((h, i) => (
            <div key={h.label} className={i > 0 ? "sm:border-l sm:border-line sm:pl-6" : undefined}>
              <div className="num text-[20px] font-semibold tracking-[-0.025em] text-ink">
                {h.value}
              </div>
              <div className="mt-1 max-w-[15ch] text-[12.5px] leading-snug text-ink-2">
                {h.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 divide-y divide-line border-t border-line">
          {factors.slice(0, 4).map((f) => (
            <div key={f.name} className="flex items-center gap-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium text-ink">{f.name}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-ink-2">{f.note}</div>
              </div>
              <div className="num hidden w-[132px] shrink-0 text-right text-[14px] font-medium text-ink sm:block">
                {f.value}
              </div>
              <div className="hidden w-[70px] shrink-0 justify-end md:flex">
                <Strength value={f.strength} />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-7 max-w-[76ch] border-l-2 border-line-2 pl-5 text-[13px] leading-relaxed text-ink-2">
          <span className="font-medium text-ink">Volume alone doesn&rsquo;t raise a limit.</span>{" "}
          BASIS reviewed {evidence.transactionsReviewed} transactions on your wallets and{" "}
          {excluded.count} of them changed nothing — transfers between your own addresses, repeated
          swaps of the same pair, and dust. Only {evidence.qualifyingEvents} carried economic
          meaning.
        </p>
      </section>

      {/* --------------------------------------------------------- activity */}
      <section className="border-b border-line py-8">
        <SectionHeader
          title="Recent activity"
          action="See all"
          onAction={() => go("activity")}
        />
        <div className="mt-3 divide-y divide-line">
          {activity.slice(0, 6).map((a) => (
            <div
              key={a.id}
              onClick={() => a.evidence === "verified" && setInspectEventId(a.id)}
              className={a.evidence === "verified" ? "cursor-pointer" : undefined}
            >
              <ActivityRow item={a} />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ build */}
      <section className="py-8">
        <SectionHeader
          title="Build your limit"
          subtitle="Estimated increases once the activity verifies. Nothing here is guaranteed."
        />
        <div className="mt-3 divide-y divide-line">
          {buildActions.map((b) => (
            <button
              key={b.title}
              type="button"
              onClick={() => setBuildModalOpen(true)}
              className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-5 rounded-xl px-3 py-4 text-left transition-colors hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium text-ink">{b.title}</div>
                <div className="mt-0.5 text-[13px] text-ink-2">{b.note}</div>
              </div>
              <div className="num shrink-0 text-[13.5px] font-medium text-ink-2">{b.impact}</div>
              <Chevron />
            </button>
          ))}
        </div>
      </section>

      <p className="border-t border-line py-6 text-[12px] leading-relaxed text-ink-3">
        Credit is extended against verified economic evidence, not collateral. Limits are reviewed
        monthly and can move up or down as evidence changes. Variable rate, currently{" "}
        {account.apr}% APR.
      </p>
    </div>
  );
}
