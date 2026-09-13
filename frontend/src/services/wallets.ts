import { api, setStoredSessionToken, ApiError } from "./api";

export interface WalletDto {
  id: string;
  address: string;
  label: string | null;
  family: string;
  status: string;
  isDemo: boolean;
  scenarioKey: string | null;
  createdAt: number;
  networks: string[];
  qualifyingEvents?: number;
}

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
}

export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  return candidate ?? null;
}

export async function getWallets(): Promise<WalletDto[]> {
  const data = await api.get<{ wallets: WalletDto[] }>("/api/wallets");
  return data.wallets ?? [];
}

export async function connectLiveWallet(): Promise<{ address: string; chainId: number | null }> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new ApiError("UNSUPPORTED_WALLET", "No EIP-1193 wallet (MetaMask, Rabby, etc.) detected in your browser.");
  }
  let accounts: string[];
  try {
    accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4001) throw new ApiError("WALLET_REJECTED", "Wallet connection request was rejected.");
    throw new ApiError("UNSUPPORTED_WALLET", "Could not connect to browser wallet.");
  }

  if (!accounts || accounts.length === 0) {
    throw new ApiError("WALLET_REJECTED", "Wallet returned no accounts.");
  }

  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: chainIdHex ? Number(BigInt(chainIdHex)) : null };
}

export async function authenticateLiveWallet(): Promise<{ address: string; userId: string; walletId: string }> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new ApiError("UNSUPPORTED_WALLET", "No EIP-1193 wallet detected.");
  }
  const { address } = await connectLiveWallet();

  const nonceData = await api.post<{ nonce: string; message: string }>("/api/auth/nonce", {
    address,
    origin: window.location.origin,
  });

  let signature: string;
  try {
    signature = (await provider.request({
      method: "personal_sign",
      params: [nonceData.message, address],
    })) as string;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4001) throw new ApiError("WALLET_REJECTED", "Signature request was rejected in your wallet.");
    throw new ApiError("SIGNATURE_FAILED", "Failed to sign authentication message.");
  }

  const verifyData = await api.post<{
    sessionToken: string;
    userId: string;
    walletId: string;
    address: string;
  }>("/api/auth/verify", {
    address,
    signature,
    nonce: nonceData.nonce,
  });

  if (verifyData.sessionToken) {
    setStoredSessionToken(verifyData.sessionToken);
  }

  return verifyData;
}

export async function disconnectWallet(walletId: string): Promise<void> {
  await api.delete(`/api/wallets/${walletId}`);
}
