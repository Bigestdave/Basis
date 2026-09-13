/**
 * Economic graph.
 *
 * Turns a flat list of verified `EconomicEvent`s into the structure the evidence
 * engine reasons about: who funded the wallet, which clusters those funders
 * belong to, which counterparties were touched, and where value flowed in a
 * circle (A -> B -> A).
 *
 * Pure and deterministic: same events in => same graph out.
 */
import { canonicalHash, normalizeAddress, sha256Hex } from "@/lib/deterministic";
import { sum } from "@/lib/money";
import type { EconomicEvent } from "@/domain/types";

export type NodeKind = "subject" | "funder" | "counterparty" | "protocol" | "external";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  cluster: string;
  inflowUsdCents: number;
  outflowUsdCents: number;
  eventCount: number;
  eventIds: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: "funded" | "transferred" | "received" | "protocol-call";
  weightUsdCents: number;
  count: number;
  eventIds: string[];
}

export interface FundingSource {
  address: string;
  cluster: string;
  inflowUsdCents: number;
  share: number;
  depth: number;
  eventCount: number;
  /** True when this source also received value back from the subject. */
  reciprocated: boolean;
}

export interface Counterparty {
  address: string;
  cluster: string;
  isProtocol: boolean;
  protocol: string | null;
  outflowUsdCents: number;
  inflowUsdCents: number;
  eventCount: number;
  types: string[];
}

export interface CycleInfo {
  id: string;
  counterparty: string;
  cluster: string;
  outflowUsdCents: number;
  inflowUsdCents: number;
  /** Value trapped in the round trip (2 x min(in, out)). */
  cyclicUsdCents: number;
  eventIds: string[];
  minGapMs: number;
}

export interface EvidenceGraph {
  subject: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  fundingSources: FundingSource[];
  counterparties: Counterparty[];
  cycles: CycleInfo[];
  clusters: string[];
  assets: string[];
  protocols: string[];
  inflowUsdCents: number;
  outflowUsdCents: number;
  transferValueUsdCents: number;
  cyclicValueUsdCents: number;
  cycleRatio: number;
  /** Fraction of inflow that came from the subject's own cluster. */
  selfFundingShare: number;
  /** Fraction of inflow that came back out to the same address (round trips). */
  circularFundingShare: number;
  /** Weighted average funding depth (1 = direct from origin). */
  averageFundingDepth: number;
  timeline: EconomicEvent[];
  interEventGapsMs: number[];
}

const SUBJECT_CLUSTER = "self";

/** Event types whose inbound value counts as funding for Capital Independence. */
export const FUNDING_INFLOW_TYPES = new Set<EconomicEvent["type"]>(["FUNDING", "TRANSFER", "PAYMENT"]);

function clusterOf(event: EconomicEvent, address: string): string {
  const fromCluster = event.metadata.fundingSourceCluster;
  if (event.metadata.fundingSource && normalizeAddress(event.metadata.fundingSource) === address) {
    return fromCluster ? String(fromCluster) : address;
  }
  return fromCluster ? String(fromCluster) : address;
}

