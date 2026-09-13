import { useEffect, useState } from "react";
import { buildCredit, pollJob, type JobSnapshot } from "../services/evidence";
import { CheckIcon, CloseIcon } from "./Icons";
import { Button } from "./ui";

const STAGES = [
  { key: "SYNC_WALLET", label: "Syncing wallet" },
  { key: "FETCH_TRANSACTIONS", label: "Fetching chain transactions" },
  { key: "BUILD_PROOFS", label: "Building cryptographic proofs" },
  { key: "ATTEST_EVENTS", label: "Attestcoin BlockProver verification" },
  { key: "NORMALIZE_EVENTS", label: "Normalizing economic events" },
  { key: "BUILD_EVIDENCE", label: "Constructing economic graph" },
  { key: "EVALUATE", label: "Evaluating C, D, Q evidence dimensions" },
  { key: "CREDIT_DECISION", label: "Generating credit decision" },
  { key: "CREDIT_UPDATE", label: "Updating credit account" },
];

export function BuildCreditModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout;

    async function start() {
      try {
        const initial = await buildCredit();
        if (!active) return;
        setJob(initial.job);

        const poll = async () => {
          if (!active) return;
          try {
            const updated = await pollJob(initial.job.id);
            if (!active) return;
            setJob(updated.job);
            if (updated.job.status === "COMPLETED") {
              onComplete();
            } else if (updated.job.status === "FAILED") {
              setError(updated.job.error ?? "Pipeline failed.");
            } else {
              timer = setTimeout(poll, 750);
            }
          } catch {
            if (active) timer = setTimeout(poll, 1500);
          }
        };

        timer = setTimeout(poll, 500);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to start Build Credit job.");
        }
      }
    }

    start();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const progress = job?.progress ?? (job?.status === "COMPLETED" ? 100 : 15);
  const isDone = job?.status === "COMPLETED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[520px] rounded-2xl border border-line bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {isDone ? "Credit evaluation complete" : "Building your credit"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
          {isDone
            ? "Your verified economic evidence was evaluated through the Economic Evidence Engine. Your credit limit has been updated."
            : "Cross-chain transactions are being verified with Attestcoin and underwritten by the Economic Evidence Engine."}
        </p>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-blue transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-ink-3">
            <span>{job?.currentStep?.replace(/_/g, " ") ?? (isDone ? "Complete" : "Initializing...")}</span>
            <span className="num font-medium text-ink">{progress}%</span>
          </div>
        </div>

        {/* Stages list */}
        <div className="mt-6 divide-y divide-line border-t border-line">
          {STAGES.map((s, index) => {
            const stepRecord = job?.steps?.find((st) => st.step === s.key);
            const completed =
              isDone ||
              stepRecord?.status === "completed" ||
              progress > ((index + 1) / STAGES.length) * 100;
            const current = job?.currentStep === s.key;

            return (
              <div key={s.key} className="flex items-center justify-between py-2.5">
                <span
                  className={
                    "text-[13.5px] " +
                    (completed
                      ? "font-medium text-ink"
                      : current
                        ? "font-medium text-blue"
                        : "text-ink-3")
                  }
                >
                  {s.label}
                </span>
                {completed ? (
                  <CheckIcon size={16} className="text-pos" />
                ) : current ? (
                  <span className="relative flex h-2 w-2">
                    <span className="h-2 w-2 animate-ping rounded-full bg-blue opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue" />
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-2" />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-neg/20 bg-neg/5 p-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
          {isDone ? (
            <Button full onClick={onClose}>
              View updated credit line
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Run in background
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
