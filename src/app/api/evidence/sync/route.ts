import { z } from "zod";
import { ok, route } from "@/lib/http";
import { enabledChainKeys } from "@/services/wallets";
import { enqueueJob } from "@/services/jobs";
import { serializeJob } from "@/services/serializers";
import { getJob } from "@/services/jobs";
import { audit } from "@/services/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletId: z.string().min(3).max(120).optional(),
  chainKeys: z.array(z.string().min(2).max(64)).max(12).optional(),
});

/**
 * Fetch raw chain data, build proofs and attest events WITHOUT converting them
 * into credit. Queues a job so the frontend can show real verification progress.
 */
export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body, ip }) => {
  const input = await body(bodySchema);
  const walletId = input.walletId ?? auth!.walletId!;
  const chainKeys = input.chainKeys?.length ? input.chainKeys : await enabledChainKeys(walletId);

  const job = await enqueueJob({
    type: "SYNC_EVIDENCE",
    idempotencyKey: `sync:${walletId}:${chainKeys.slice().sort().join(",")}`,
    context: {
      walletId,
      userId: auth!.userId,
      address: auth!.address!,
      isDemo: auth!.isDemoWallet,
      chainKeys,
      ipAddress: ip,
    },
  });
  await audit({ action: "evidence.sync_started", userId: auth!.userId, walletId, referenceId: job.id, ipAddress: ip, metadata: { chainKeys } });

  const row = await getJob(job.id);
  return ok({ job: serializeJob(row), chainKeys }, { status: 202 });
});
