import { z } from "zod";
import { describeProviders } from "@/providers";
import { serverInfo, creditConfig, evidenceExponents } from "@/lib/config";
import { DEMO_SCENARIO_LIST, FARM_SCENARIO_KEYS, FARM_SCENARIO_MAP, materializeScenario } from "@/providers/demo/fixtures";
import { ok, route } from "@/lib/http";
import { money } from "@/services/serializers";

export const dynamic = "force-dynamic";

const querySchema = z.object({ includeProviders: z.enum(["true", "false"]).optional() });

/**
 * Everything the frontend needs to know about the environment it is talking to:
 * demo vs live, the credit configuration, the evidence formula, the supported
 * networks, and the demo scenarios available in the demo switcher.
 */
export const GET = route({ auth: "none", rateLimit: "read" }, async ({ url }) => {
  const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const providers = query.includeProviders === "false" ? null : await describeProviders();

  return ok({
    appMode: serverInfo.appMode,
    isDemo: serverInfo.appMode === "demo",
    environmentLabel: serverInfo.appMode === "demo" ? "Demo" : "Live / Testnet",
    versions: {
      evidenceEngine: serverInfo.evidenceEngineVersion,
      creditEngine: serverInfo.creditEngineVersion,
    },
    credit: {
      maxBatchIncrease: money(creditConfig.maxBatchIncreaseUsdCents),
      absoluteCap: money(creditConfig.absoluteLimitCapUsdCents),
      minEvidenceThreshold: creditConfig.minEvidenceThreshold,
      evaluationCooldownMs: creditConfig.evaluationCooldownMs,
      minEventsForCredit: creditConfig.minEventsForCredit,
      staleEventMaxAgeDays: Math.round(creditConfig.staleEventMaxAgeMs / 86_400_000),
    },
    evidence: {
      formula: "S = C^0.45 x D^0.30 x Q^0.25",
      exponents: evidenceExponents,
      dimensions: [
        { key: "capitalIndependence", label: "Capital Independence", exponent: evidenceExponents.capitalIndependence },
        { key: "economicDiversity", label: "Economic Diversity", exponent: evidenceExponents.economicDiversity },
        { key: "behavioralCoherence", label: "Behavioral Coherence", exponent: evidenceExponents.behavioralCoherence },
      ],
    },
    networks: providers?.chains ?? [],
    providers: providers
      ? {
          chainData: providers.chainData,
          attestation: providers.attestation,
          credit: providers.credit,
          signer: providers.signer,
        }
      : null,
    demo: {
      available: true,
      scenarios: DEMO_SCENARIO_LIST.map((fixture) => {
        const materialized = materializeScenario(fixture.key);
        return {
          key: fixture.key,
          label: fixture.label,
          description: fixture.description,
          narrative: fixture.narrative,
          expectation: fixture.expectation,
          address: materialized.address,
          walletId: materialized.walletId,
          chainKeys: fixture.chainKeys,
          activityCount: materialized.events.length,
          volume: money(materialized.volumeUsdCents),
        };
      }),
    },
    farmTest: {
      scenarios: FARM_SCENARIO_KEYS.map((key) => ({ key, fixtureKey: FARM_SCENARIO_MAP[key] })),
    },
    attestcoin: serverInfo.attestcoin,
    creditcoin: serverInfo.creditcoin,
  });
});
