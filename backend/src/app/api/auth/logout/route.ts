import { SESSION_COOKIE_NAME } from "@/lib/config";
import { ok, route } from "@/lib/http";
import { revokeSession } from "@/services/auth";
import { audit } from "@/services/audit";

export const dynamic = "force-dynamic";

export const POST = route({ auth: "required", rateLimit: "auth" }, async ({ auth, ip }) => {
  await revokeSession(auth!.sessionId);
  await audit({ action: "auth.session_revoked", userId: auth!.userId, walletId: auth!.walletId, ipAddress: ip });
  const headers = new Headers();
  headers.append("set-cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return ok({ loggedOut: true }, { headers });
});
