import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/config";
import { ok, route } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { demoSign, issueNonce, verifySignatureAndCreateSession } from "@/services/auth";
import { DEMO_SCENARIOS, isDemoScenarioKey } from "@/providers/demo/fixtures";
import { listWallets } from "@/services/wallets";
import { getCreditView } from "@/services/credit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ scenarioKey: z.string().min(3).max(80) });

/**
 * One-call demo authentication.
 *
 * This is NOT a bypass: it runs the real flow — issue nonce, sign the exact
 * challenge message with the deterministic demo signer, verify the signature
 * server-side, create a session. The only substitution is the signer, because a
 * simulated wallet has no private key. Disabled for non-demo addresses.
 */
export const POST = route({ auth: "none", rateLimit: "auth" }, async ({ body, ip, url, request }) => {
  const input = await body(bodySchema);
  if (!isDemoScenarioKey(input.scenarioKey)) {
    throw new AppError("validation_error", `Unknown demo scenario "${input.scenarioKey}".`, {
      details: { available: Object.keys(DEMO_SCENARIOS) },
    });
  }
  const fixture = DEMO_SCENARIOS[input.scenarioKey];
  const nonce = await issueNonce({ address: fixture.wallet.address, origin: url.origin, ip });
  const signed = await demoSign({ address: fixture.wallet.address, message: nonce.message });
  const session = await verifySignatureAndCreateSession({
    address: fixture.wallet.address,
    signature: signed.signature,
    nonce: nonce.nonce,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  const [walletList, credit] = await Promise.all([listWallets(session.userId), getCreditView(session.walletId)]);

  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=${session.sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((session.expiresAt - Date.now()) / 1000)}${request.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`,
  );

  return ok(
    {
      scenarioKey: input.scenarioKey,
      label: fixture.label,
      session: { token: session.sessionToken, expiresAt: session.expiresAt },
      wallet: { id: session.walletId, address: session.address, isDemo: true, scenarioKey: session.scenarioKey },
      wallets: walletList,
      credit,
    },
    { headers },
  );
});
