/**
 * Evidence and activity queries.
 *
 * The same `EconomicEvent` rows power Home recent activity, the Activity page,
 * the Evidence page, the Evidence detail drawer, the credit explanation and the
 * Farm Test. There is exactly one source of truth.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attestations,
  creditDecisions,
  economicEvents,
  evidenceEvaluations,
  evidenceFactors,
} from "@/db/schema";
import { notFound } from "@/lib/errors";
import {
  serializeActivity,
  serializeAttestation,
  serializeDecision,
  serializeEvaluation,
  serializeEvent,
  serializeFactor,
} from "./serializers";

export interface ActivityQuery {
  walletId: string;
  limit?: number;
  type?: string;
  chainKey?: string;
  verifiedOnly?: boolean;
}

export async function listActivity(query: ActivityQuery) {
  const conditions = [eq(economicEvents.walletId, query.walletId)];
  if (query.type) conditions.push(eq(economicEvents.type, query.type));
  if (query.chainKey) conditions.push(eq(economicEvents.chainKey, query.chainKey));
  if (query.verifiedOnly) conditions.push(eq(economicEvents.verified, true));

  const rows = await db
    .select()
    .from(economicEvents)
    .where(and(...conditions))
    .orderBy(desc(economicEvents.timestampMs), desc(economicEvents.sequence))
    .limit(Math.min(query.limit ?? 50, 200));

  return {
    items: serializeActivity(rows),
    total: rows.length,
  };
}

export async function listEventsForEvidence(walletId: string, limit = 100) {
  const rows = await db
    .select()
    .from(economicEvents)
    .where(eq(economicEvents.walletId, walletId))
    .orderBy(desc(economicEvents.timestampMs))
    .limit(limit);
  const attestationRows = rows.length
    ? await db.select().from(attestations).where(inArray(attestations.id, rows.map((r) => r.attestationId).filter((v): v is string => Boolean(v))))
    : [];
  const byId = new Map(attestationRows.map((a) => [a.id, a]));
  return rows.map((row) => serializeEvent(row, row.attestationId ? byId.get(row.attestationId) : null));
}

export async function getEventDetail(walletId: string, eventId: string) {
  const rows = await db
    .select()
    .from(economicEvents)
    .where(and(eq(economicEvents.id, eventId), eq(economicEvents.walletId, walletId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(`Economic event ${eventId} was not found for this wallet.`);

  const attestationRows = row.attestationId
    ? await db.select().from(attestations).where(eq(attestations.id, row.attestationId)).limit(1)
    : [];
  const evaluations = await db
    .select()
    .from(evidenceEvaluations)
    .where(eq(evidenceEvaluations.walletId, walletId))
    .orderBy(desc(evidenceEvaluations.createdAt))
    .limit(10);
  const contributing = evaluations.filter((e) => (e.contributingEventIds as string[]).includes(row.id));

  return {
    ...serializeEvent(row, attestationRows[0] ?? null),
    attestation: attestationRows[0] ? serializeAttestation(attestationRows[0]) : null,
    evaluations: contributing.map((e) => serializeEvaluation(e)),
  };
}

export async function listEvaluations(walletId: string, limit = 20) {
  const rows = await db
    .select()
    .from(evidenceEvaluations)
    .where(eq(evidenceEvaluations.walletId, walletId))
    .orderBy(desc(evidenceEvaluations.createdAt))
    .limit(limit);
  const factorRows = rows.length
    ? await db.select().from(evidenceFactors).where(inArray(evidenceFactors.evaluationId, rows.map((r) => r.id)))
    : [];
  const factorsByEvaluation = new Map<string, typeof factorRows>();
  for (const factor of factorRows) {
    const list = factorsByEvaluation.get(factor.evaluationId) ?? [];
    list.push(factor);
    factorsByEvaluation.set(factor.evaluationId, list);
  }
  return rows.map((row) => serializeEvaluation(row, factorsByEvaluation.get(row.id) ?? []));
}

export async function getEvaluation(walletId: string, evaluationId: string) {
  const rows = await db
    .select()
    .from(evidenceEvaluations)
    .where(and(eq(evidenceEvaluations.id, evaluationId), eq(evidenceEvaluations.walletId, walletId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(`Evaluation ${evaluationId} was not found for this wallet.`);

  const [factorRows, decisionRows, eventRows] = await Promise.all([
    db.select().from(evidenceFactors).where(eq(evidenceFactors.evaluationId, row.id)),
    db.select().from(creditDecisions).where(eq(creditDecisions.evaluationId, row.id)).limit(1),
    db
      .select()
      .from(economicEvents)
      .where(inArray(economicEvents.id, (row.contributingEventIds as string[]).length ? (row.contributingEventIds as string[]) : ["__none__"])),
  ]);

  return {
    evaluation: serializeEvaluation(row, factorRows.sort((a, b) => a.position - b.position).map((f) => f)),
    factors: factorRows.sort((a, b) => a.position - b.position).map(serializeFactor),
    decision: decisionRows[0] ? serializeDecision(decisionRows[0]) : null,
    contributingEvents: serializeActivity(eventRows),
  };
}

export async function getLatestEvaluation(walletId: string) {
  const rows = await db
    .select()
    .from(evidenceEvaluations)
    .where(eq(evidenceEvaluations.walletId, walletId))
    .orderBy(desc(evidenceEvaluations.createdAt))
    .limit(1);
  if (!rows[0]) return null;
  const factorRows = await db.select().from(evidenceFactors).where(eq(evidenceFactors.evaluationId, rows[0].id));
  return serializeEvaluation(rows[0], factorRows.sort((a, b) => a.position - b.position));
}
