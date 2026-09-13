import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/config";
import { ok, route } from "@/lib/http";
import { verifySignatureAndCreateSession } from "@/services/auth";
import { listWallets } from "@/services/wallets";
import { getCreditView } from "@/services/credit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  address: z.string().min(3).max(128),
  signature: z.string().min(10).max(4096),
  nonce: z.string().min(8).max(128),
});

/**
 * Verifies the wallet signature server-side, creates a session and returns the
 * authenticated state. The address is never trusted without a valid signature.
 */
export const POST = route({ auth: "none", rateLimit: "auth" }, async ({ body, ip, request }) => {
  const input = await body(bodySchema);
  const result = await verifySignatureAndCreateSession({
    address: input.address,
    signature: input.signature,
    nonce: input.nonce,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  const [walletList, credit] = await Promise.all([
    listWallets(result.userId),
    getCreditView(result.walletId),
  ]);

  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=${result.sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((result.expiresAt - Date.now()) / 1000)}${request.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`,
  );

  return ok(
    {
      session: { token: result.sessionToken, expiresAt: result.expiresAt },
      user: { id: result.userId, mode: result.isDemoWallet ? "demo" : "live" },
      wallet: {
        id: result.walletId,
        address: result.address,
        isDemo: result.isDemoWallet,
        scenarioKey: result.scenarioKey,
      },
      wallets: walletList,
      credit,
    },
    { headers },
  );
});
