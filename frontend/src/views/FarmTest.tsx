import { useState } from "react";
import { runFarmTest, type FarmTestResultDto } from "../services/farmTest";
import { Button, SectionHeader, StatCell, Strength } from "../components/ui";
import { usd } from "../lib/data";

export function FarmTest() {
  const [selectedScenario, setSelectedScenario] = useState<"manufactured" | "genuine">("manufactured");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FarmTestResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runFarmTest(selectedScenario);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute Farm Test scenario.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8 lg:px-10">
      {/* --------------------------------------------------------- header */}
      <section className="border-b border-line pb-7 pt-8">
        <div>
          <div className="text-[13px] font-medium text-ink-2">Farm Test</div>
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
            Volume alone doesn’t raise a limit.
          </h2>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-ink-2">
            The Economic Evidence Engine deterministically separates genuine economic activity from
            manufactured wash volume. Run both scenarios to observe how the mathematics penalizes
            circular flows while rewarding capital independence.
          </p>
        </div>

        {/* scenario selector pills */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedScenario("manufactured")}
            className={
              "h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors " +
              (selectedScenario === "manufactured"
                ? "bg-ink text-white"
                : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink")
            }
          >
            Manufactured activity (Sybil)
          </button>
          <button
            type="button"
            onClick={() => setSelectedScenario("genuine")}
            className={
              "h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors " +
              (selectedScenario === "genuine"
                ? "bg-ink text-white"
                : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink")
            }
          >
            Genuine activity (Organic)
          </button>

          <Button onClick={handleRun} disabled={running} className="ml-auto">
            {running ? "Evaluating..." : "Run Farm Test"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-neg/20 bg-neg/5 p-4 text-[13.5px] text-neg">
            {error}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- results panel */}
      {result ? (
        <>
          <section className="border-b border-line py-8">
            <SectionHeader
              title={result.scenario.label}
              subtitle={result.scenario.narrative}
            />

            <div className="mt-6 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
              <StatCell
                label="Evidence score (S)"
                value={result.evidenceScore.toFixed(4)}
                note={`Strength: ${result.strength}`}
              />
              <div className="sm:border-l sm:border-line sm:pl-6">
                <StatCell
                  label="Credit increase"
                  value={result.creditIncrease?.display ?? usd(result.creditIncrease?.usd ?? 0)}
                  note={result.awarded ? "Extended to line" : "Blocked by guardrails"}
                />
              </div>
              <div className="sm:border-l sm:border-line sm:pl-6">
                <StatCell
                  label="Observed volume"
                  value={result.volume?.display ?? usd(result.volume?.usd ?? 0)}
                  note={`${result.activityCount} transactions`}
                />
              </div>
              <div className="sm:border-l sm:border-line sm:pl-6">
                <StatCell
                  label="Credit after"
                  value={result.creditAfter?.display ?? usd(result.creditAfter?.usd ?? 0)}
                  note={`Was ${result.creditBefore?.display ?? usd(result.creditBefore?.usd ?? 0)}`}
                />
              </div>
            </div>

            {/* dimensions breakdown */}
            <div className="mt-8 divide-y divide-line border-t border-line">
              <div className="flex items-center gap-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium text-ink">Capital Independence (C)</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ink-2">
                    {result.explanations?.capital}
                  </div>
                </div>
                <div className="num w-[90px] shrink-0 text-right text-[15px] font-semibold text-ink">
                  {result.capitalIndependence.toFixed(3)}
                </div>
                <div className="hidden w-[70px] shrink-0 justify-end md:flex">
                  <Strength value={Math.round(result.capitalIndependence * 4)} />
                </div>
              </div>

              <div className="flex items-center gap-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium text-ink">Economic Diversity (D)</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ink-2">
                    {result.explanations?.diversity}
                  </div>
                </div>
                <div className="num w-[90px] shrink-0 text-right text-[15px] font-semibold text-ink">
                  {result.economicDiversity.toFixed(3)}
                </div>
                <div className="hidden w-[70px] shrink-0 justify-end md:flex">
                  <Strength value={Math.round(result.economicDiversity * 4)} />
                </div>
              </div>

              <div className="flex items-center gap-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium text-ink">Behavioral Coherence (Q)</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ink-2">
                    {result.explanations?.coherence}
                  </div>
                </div>
                <div className="num w-[90px] shrink-0 text-right text-[15px] font-semibold text-ink">
                  {result.behavioralCoherence.toFixed(3)}
                </div>
                <div className="hidden w-[70px] shrink-0 justify-end md:flex">
                  <Strength value={Math.round(result.behavioralCoherence * 4)} />
                </div>
              </div>
            </div>

            {result.blockedBy && result.blockedBy.length > 0 && (
              <div className="mt-6 border-l-2 border-neg pl-4 text-[13px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">Guardrails enforced: </span>
                {result.blockedBy.join(", ").replace(/_/g, " ")}.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="py-12 text-center">
          <div className="text-[15px] font-medium text-ink">Ready to run</div>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            Select a scenario above and click &ldquo;Run Farm Test&rdquo; to execute the deterministic pipeline.
          </p>
        </section>
      )}

      {/* ---------------------------------------------------- educational footer */}
      <section className="py-8">
        <SectionHeader title="How the engine evaluates evidence" />
        <div className="mt-4 grid gap-8 sm:grid-cols-3">
          {[
            {
              t: "Capital independence (C^0.45)",
              d: "Detects shared upstream funding hubs. Moving money back and forth between wallets funded by the same origin yields zero independence.",
            },
            {
              t: "Economic diversity (D^0.30)",
              d: "Evaluates distinct protocols, counterparties and settlement types. Repeated swaps of the same pair add volume but zero evidence.",
            },
            {
              t: "Behavioral coherence (Q^0.25)",
              d: "Checks sequence logic, holding periods, and timing entropy. Metronomic loops (A → B → A) collapse the coherence dimension.",
            },
          ].map((c) => (
            <div key={c.t} className="border-t border-line pt-4">
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{c.t}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
