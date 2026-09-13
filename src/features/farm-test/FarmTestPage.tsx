import { useMemo, useState } from "react";
import { ArrowRight, Check, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useStore } from "../../store/store";
import { farmTestService } from "../../services";
import { Badge, Button, Card, IconTile, PageHeader, ProgressBar } from "../../components/ui";
import { usd } from "../../lib/format";
import type { FarmTestScenario } from "../../types";

function ScenarioCard({
  scenario,
  active,
  onSelect,
}: {
  scenario: FarmTestScenario;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-[14px] border p-5 text-left transition-all duration-150 ${
        active ? "border-brand bg-[#f7faff] ring-1 ring-brand-ring" : "border-line bg-white hover:border-[#d8e1f0]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">
          Scenario {scenario.id === "manufactured" ? "1" : "2"}
        </p>
        {active && <Badge tone="brand">Selected</Badge>}
      </div>
      <p className="mt-2 text-[17px] font-semibold tracking-[-0.015em] text-ink">{scenario.name}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{scenario.description}</p>
    </button>
  );
}

export function FarmTestPage() {
  const { navigate } = useStore();
  const scenarios = farmTestService.scenarios();
  const [scenarioId, setScenarioId] = useState<FarmTestScenario["id"]>("manufactured");
  const [count, setCount] = useState(0);

  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const added = scenario.transactions.slice(0, count);
  const complete = count === scenario.transactions.length;

  const totals = useMemo(() => {
    const evidence = added.reduce((a, t) => a + t.evidenceGain, 0);
    const credit = added.reduce((a, t) => a + t.creditGain, 0);
    return { evidence, credit };
  }, [added]);

  const other = scenarios.find((s) => s.id !== scenarioId)!;
  const otherCredit = other.transactions.reduce((a, t) => a + t.creditGain, 0);
  const maxCredit = Math.max(
    scenarios[0].transactions.reduce((a, t) => a + t.creditGain, 0),
    scenarios[1].transactions.reduce((a, t) => a + t.creditGain, 0),
  );

  const switchScenario = (id: FarmTestScenario["id"]) => {
    setScenarioId(id);
    setCount(0);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <PageHeader
          title="Try to farm your credit"
          subtitle="Creating more transactions is not the same as creating economic evidence. Test both and compare."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              active={s.id === scenarioId}
              onSelect={() => switchScenario(s.id)}
            />
          ))}
        </div>

        <Card className="mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{scenario.name}</h3>
              <p className="mt-0.5 text-[13px] text-muted">
                {count} of {scenario.transactions.length} transactions created
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={14} />}
                onClick={() => setCount(0)}
                disabled={count === 0}
              >
                Reset
              </Button>
              <Button
                size="sm"
                icon={<Plus size={14} />}
                disabled={complete}
                onClick={() => setCount((c) => Math.min(scenario.transactions.length, c + 1))}
              >
                {scenarioId === "manufactured" ? "Create transaction" : "Add economic event"}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] border-b border-line pb-3 text-[13px] text-muted">
            <div>Event</div>
            <div>Flow</div>
            <div>Amount</div>
            <div>Credit impact</div>
          </div>

          {added.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-medium text-ink">No transactions yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
                {scenarioId === "manufactured"
                  ? "Start moving funds between two addresses you control and watch what BASIS counts."
                  : "Build a natural economic sequence: funding, swap, deposit, borrow, repayment."}
              </p>
            </div>
          ) : (
            added.map((t) => (
              <div
                key={t.id}
                className="animate-fade-up grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center border-b border-line-soft py-3.5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                      scenarioId === "manufactured" ? "bg-soft text-muted" : "bg-brand-soft text-brand"
                    }`}
                  >
                    {t.id}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{t.label}</p>
                    <p className="truncate text-[12.5px] text-muted">{t.note}</p>
                  </div>
                </div>
                <div className="font-mono text-[12.5px] text-muted">
                  {t.from} → {t.to}
                </div>
                <div className="text-[13.5px] text-ink tnum">
                  {t.amount} {t.asset}
                </div>
                <div
                  className={`text-[13.5px] font-medium tnum ${
                    t.creditGain === 0 ? "text-muted" : t.creditGain < 100 ? "text-warn" : "text-pos"
                  }`}
                >
                  {t.creditGain === 0 ? "No change" : `+${usd(t.creditGain)}`}
                </div>
              </div>
            ))
          )}

          {complete && (
            <div
              className={`animate-fade-up mt-6 rounded-[14px] border p-5 ${
                scenario.evidenceStrength === "Weak" ? "border-[#f3dfc0] bg-[#fffaf1]" : "border-[#cdedd9] bg-[#f4fcf7]"
              }`}
            >
              <div className="flex items-start gap-3">
                <IconTile size={38} tone={scenario.evidenceStrength === "Weak" ? "warning" : "positive"}>
                  {scenario.evidenceStrength === "Weak" ? <TriangleAlert size={17} /> : <Check size={17} />}
                </IconTile>
                <div>
                  <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{scenario.verdictTitle}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{scenario.verdictBody}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {scenario.signals.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 rounded-[10px] bg-white/70 px-3 py-2">
                    <span
                      className={`grid h-[18px] w-[18px] place-items-center rounded-full ${
                        s.state === "bad" ? "bg-neg-soft text-neg" : "bg-pos-soft text-[#067647]"
                      }`}
                    >
                      {s.state === "bad" ? <X size={11} strokeWidth={3} /> : <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="text-[13px] text-ink">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Live result</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[12.5px] text-muted">Transactions</p>
              <p className="mt-1 text-[26px] font-bold leading-none text-ink tnum">{count}</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted">Credit increase</p>
              <p
                className={`mt-1 text-[26px] font-bold leading-none tnum ${
                  totals.credit > 1500 ? "text-pos" : "text-ink"
                }`}
              >
                +{usd(totals.credit)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="text-muted">Evidence strength</span>
              <span className="font-medium text-ink">
                {totals.evidence === 0
                  ? "None"
                  : totals.evidence < 200
                    ? "Weak"
                    : totals.evidence < 700
                      ? "Moderate"
                      : "Strong"}
              </span>
            </div>
            <ProgressBar value={Math.min(100, (totals.evidence / 1500) * 100)} />
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[13px] font-medium text-ink">Credit gained per scenario</p>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span className="text-muted">{scenario.name} (this run)</span>
                  <span className="font-medium text-ink tnum">+{usd(totals.credit)}</span>
                </div>
                <ProgressBar value={(totals.credit / maxCredit) * 100} height={6} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span className="text-muted">{other.name} (full run)</span>
                  <span className="font-medium text-muted tnum">+{usd(otherCredit)}</span>
                </div>
                <ProgressBar value={(otherCredit / maxCredit) * 100} height={6} className="opacity-45" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Why this happens</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            BASIS attests each economic event once and evaluates the relationships between them. Value that circulates
            between the same two addresses adds transactions but no new economic information.
          </p>
          <div className="mt-4 space-y-2.5">
            {[
              "Funding independence",
              "Counterparty uniqueness",
              "Protocol diversity",
              "Repayment completion",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-brand-soft text-brand">
                  <Check size={11} strokeWidth={3} />
                </span>
                {t}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            full
            className="mt-5"
            iconRight={<ArrowRight size={14} />}
            onClick={() => navigate("evidence")}
          >
            See real evidence
          </Button>
        </Card>

        <p className="px-1 text-[12px] leading-relaxed text-faint">
          Farm test uses a deterministic demo model. Real evaluation runs against attested on-chain data.
        </p>
      </div>
    </div>
  );
}
