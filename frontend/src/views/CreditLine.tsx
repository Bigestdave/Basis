import { limitHistory, payments, usd } from "../lib/data";
import { SectionHeader } from "../components/ui";
import { cn } from "../utils/cn";
import { useBasis } from "../context/BasisContext";

export function CreditLine() {
  const { account } = useBasis();
  const pct = account.creditLimit > 0 ? (account.borrowed / account.creditLimit) * 100 : 0;

  const terms = [
    { k: "Rate", v: `${account.apr}% APR variable`, sub: "Adjusts with your evidence rating" },
    { k: "Collateral", v: "None required", sub: "Credit is extended against evidence" },
    { k: "Minimum payment", v: usd(account.nextPayment), sub: "Monthly, auto-pay enabled" },
    { k: "Fees", v: "No origination or prepayment fee", sub: "Network fees covered by BASIS" },
    { k: "Settlement", v: "Creditcoin", sub: "Verification via Attestcoin" },
    { k: "Limit review", v: `Monthly · next ${account.reviewDate}`, sub: "Can move up or down" },
  ];

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      <section className="border-b border-line pb-8 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-ink-2">Credit limit</div>
            <div className="num mt-2.5 text-[46px] font-semibold leading-none tracking-[-0.035em] text-ink">
              {usd(account.creditLimit)}
            </div>
          </div>
          <div className="pt-1 text-right text-[12.5px] text-ink-3">
            Opened {account.openedOn}
            <div className="mt-1 text-ink-2">Line 8842-0917</div>
          </div>
        </div>

        <div className="mt-7 flex h-[7px] w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-blue" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
          {[
            { label: "Available", value: usd(account.available) },
            { label: "Borrowed", value: usd(account.borrowed) },
            { label: "Interest accrued", value: usd(account.interestAccrued) },
            { label: "Utilisation", value: `${pct.toFixed(1)}%` },
          ].map((s, i) => (
            <div key={s.label} className={i > 0 ? "sm:border-l sm:border-line sm:pl-6" : undefined}>
              <div className="text-[12.5px] text-ink-2">{s.label}</div>
              <div className="num mt-1.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-line py-8">
        <SectionHeader title="Terms" />
        <div className="mt-4 grid gap-x-12 sm:grid-cols-2">
          {terms.map((t) => (
            <div key={t.k} className="flex items-start justify-between gap-6 border-b border-line py-3.5">
              <span className="text-[13.5px] text-ink-2">{t.k}</span>
              <span className="text-right">
                <span className="num block text-[13.5px] font-medium text-ink">{t.v}</span>
                <span className="mt-0.5 block text-[12px] text-ink-3">{t.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-line py-8">
        <SectionHeader title="Payments" action="Statements" />
        <div className="mt-4 divide-y divide-line border-t border-line">
          {payments.map((p) => (
            <div key={p.date} className="flex items-center gap-6 py-3.5">
              <div className="w-20 shrink-0 text-[13.5px] font-medium text-ink">{p.date}</div>
              <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">{p.note}</div>
              <div
                className={cn(
                  "hidden w-24 shrink-0 text-[13px] sm:block",
                  p.status === "Paid" ? "text-ink-3" : "text-ink-2",
                )}
              >
                {p.status}
              </div>
              <div className="num w-24 shrink-0 text-right text-[14px] font-medium text-ink">
                {usd(p.amount)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-8">
        <SectionHeader
          title="Limit history"
          subtitle="Every change is tied to a specific piece of verified evidence."
        />
        <div className="mt-4 divide-y divide-line border-t border-line">
          {limitHistory.map((h) => (
            <div key={h.date} className="flex items-start gap-6 py-4">
              <div className="w-28 shrink-0 text-[13px] text-ink-2">{h.date}</div>
              <div className="min-w-0 flex-1">
                <div className="num text-[14.5px] font-medium text-ink">
                  {h.change === "Opened" ? `Line opened at ${h.limit}` : `${h.change} to ${h.limit}`}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-2">{h.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
