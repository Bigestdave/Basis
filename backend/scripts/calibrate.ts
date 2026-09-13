/**
 * Calibration harness for the Economic Evidence Engine.
 *
 * Run with:  npx tsx scripts/calibrate.ts
 *
 * Prints, for every demo scenario, the three dimensions, the combined score
 * S = C^0.45 x D^0.30 x Q^0.25 and the credit increase the real credit engine
 * derives from it. Used to tune seeded inputs / weights so the "strong history"
 * scenario lands near the intended ~$4,200 through the actual formula instead of
 * a hardcoded number.
 */
import { creditConfig } from "../src/lib/config";
import { evaluateEvidence } from "../src/domain/evidence/engine";
import { decideCredit } from "../src/domain/credit/engine";
import { materializeScenario, DEMO_SCENARIO_KEYS } from "../src/providers/demo/fixtures";
import { centsToUsd } from "../src/lib/money";

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

function main() {
  console.log(`MAX_BATCH_INCREASE = $${centsToUsd(creditConfig.maxBatchIncreaseUsdCents)}`);
  console.log(`MIN_EVIDENCE_THRESHOLD = ${creditConfig.minEvidenceThreshold}`);
  console.log("");
  for (const key of DEMO_SCENARIO_KEYS) {
    const scenario = materializeScenario(key);
    const result = evaluateEvidence({
      walletId: scenario.walletId,
      walletAddress: scenario.address,
      events: scenario.events,
      now: NOW,
    });
    const decision = decideCredit({
      evidenceScore: result.evidenceScore,
      currentLimitUsdCents: scenario.fixture.startingCreditLimitUsdCents,
      borrowedUsdCents: scenario.fixture.startingBorrowedUsdCents,
      eventCount: result.eventCount,
      verifiedEventCount: result.verifiedEventCount,
      lastCreditedEvaluationAt: null,
      now: NOW,
      evidenceHashAlreadyCredited: false,
      newEventCount: result.eventCount,
      staleEventCount: 0,
    });
    console.log(`── ${key}`);
    console.log(`   events=${result.eventCount} verified=${result.verifiedEventCount} volume=$${centsToUsd(result.volumeUsdCents)}`);
    console.log(`   C=${result.capitalIndependence.toFixed(4)}  D=${result.economicDiversity.toFixed(4)}  Q=${result.behavioralCoherence.toFixed(4)}`);
    console.log(`   S=${result.evidenceScore.toFixed(4)}  strength=${result.strength}`);
    console.log(
      `   credit: before=$${centsToUsd(decision.previousLimitUsdCents)} +$${centsToUsd(decision.creditIncreaseUsdCents)} = $${centsToUsd(decision.newLimitUsdCents)}  awarded=${decision.awarded}`,
    );
    if (decision.blockedBy.length) console.log(`   blockedBy=${decision.blockedBy.join(",")}`);
    console.log(`   C: ${result.dimensions.capitalIndependence.explanation}`);
    console.log(`   D: ${result.dimensions.economicDiversity.explanation}`);
    console.log(`   Q: ${result.dimensions.behavioralCoherence.explanation}`);
    console.log("");
  }
}

main();
