import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useStore } from "../../store/store";
import { buildCreditService } from "../../services";
import { Badge, Button, Card, IconTile, ProgressBar } from "../../components/ui";
import { NetworkIcon } from "../../components/ui/icons";
import { usd } from "../../lib/format";
import type { BuildCreditPhase, VerificationStep } from "../../types";

const PHASE_COPY: Record<string, { title: string; body: string }> = {
  analyzing: { title: "Analyzing economic history", body: "Reading activity from your selected networks." },
  verifying: { title: "Verifying economic history", body: "Each event is independently attested before it counts." },
  evaluating: { title: "Evaluating economic evidence", body: "Scoring independence, diversity and coherence." },
};

export function BuildCreditPage() {
  const { credit, wallet, networks, navigate, runDecision, applyDecision, pushToast } = useStore();
  const [phase, setPhase] = useState<BuildCreditPhase>("idle");
  const [steps, setSteps] = useState<VerificationStep[]>(buildCreditService.steps());
  const [selected, setSelected] = useState<string[]>(["ethereum", "base", "creditcoin"]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const toggleNetwork = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));

  const start = useCallback(() => {
    if (!selected.length) {
      pushToast("error", "Select at least one network", "BASIS needs a network to read verified activity from.");
      return;
    }
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setSteps(buildCreditService.steps());
    setPhase("analyzing");

    schedule(() => {
      setPhase("verifying");
      steps.forEach((_, i) => {
        schedule(() => {
          setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: "running" } : s)));
        }, i * 620);
        schedule(() => {
          setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: "done" } : s)));
        }, i * 620 + 480);
      });
      schedule(
        () => {
          setPhase("evaluating");
          schedule(async () => {
            const d = await runDecision();
            applyDecision(d);
            setPhase("result");
            schedule(() => navigate("credit-result"), 700);
          }, 900);
        },
        steps.length * 620 + 200,
      );
    }, 1200);
  }, [selected, steps, runDecision, applyDecision, navigate, pushToast]);

  const running = phase === "analyzing" || phase === "verifying" || phase === "evaluating" || phase === "result";
  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress =
    phase === "analyzing"
      ? 12
      : phase === "verifying"
        ? 12 + (doneCount / steps.length) * 70
        : phase === "evaluating"
          ? 90
          : phase === "result"
            ? 100
            : 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <button
          onClick={() => navigate("credit")}
          className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.028em] text-ink">Build my credit</h1>
        <p className="mb-6 mt-2 text-[14px] text-muted">
          BASIS analyzes your verified economic history and turns it into credit. Nothing is shared without your
          approval.
        </p>

        {!running ? (
          <Card className="p-6">
            {/* step 1 */}
            <div className="flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                1
              </span>
              <h3 className="text-[16px] font-semibold text-ink">Select wallet</h3>
            </div>
            <div className="mt-4 lg:pl-9">
              <div className="flex items-center gap-3 rounded-[12px] border border-brand bg-[#f7faff] p-4 ring-1 ring-brand-ring">
                <IconTile size={38}>
                  <Wallet size={17} />
                </IconTile>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-ink">{wallet?.label}</p>
                  <p className="font-mono text-[12.5px] text-muted">{wallet?.shortAddress}</p>
                </div>
                <Badge tone="positive">Connected</Badge>
              </div>
              <button
                onClick={() => navigate("connect-wallet")}
                className="mt-2 text-[13px] font-medium text-brand hover:underline"
              >
                Use a different wallet
              </button>
            </div>

            {/* step 2 */}
            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                  2
                </span>
                <h3 className="text-[16px] font-semibold text-ink">Select networks</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:pl-9">
                {networks.slice(0, 4).map((n) => {
                  const active = selected.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggleNetwork(n.id)}
                      className={`flex items-center gap-3 rounded-[12px] border p-3.5 text-left transition-all duration-150 ${
                        active ? "border-brand bg-[#f7faff]" : "border-line hover:border-[#d8e1f0]"
                      }`}
                    >
                      <NetworkIcon id={n.id} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">{n.name}</p>
                        <p className="truncate text-[12.5px] text-muted">
                          {n.status === "connected" ? "Connected" : "Not connected"}
                        </p>
                      </div>
                      <span
                        className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border ${
                          active ? "border-brand bg-brand text-white" : "border-[#d3d9e3]"
                        }`}
                      >
                        {active && <Check size={11} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!selected.length && (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-neg lg:pl-9">
                  <TriangleAlert size={13} /> Select at least one network to continue.
                </p>
              )}
            </div>

            {/* step 3 */}
            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                  3
                </span>
                <h3 className="text-[16px] font-semibold text-ink">Analyze economic history</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted lg:pl-9">
                BASIS reads public on-chain activity from the selected networks, verifies each event with Attestcoin, and
                evaluates the strength of your economic evidence.
              </p>
              <Button full size="lg" className="mt-5" iconRight={<ArrowRight size={16} />} onClick={start}>
                Analyze economic history
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <IconTile size={40} tone={phase === "result" ? "positive" : "brand"}>
                {phase === "result" ? <CircleCheck size={18} /> : <Loader2 size={18} className="animate-spin" />}
              </IconTile>
              <div className="flex-1">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">
                  {phase === "result" ? "Verification complete" : "In progress"}
                </p>
                <h3 className="mt-0.5 text-[18px] font-semibold tracking-[-0.015em] text-ink">
                  {phase === "result" ? "Economic evidence found" : PHASE_COPY[phase]?.title}
                </h3>
                <p className="mt-1 text-[13.5px] text-muted">
                  {phase === "result" ? "8 verified events · 3 independent funding sources" : PHASE_COPY[phase]?.body}
                </p>
              </div>
            </div>

            <ProgressBar value={progress} className="mt-5" />

            <div className="mt-6 space-y-1">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-200 ${
                    s.state === "running" ? "bg-subtle" : ""
                  }`}
                >
                  <span
                    className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-colors duration-200 ${
                      s.state === "done"
                        ? "bg-pos-soft text-[#067647]"
                        : s.state === "running"
                          ? "bg-brand-soft text-brand"
                          : "bg-soft text-[#c1c8d4]"
                    }`}
                  >
                    {s.state === "done" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : s.state === "running" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={`flex-1 text-[14px] ${
                      s.state === "pending" ? "text-faint" : "font-medium text-ink"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="text-[12.5px] text-muted">{s.state === "pending" ? "" : s.detail}</span>
                </div>
              ))}
            </div>

            {phase === "result" ? (
              <Button full size="lg" className="mt-6" iconRight={<ArrowRight size={16} />} onClick={() => navigate("credit-result")}>
                View credit decision
              </Button>
            ) : (
              <div className="mt-6 flex items-center justify-between rounded-[12px] bg-subtle px-4 py-3">
                <p className="text-[12.5px] text-muted">
                  Verification runs asynchronously. You can leave this page — we'll notify you when it completes.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw size={13} />}
                  onClick={() => {
                    timers.current.forEach((t) => window.clearTimeout(t));
                    timers.current = [];
                    setSteps(buildCreditService.steps());
                    setPhase("idle");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Current credit</h3>
          <p className="mt-3 text-[30px] font-bold leading-none tracking-[-0.03em] text-ink tnum">
            {usd(credit?.limit ?? 0)}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">Credit limit before this analysis</p>
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-muted">Available</span>
              <span className="text-[13.5px] font-medium text-ink tnum">{usd(credit?.available ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-muted">Borrowed</span>
              <span className="text-[13.5px] font-medium text-ink tnum">{usd(credit?.borrowed ?? 0)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <ShieldCheck size={17} />
            </IconTile>
            <div>
              <p className="text-[14.5px] font-semibold text-ink">What BASIS looks for</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Credit comes from economic evidence, not transaction volume.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {[
              "Independent funding sources",
              "Unique counterparties",
              "Multiple protocols and chains",
              "Completed repayment cycles",
              "Coherent transaction ordering",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-brand-soft text-brand">
                  <Check size={11} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-subtle p-5">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <Layers size={17} />
            </IconTile>
            <div>
              <p className="text-[14px] font-semibold text-ink">Can you farm credit?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Try creating activity instead of evidence and see what happens.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("farm-test")}>
                Open farm test
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
