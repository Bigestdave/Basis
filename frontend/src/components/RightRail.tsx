import { useState } from "react";
import { cn } from "../utils/cn";
import { account as defaultAccount, chains, usd } from "../lib/data";
import { CheckIcon, ChevronRight } from "./Icons";
import { Button, Divider, KeyValue, TextLink } from "./ui";
import { borrow, repay } from "../services/credit";

export type PanelMode = "borrow" | "repay";
export type PanelStage = "input" | "review" | "done";

export type PanelState = {
  mode: PanelMode;
  amount: string;
  stage: PanelStage;
};

function parseAmount(a: string) {
  const n = Number(a.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatInput(a: string) {
  if (!a) return "";
  const [whole, dec] = a.split(".");
  const w = whole.replace(/^0+(?=\d)/, "");
  const withCommas = Number(w || 0).toLocaleString("en-US");
  return dec !== undefined ? `${withCommas}.${dec.slice(0, 2)}` : withCommas;
}

export function RightRail({
  state,
  setState,
  creditAccount,
  onActionComplete,
}: {
  state: PanelState;
  setState: (s: PanelState) => void;
  creditAccount?: typeof defaultAccount;
  onActionComplete?: () => void;
}) {
  const account = creditAccount ?? defaultAccount;
  const { mode, amount, stage } = state;
  const value = parseAmount(amount);
  const max = mode === "borrow" ? account.available : account.borrowed + account.interestAccrued;
  const over = value > max;
  const newBorrowed =
    mode === "borrow" ? account.borrowed + value : Math.max(account.borrowed - value, 0);
  const newAvailable = Math.max(account.creditLimit - newBorrowed, 0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionRef, setActionRef] = useState("BSS-40192-7C");
  const [settlementProvider, setSettlementProvider] = useState("Creditcoin");

  const set = (patch: Partial<PanelState>) => setState({ ...state, ...patch });

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "borrow") {
        const res = await borrow(value);
        setActionRef(res.settlement?.reference ?? res.transaction.id);
        setSettlementProvider(res.settlement?.provider ?? "Creditcoin");
      } else {
        const res = await repay(value);
        setActionRef(res.settlement?.reference ?? res.transaction.id);
        setSettlementProvider(res.settlement?.provider ?? "Creditcoin");
      }
      onActionComplete?.();
      set({ stage: "done" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* ---------------------------------------------------- action panel */}
      <section className="px-6 py-6">
        {stage === "input" && (
          <>
            <div className="inline-flex rounded-full bg-surface p-1">
              {(["borrow", "repay"] as PanelMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ mode: m, amount: "" })}
                  className={cn(
                    "h-8 rounded-full px-4 text-[13.5px] font-medium capitalize transition-colors",
                    mode === m ? "bg-ink text-white" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-baseline">
                <span
                  className={cn(
                    "num text-[38px] font-semibold tracking-[-0.03em]",
                    value > 0 ? "text-ink" : "text-ink-3",
                  )}
                >
                  $
                </span>
                <input
                  inputMode="decimal"
                  value={formatInput(amount)}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                    if ((raw.match(/\./g) || []).length > 1) return;
                    set({ amount: raw });
                  }}
                  className="num w-full min-w-0 bg-transparent text-[38px] font-semibold tracking-[-0.03em] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
              <button
                type="button"
                onClick={() => set({ amount: String(Math.floor(max)) })}
                className="h-8 shrink-0 rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-surface-2"
              >
                Max
              </button>
            </div>

            <p className={cn("mt-2 text-[13px]", over ? "text-neg" : "text-ink-2")}>
              {over
                ? `Exceeds ${mode === "borrow" ? "available credit" : "amount owed"}`
                : mode === "borrow"
                  ? `${usd(account.available)} available · USDC on Base`
                  : `${usd(max)} owed including interest`}
            </p>

            <div className="mt-5 border-t border-line">
              <button
                type="button"
                className="group flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-[13.5px] text-ink-2">
                  {mode === "borrow" ? "Receive in" : "Pay from"}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="num text-[13.5px] font-medium text-ink">
                    {account.primaryWallet}
                  </span>
                  <span className="text-[13.5px] text-ink-3">{account.primaryChain}</span>
                  <ChevronRight size={15} className="text-ink-3 group-hover:text-ink-2" />
                </span>
              </button>
              <div className="flex items-center justify-between border-t border-line py-3">
                <span className="text-[13.5px] text-ink-2">
                  {mode === "borrow" ? "Rate" : "Applies to"}
                </span>
                <span className="num text-[13.5px] font-medium text-ink">
                  {mode === "borrow" ? `${account.apr}% APR variable` : "Interest, then principal"}
                </span>
              </div>
            </div>

            <Button
              full
              className="mt-5"
              disabled={value <= 0 || over}
              onClick={() => set({ stage: "review" })}
            >
              {mode === "borrow" ? "Review borrow" : "Review repayment"}
            </Button>
            <p className="mt-3 text-center text-[12px] text-ink-3">
              No collateral required · Settled on Creditcoin
            </p>
          </>
        )}

        {stage === "review" && (
          <>
            <div className="text-[12.5px] font-medium text-ink-2">
              {mode === "borrow" ? "Review borrow" : "Review repayment"}
            </div>
            <div className="num mt-2 text-[34px] font-semibold tracking-[-0.03em] text-ink">
              {usd(value)}
            </div>

            <div className="mt-5 border-t border-line">
              <KeyValue
                k={mode === "borrow" ? "To" : "From"}
                v={`${account.primaryWallet} · ${account.primaryChain}`}
              />
              <KeyValue k="Rate" v={`${account.apr}% APR variable`} />
              <KeyValue
                k={mode === "borrow" ? "New balance" : "Remaining balance"}
                v={usd(newBorrowed)}
              />
              <KeyValue k="Available after" v={usd(newAvailable)} />
              <KeyValue k="Network fee" v="Covered by BASIS" muted />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-neg/20 bg-neg/5 p-3 text-[13px] text-neg">
                {error}
              </div>
            )}

            <Button
              full
              className="mt-5"
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting
                ? "Submitting..."
                : mode === "borrow"
                  ? `Borrow ${usd(value, false)}`
                  : `Repay ${usd(value, false)}`}
            </Button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => set({ stage: "input" })}
              className="mt-3 w-full text-center text-[13px] font-medium text-ink-2 hover:text-ink"
            >
              Back
            </button>
          </>
        )}

        {stage === "done" && (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-soft text-blue">
              <CheckIcon size={20} />
            </div>
            <div className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink">
              {mode === "borrow" ? "Borrow submitted" : "Repayment submitted"}
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
              {usd(value)}{" "}
              {mode === "borrow"
                ? `is on its way to ${account.primaryWallet} on ${account.primaryChain}. Funds usually arrive within a minute.`
                : `has been applied to your balance. Your available credit updates once the payment settles.`}
            </p>
            <div className="mt-5 border-t border-line">
              <KeyValue k="Reference" v={actionRef.length > 20 ? `${actionRef.slice(0, 10)}…${actionRef.slice(-8)}` : actionRef} />
              <KeyValue k="Settlement" v={settlementProvider} muted />
            </div>
            <Button
              full
              variant="secondary"
              className="mt-5"
              onClick={() => set({ stage: "input", amount: "" })}
            >
              Done
            </Button>
          </>
        )}
      </section>

      <Divider />

      {/* ------------------------------------------------------ loan state */}
      <section className="px-6 py-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">Your loan</h3>
          <TextLink>Statements</TextLink>
        </div>
        <div className="mt-2">
          <KeyValue k="Principal" v={usd(account.borrowed)} />
          <KeyValue k="Interest accrued" v={usd(account.interestAccrued)} />
          <KeyValue
            k="Next payment"
            v={usd(account.nextPayment)}
            sub={`Due ${account.nextPaymentDate} · Auto-pay on`}
          />
        </div>
      </section>

      <Divider />

      {/* ---------------------------------------------------- verification */}
      <section className="px-6 py-6">
        <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">Verification</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
          Your cross-chain history is verified with Attestcoin before it counts as evidence.
        </p>

        <div className="mt-4 divide-y divide-line border-t border-line">
          {chains.map((c) => {
            const verified = c.status.startsWith("Verified");
            return (
              <div key={c.name} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-[13.5px] font-medium text-ink">{c.name}</div>
                  <div className="mt-0.5 text-[12px] text-ink-3">
                    {c.events} {c.events === 1 ? "event" : "events"} · {c.status}
                  </div>
                </div>
                {verified ? (
                  <CheckIcon size={16} className="text-ink-3" />
                ) : (
                  <TextLink>Verify</TextLink>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
          Credit is issued and settled on Creditcoin. Line opened {account.openedOn}.
        </p>
      </section>
    </div>
  );
}
