import { z } from "zod";
import { ok, route } from "@/lib/http";
import { enabledChainKeys } from "@/services/wallets";
import { enqueueJob, getJob } from "@/services/jobs";
import { serializeJob } from "@/services/serializers";
import { audit } from "@/services/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  walletId: z.string().min(3).max(120).optional(),
  chainKeys: z.array(z.string().min(2).max(64)).max(12).optional(),
  idempotencyKey: z.string().min(4).max(120).optional(),
});

/**
 * POST /api/evidence/build
 *
 * Canonical endpoint to trigger the Build Credit pipeline:
 * sync -> fetch -> proofs -> attest -> normalise -> evidence -> evaluate -> credit decision -> credit update.
 */
export const POST = route({ auth: "required", rateLimit: "mutation" }, async ({ auth, body, ip }) => {
  const input = await body(bodySchema);
  const walletId = input.walletId ?? auth!.walletId!;
  const chainKeys = input.chainKeys?.length ? input.chainKeys : await enabledChainKeys(walletId);

  const job = await enqueueJob({
    type: "BUILD_CREDIT",
    idempotencyKey: input.idempotencyKey ?? `build:${walletId}:${Date.now()}`,
    context: {
      walletId,
      userId: auth!.userId,
      address: auth!.address!,
      isDemo: auth!.isDemoWallet,
      chainKeys,
      ipAddress: ip,
    },
  });

  await audit({
    action: "evidence.sync_started",
    userId: auth!.userId,
    walletId,
    referenceId: job.id,
    ipAddress: ip,
    metadata: { chainKeys, pipeline: "BUILD_CREDIT" },
  });

  const row = await getJob(job.id);
  return ok(
    {
      job: serializeJob(row),
      pollUrl: `/api/jobs/${job.id}`,
      message: "Build Credit started. Poll the job for verification progress; the credit decision is produced by the backend.",
    },
    { status: 202 },
  );
});
