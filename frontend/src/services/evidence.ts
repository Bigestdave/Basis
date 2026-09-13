import { api } from "./api";
import type { MoneyDto } from "./credit";

export interface EvidenceFactorDto {
  key: string;
  label: string;
  value: number;
  explanation: string;
  signals?: Record<string, unknown>;
}

export interface JobStepRecord {
  step: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  detail?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
}

export interface JobSnapshot {
  id: string;
  type: string;
  status: "QUEUED" | "SYNCING" | "FETCHING" | "VERIFYING" | "NORMALIZING" | "EVALUATING" | "DECIDING" | "COMPLETED" | "FAILED";
  progress: number;
  currentStep: string | null;
  steps: JobStepRecord[];
  error?: string | null;
  errorCode?: string | null;
  resultReference?: Record<string, unknown> | null;
}

export interface EvidenceResponse {
  evaluation: {
    id: string;
    evidenceScore: number;
    strength: string;
    strengthLabel: string;
    capitalIndependence: number;
    economicDiversity: number;
    behavioralCoherence: number;
    eventCount: number;
    verifiedEventCount: number;
    volume: MoneyDto;
    evidenceHash: string;
    factors: EvidenceFactorDto[];
    createdAt: number;
  } | null;
  events: Array<{
    id: string;
    type: string;
    chainKey: string;
    timestamp: number;
    amount: MoneyDto;
    counterparty: string;
    protocol?: string | null;
    verified: boolean;
    description: string;
  }>;
  factors: EvidenceFactorDto[];
  exclusions: {
    count: number;
    categories: Array<{ label: string; count: number; note: string }>;
  };
}

export interface EventTechnicalDetail {
  event: {
    id: string;
    txHash: string;
    blockHeight: number;
    chainKey: string;
    type: string;
    from: string;
    to: string;
    asset: string;
    amount: MoneyDto;
    protocol: string | null;
    verified: boolean;
    timestamp: number;
    description: string;
  };
  attestation?: {
    id: string;
    provider: string;
    chainKey: string;
    attestcoinChainKey?: number | null;
    sourceTxHash: string;
    blockHeight: number;
    verified: boolean;
    status: string;
    txBytes?: string | null;
    merkleRoot?: string | null;
    merkleSiblings?: number;
    continuityLowerEndpointDigest?: string | null;
    continuityRoots?: number;
    verifier?: string | null;
    verifiedAt?: number | null;
  } | null;
}

export async function getEvidence(): Promise<EvidenceResponse> {
  return api.get<EvidenceResponse>("/api/evidence");
}

export async function getEventDetail(eventId: string): Promise<EventTechnicalDetail> {
  return api.get<EventTechnicalDetail>(`/api/evidence/${eventId}`);
}

export async function buildCredit(): Promise<{ job: JobSnapshot; pollUrl: string }> {
  return api.post<{ job: JobSnapshot; pollUrl: string }>("/api/evidence/build", {});
}

export async function pollJob(jobId: string): Promise<{ job: JobSnapshot }> {
  return api.get<{ job: JobSnapshot }>(`/api/jobs/${jobId}`);
}
