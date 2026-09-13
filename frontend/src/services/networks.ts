import { api } from "./api";

export interface NetworkDto {
  key: string;
  name: string;
  chainId: number | null;
  family: string;
  attestcoinChainKey: number | null;
  attestable: boolean;
  rpcConfigured: boolean;
  enabled: boolean;
  selected: boolean;
  events?: number;
  statusText?: string;
}

export async function getNetworks(): Promise<NetworkDto[]> {
  const data = await api.get<{ networks: NetworkDto[] }>("/api/networks");
  return data.networks ?? [];
}

export async function toggleNetwork(networkKey: string, enabled: boolean): Promise<NetworkDto[]> {
  const data = await api.post<{ networks: NetworkDto[] }>("/api/networks/connect", {
    networkKey,
    enabled,
  });
  return data.networks ?? [];
}
