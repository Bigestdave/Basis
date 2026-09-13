import { usd } from "../lib/data";
import { Button, Divider, SectionHeader, Strength } from "../components/ui";
import { useBasis } from "../context/BasisContext";

export function Evidence() {
  const { account, evidence, excluded, factors, setBuildModalOpen } = useBasis();

  const exclusions = [
    {
      label: "Transfers between your own wallets",
      count: Math.round(excluded.count * 0.53),
      note: "Moving value you already control is not new economic activity",
    },
    {
      label: "Repeated swaps of the same pair",
      count: Math.round(excluded.count * 0.36),
      note: "Counted once — repetition adds volume, not evidence",
    },
    {
      label: "Dust, airdrops and spam",
      count: Math.max(0, excluded.count - Math.round(excluded.count * 0.53) - Math.round(excluded.count * 0.36)),
      note: "Received without consideration, so nothing is demonstrated",
    },
  ];

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      <section className="border-b border-line pb-8 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-[13px] font-medium text-ink-2">Economic evidence</div>
            <div className="mt-2.5 flex items-center gap-4">
              <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink">
                {evidence.rating}
              </span>
              <Strength value={evidence.strength} max={5} />
            </div>
            <p className="mt-3.5 max-w-[58ch] text-[14px] leading-relaxed text-ink-2">
              {evidence.summary} This evidence supports a limit of{" "}
              <span className="font-medium text-ink">{usd(account.creditLimit, false)}</span>.
            </p>
          </div>
          <div className="pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBuildModalOpen(true)}
            >
              Re-verify wallets
            </Button>
            <div className="mt-2.5 text-right text-[12px] text-ink-3">
              Last run {evidence.lastVerified}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
          {evidence.headline.map((h, i) => (
            <div key={h.label} className={i > 0 ? "sm:border-l sm:border-line sm:pl-6" : undefined}>
              <div className="num text-[22px] font-semibold tracking-[-0.025em] text-ink">
                {h.value}
              </div>
              <div className="mt-1 text-[12.5px] leading-snug text-ink-2">{h.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-line py-8">
        <SectionHeader
          title="What supports your limit"
          subtitle="Five qualities are assessed. Duration and independence carry more weight than size or frequency."
        />

        <div className="mt-6 divide-y divide-line border-t border-line">
          {factors.map((f) => (
            <div key={f.name} className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                    {f.name}
                  </h3>
                  <Strength value={f.strength} />
                </div>
                <div className="text-right">
                  <div className="num text-[15px] font-medium text-ink">{f.value}</div>
                  <div className="num mt-0.5 text-[12.5px] text-ink-3">{f.contribution}</div>
                </div>
              </div>
              <p className="mt-2.5 max-w-[72ch] text-[13.5px] leading-relaxed text-ink-2">
                {f.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-8">
        <SectionHeader
          title="What was reviewed and set aside"
          subtitle={`${excluded.count} of ${evidence.transactionsReviewed} transactions did not change your limit.`}
        />

        <div className="mt-5 divide-y divide-line border-t border-line">
          {exclusions.map((e) => (
            <div key={e.label} className="flex items-center gap-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium text-ink">{e.label}</div>
                <div className="mt-0.5 text-[13px] text-ink-2">{e.note}</div>
              </div>
              <div className="num shrink-0 text-[14px] font-medium text-ink-2">{e.count}</div>
            </div>
          ))}
        </div>

        <Divider className="mt-8" />
        <p className="mt-6 max-w-[72ch] text-[13px] leading-relaxed text-ink-3">
          Every qualifying event is checked against its source chain with Attestcoin before it can
          support credit. BASIS never sees your keys, and verification is read-only. Limits are
          re-assessed on the fifth of each month; the next review is {account.reviewDate}.
        </p>
      </section>
    </div>
  );
}