export function buildEvidenceGraph(walletAddress: string, events: readonly EconomicEvent[]): EvidenceGraph {
  const subject = normalizeAddress(walletAddress);
  const timeline = [...events].sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);

  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();
  const upsertNode = (id: string, kind: NodeKind, cluster: string): GraphNode => {
    const existing = nodeMap.get(id);
    if (existing) return existing;
    const created: GraphNode = {
      id,
      kind,
      cluster,
      inflowUsdCents: 0,
      outflowUsdCents: 0,
      eventCount: 0,
      eventIds: [],
    };
    nodeMap.set(id, created);
    return created;
  };
  const upsertEdge = (from: string, to: string, kind: GraphEdge["kind"]): GraphEdge => {
    const key = `${from}->${to}:${kind}`;
    const existing = edgeMap.get(key);
    if (existing) return existing;
    const created: GraphEdge = { from, to, kind, weightUsdCents: 0, count: 0, eventIds: [] };
    edgeMap.set(key, created);
    return created;
  };

  upsertNode(subject, "subject", SUBJECT_CLUSTER);

  const fundingByAddress = new Map<string, FundingSource>();
  const counterpartyByAddress = new Map<string, Counterparty>();
  const transferFlowByAddress = new Map<
    string,
    { inflow: number; outflow: number; eventIds: string[]; timestamps: number[] }
  >();
  const protocols = new Set<string>();
  const assets = new Set<string>();

  let inflowUsdCents = 0;
  let outflowUsdCents = 0;
  let transferValueUsdCents = 0;
  let selfFundedCents = 0;

  for (const event of timeline) {
    const from = normalizeAddress(event.from);
    const to = normalizeAddress(event.to);
    assets.add(event.asset);
    if (event.protocol) protocols.add(event.protocol);

    const isInflow = to === subject && from !== subject;
    const isOutflow = from === subject && to !== subject;
    if (isInflow) inflowUsdCents += event.amountUsdCents;
    if (isOutflow) outflowUsdCents += event.amountUsdCents;
    if (event.type === "TRANSFER" || event.type === "PAYMENT") {
      transferValueUsdCents += event.amountUsdCents;
      const cp = isInflow ? from : isOutflow ? to : null;
      if (cp) {
        const flow = transferFlowByAddress.get(cp) ?? { inflow: 0, outflow: 0, eventIds: [], timestamps: [] };
        if (isInflow) flow.inflow += event.amountUsdCents;
        if (isOutflow) flow.outflow += event.amountUsdCents;
        flow.eventIds.push(event.id);
        flow.timestamps.push(event.timestamp);
        transferFlowByAddress.set(cp, flow);
      }
    }

    if (event.protocol) {
      const protocolNode = upsertNode(`protocol:${event.protocol}`, "protocol", `protocol:${event.protocol}`);
      protocolNode.eventCount += 1;
      protocolNode.eventIds.push(event.id);
      const edge = upsertEdge(subject, `protocol:${event.protocol}`, "protocol-call");
      edge.count += 1;
      edge.weightUsdCents += event.amountUsdCents;
      edge.eventIds.push(event.id);
    }

    // Funding sources: value arriving from outside the wallet.
    //
    // This deliberately includes plain inbound TRANSFER/PAYMENT value, not just
    // events labelled FUNDING — capital that arrives as a transfer is still
    // capital. It deliberately EXCLUDES protocol inflows (BORROW, REWARD,
    // WITHDRAW): borrowed money is leverage, not independent capital, and
    // counting it would let a wallet buy evidence with debt.
    if (isInflow && !event.protocol && FUNDING_INFLOW_TYPES.has(event.type)) {
      const address = normalizeAddress(event.metadata.fundingSource ? String(event.metadata.fundingSource) : from);
      const cluster = clusterOf(event, address);
      const depth = Number(event.metadata.fundingDepth ?? 1) || 1;
      const node = upsertNode(address, "funder", cluster);
      node.inflowUsdCents += event.amountUsdCents;
      node.eventCount += 1;
      node.eventIds.push(event.id);
      const edge = upsertEdge(address, subject, "funded");
      edge.count += 1;
      edge.weightUsdCents += event.amountUsdCents;
      edge.eventIds.push(event.id);

      const existing = fundingByAddress.get(address);
      if (existing) {
        existing.inflowUsdCents += event.amountUsdCents;
        existing.eventCount += 1;
        existing.depth = Math.max(existing.depth, depth);
      } else {
        fundingByAddress.set(address, {
          address,
          cluster,
          inflowUsdCents: event.amountUsdCents,
          share: 0,
          depth,
          eventCount: 1,
          reciprocated: false,
        });
      }
      if (cluster === SUBJECT_CLUSTER || Boolean(event.metadata.internalCounterparty)) {
        selfFundedCents += event.amountUsdCents;
      }
    }

    // Counterparties: anyone the wallet interacted with that is not itself.
    const counterpartyAddress = isOutflow ? to : isInflow ? from : null;
    if (counterpartyAddress) {
      const cluster = clusterOf(event, counterpartyAddress);
      const node = upsertNode(counterpartyAddress, event.protocol ? "protocol" : "counterparty", cluster);
      node.eventCount += 1;
      node.eventIds.push(event.id);
      if (isOutflow) node.outflowUsdCents += event.amountUsdCents;
      if (isInflow) node.inflowUsdCents += event.amountUsdCents;

      const edge = upsertEdge(
        isOutflow ? subject : counterpartyAddress,
        isOutflow ? counterpartyAddress : subject,
        isOutflow ? "transferred" : "received",
      );
      edge.count += 1;
      edge.weightUsdCents += event.amountUsdCents;
      edge.eventIds.push(event.id);

      const existing = counterpartyByAddress.get(counterpartyAddress);
      if (existing) {
        if (isOutflow) existing.outflowUsdCents += event.amountUsdCents;
        else existing.inflowUsdCents += event.amountUsdCents;
        existing.eventCount += 1;
        if (!existing.types.includes(event.type)) existing.types.push(event.type);
      } else {
        counterpartyByAddress.set(counterpartyAddress, {
          address: counterpartyAddress,
          cluster,
          isProtocol: Boolean(event.protocol),
          protocol: event.protocol,
          outflowUsdCents: isOutflow ? event.amountUsdCents : 0,
          inflowUsdCents: isInflow ? event.amountUsdCents : 0,
          eventCount: 1,
          types: [event.type],
        });
      }
    }
  }

  // ---- Funding source shares + reciprocity ---------------------------------
  const fundingSources = [...fundingByAddress.values()].sort(
    (a, b) => b.inflowUsdCents - a.inflowUsdCents || a.address.localeCompare(b.address),
  );
  for (const source of fundingSources) {
    source.share = inflowUsdCents > 0 ? source.inflowUsdCents / inflowUsdCents : 0;
    const cp = counterpartyByAddress.get(source.address);
    source.reciprocated = Boolean(cp && cp.outflowUsdCents > 0);
  }
  const circularFundingCents = sum(
    fundingSources.filter((s) => s.reciprocated).map((s) => s.inflowUsdCents),
  );

  // ---- Cycle detection (A -> B -> A) ---------------------------------------
  // Only plain value transfers/payments can be round trips. A DeFi deposit and a
  // borrow against it with the same protocol is a credit cycle, not wash trading,
  // so protocol interactions are deliberately excluded here.
  const cycles: CycleInfo[] = [];
  for (const [address, flow] of transferFlowByAddress.entries()) {
    if (flow.inflow > 0 && flow.outflow > 0) {
      const cluster =
        counterpartyByAddress.get(address)?.cluster ??
        fundingByAddress.get(address)?.cluster ??
        address;
      const sorted = [...flow.timestamps].sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
      cycles.push({
        id: `cyc_${sha256Hex(`${subject}|${address}`).slice(0, 16)}`,
        counterparty: address,
        cluster,
        outflowUsdCents: flow.outflow,
        inflowUsdCents: flow.inflow,
        cyclicUsdCents: 2 * Math.min(flow.outflow, flow.inflow),
        eventIds: flow.eventIds,
        minGapMs: gaps.length > 0 ? Math.min(...gaps) : 0,
      });
    }
  }
  // Stamp cycle ids back onto event metadata for the detail view.
  for (const cycle of cycles) {
    for (const event of timeline) {
      if (cycle.eventIds.includes(event.id) && !event.metadata.cycleId) {
        event.metadata.cycleId = cycle.id;
      }
    }
  }
  const cyclicValueUsdCents = sum(cycles.map((c) => c.cyclicUsdCents));

  const counterparties = [...counterpartyByAddress.values()].sort(
    (a, b) => b.eventCount - a.eventCount || a.address.localeCompare(b.address),
  );

  const interEventGapsMs: number[] = [];
  for (let i = 1; i < timeline.length; i += 1) {
    interEventGapsMs.push(Math.max(0, timeline[i].timestamp - timeline[i - 1].timestamp));
  }

  const depthWeights = fundingSources.map((s) => s.inflowUsdCents);
  const averageFundingDepth =
    sum(depthWeights) > 0
      ? sum(fundingSources.map((s) => s.depth * s.inflowUsdCents)) / sum(depthWeights)
      : 0;

  return {
    subject,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    fundingSources,
    counterparties,
    cycles,
    clusters: [...new Set(fundingSources.map((s) => s.cluster))],
    assets: [...assets],
    protocols: [...protocols],
    inflowUsdCents,
    outflowUsdCents,
    transferValueUsdCents,
    cyclicValueUsdCents,
    cycleRatio: transferValueUsdCents > 0 ? Math.min(1, cyclicValueUsdCents / transferValueUsdCents) : 0,
    selfFundingShare: inflowUsdCents > 0 ? selfFundedCents / inflowUsdCents : 0,
    circularFundingShare: inflowUsdCents > 0 ? circularFundingCents / inflowUsdCents : 0,
    averageFundingDepth,
    timeline,
    interEventGapsMs,
  };
}

/** Deterministic fingerprint of the graph, used in audit trails. */
export function graphFingerprint(graph: EvidenceGraph): string {
  return canonicalHash({
    subject: graph.subject,
    nodes: graph.nodes.map((n) => [n.id, n.kind, n.cluster, n.eventCount]),
    edges: graph.edges.map((e) => [e.from, e.to, e.kind, e.count, e.weightUsdCents]),
    cycles: graph.cycles.map((c) => [c.counterparty, c.cyclicUsdCents]),
  });
}
