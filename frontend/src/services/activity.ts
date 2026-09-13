import { api } from "./api";
import type { MoneyDto } from "./credit";

export interface ApiActivityItem {
  id: string;
  type: string;
  chainKey: string;
  timestamp: number;
  timestampIso: string;
  amount: MoneyDto;
  asset: string;
  protocol: string | null;
  counterparty: string;
  counterpartyAddress: string;
  txHash: string;
  blockHeight: number;
  verified: boolean;
  status: string;
  credited: boolean;
  description: string;
}

export async function getActivity(): Promise<ApiActivityItem[]> {
  const data = await api.get<{ activity: ApiActivityItem[] }>("/api/activity");
  return data.activity ?? [];
}
