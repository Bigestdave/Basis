import { api } from "./api";

export interface MoneyDto {
  cents: number;
  usd: number;
  display: string;
}

export interface CreditAccountDto {
  id: string;
  walletId: string;
  creditLimit: MoneyDto;
  borrowed: MoneyDto;
  available: MoneyDto;
  utilization: number;
  utilizationPercent: number;
  status: string;
  totalAwarded: MoneyDto;
  totalRepaid: MoneyDto;
  evaluationCount: number;
  lastEvaluatedAt: number | null;
  updatedAt: number;
  provider: string;
  onchain: boolean;
  onchainReference: string | null;
}

export interface CreditViewResponse {
  account: CreditAccountDto;
  available: MoneyDto;
  borrowed: MoneyDto;
  creditLimit: MoneyDto;
  utilization: number;
  utilizationPercent: number;
  decisions: Array<{
    id: string;
    newLimit: MoneyDto;
    creditIncrease: MoneyDto;
    previousLimit: MoneyDto;
    createdAt: number;
    strength: string;
    evidenceScore: number;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    amount: MoneyDto;
    createdAt: number;
    referenceId?: string;
  }>;
  evidence?: {
    id: string;
    evidenceScore: number;
    strength: string;
    strengthLabel: string;
    capitalIndependence: number;
    economicDiversity: number;
    behavioralCoherence: number;
    factors: Array<{
      key: string;
      label: string;
      value: number;
      explanation: string;
    }>;
    createdAt: number;
  } | null;
}

export interface BorrowRepayResult {
  account: CreditAccountDto;
  transaction: {
    id: string;
    kind: string;
    amount: MoneyDto;
  };
  settlement: {
    settled: boolean;
    reference: string | null;
    provider: string;
    detail?: Record<string, unknown>;
  };
}

export async function getCredit(): Promise<CreditViewResponse> {
  return api.get<CreditViewResponse>("/api/credit");
}

export async function borrow(amountUsd: number): Promise<BorrowRepayResult> {
  return api.post<BorrowRepayResult>("/api/credit/borrow", { amountUsd });
}

export async function repay(amountUsd: number): Promise<BorrowRepayResult> {
  return api.post<BorrowRepayResult>("/api/credit/repay", { amountUsd });
}
