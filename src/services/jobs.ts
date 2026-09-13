/**
 * Asynchronous job system.
 *
 * Postgres-backed queue with `FOR UPDATE SKIP LOCKED` claiming, per-step
 * progress, timeouts and a reaper. The pipeline runs in the background and the
 * frontend polls `GET /api/jobs/:id`; nothing about the credit flow is faked
 * with a spinner.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { jobConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { deterministicId, randomId } from "@/lib/deterministic";
import { JOB_STEPS, STEP_STATUS, type JobStep, type JobStepRecord } from "@/domain/types";
import { runBuildCreditPipeline, type PipelineContext, type PipelineResult } from "./pipeline";
import { audit } from "./audit";

export type JobType = "BUILD_CREDIT" | "SYNC_EVIDENCE";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function initialSteps(): JobStepRecord[] {
  return JOB_STEPS.map((step) => ({
    step,
    status: "PENDING" as const,
    startedAt: null,
    finishedAt: null,
    detail: null,
    metrics: {},
  }));
}

export interface EnqueueInput {
  type: JobType;
  context: PipelineContext;
  /** Deterministic key so the same request cannot queue two identical jobs. */
  idempotencyKey?: string;
}

export async function enqueueJob(input: EnqueueInput) {
  const id = input.idempotencyKey
    ? deterministicId("job", input.type, input.context.walletId, input.idempotencyKey)
    : randomId("job");

  const inserted = await db
    .insert(jobs)
    .values({
      id,
      type: input.type,
      status: "QUEUED",
      progress: 0,
      walletId: input.context.walletId,
      userId: input.context.userId,
      currentStep: null,
      steps: initialSteps() as never,
      payload: { context: input.context } as never,
    })
    .onConflictDoNothing({ target: jobs.id })
    .returning({ id: jobs.id, status: jobs.status });

  const row = inserted[0] ?? { id, status: "QUEUED" };
  await audit({ action: "job.created", userId: input.context.userId, walletId: input.context.walletId, referenceId: id });

  // Fire-and-forget background execution. Failures are persisted on the job row.
  void executeJob(id, input.context, input.type).catch((err) => {
    console.error("[basis] job execution crashed", { jobId: id, error: (err as Error).message });
  });

  return row;
}

export async function executeJob(jobId: string, context: PipelineContext, type: JobType): Promise<void> {
  // Claim atomically so two workers (or a retry) cannot run the same job.
  const claimed = await db
    .update(jobs)
    .set({ status: "SYNCING", lockedAt: new Date(), lockedBy: process.pid.toString(), startedAt: new Date(), attempt: sql`${jobs.attempt} + 1` })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["QUEUED", "FAILED"])))
    .returning({ id: jobs.id });
  if (claimed.length === 0) return;

  const steps = initialSteps();
  const evaluate = type === "BUILD_CREDIT";
  const startedAt = Date.now();

  const persist = async (patch: Partial<typeof jobs.$inferInsert>) => {
    await db.update(jobs).set({ ...patch, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  };

  try {
    const result: PipelineResult = await runBuildCreditPipeline(
      { ...context, jobId },
      {
        evaluate,
        reporter: async ({ step, detail, metrics }) => {
          const index = steps.findIndex((s) => s.step === step);
          if (index === -1) return;
          const now = Date.now();
          const previous = steps[index];
          steps[index] = {
            ...previous,
            status: "DONE",
            startedAt: previous.startedAt ?? now,
            finishedAt: now,
            detail: detail ?? null,
            metrics: { ...previous.metrics, ...(metrics ?? {}) },
          };
          // Mark the *next* step as running so polling shows forward motion.
          if (steps[index + 1]) {
            steps[index + 1] = { ...steps[index + 1], status: "RUNNING", startedAt: now };
          }
          const done = steps.filter((s) => s.status === "DONE").length;
          await persist({
            steps: steps as never,
            currentStep: step,
            status: STEP_STATUS[step],
            progress: Math.round((done / steps.length) * 100),
          });
          if (context.isDemo && jobConfig.demoStepDelayMs > 0) await sleep(jobConfig.demoStepDelayMs);
        },
      },
    );

    if (Date.now() - startedAt > jobConfig.jobTimeoutMs) {
      throw new AppError("job_timeout", `Job exceeded the ${Math.round(jobConfig.jobTimeoutMs / 1000)}s budget.`);
    }

    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i].status !== "DONE") steps[i] = { ...steps[i], status: evaluate ? "DONE" : "SKIPPED", finishedAt: Date.now() };
    }

    await persist({
      status: "COMPLETED",
      progress: 100,
      steps: steps as never,
      currentStep: JOB_STEPS[JOB_STEPS.length - 1],
      finishedAt: new Date(),
      lockedAt: null,
      resultReference: {
        evaluationId: result.evaluationId,
        decisionId: result.decisionId,
        evidenceScore: result.evidence?.evidenceScore ?? null,
        strength: result.evidence?.strength ?? null,
        creditIncreaseUsdCents: result.decision?.creditIncreaseUsdCents ?? 0,
        newLimitUsdCents: result.decision?.newLimitUsdCents ?? null,
        availableUsdCents: result.account?.availableUsdCents ?? null,
        awarded: result.decision?.awarded ?? false,
        blockedBy: result.decision?.blockedBy ?? [],
        eventCount: result.eventCount,
        eligibleEventCount: result.eligibleEventCount,
        attested: result.attested,
        duplicateEvaluation: result.duplicateEvaluation,
      } as never,
    });
    await audit({ action: "job.completed", userId: context.userId, walletId: context.walletId, referenceId: jobId });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError("job_failed", (err as Error).message ?? "Job failed");
    const failedStep = steps.find((s) => s.status === "RUNNING")?.step ?? steps.find((s) => s.status === "PENDING")?.step ?? null;
    if (failedStep) {
      const index = steps.findIndex((s) => s.step === failedStep);
      steps[index] = { ...steps[index], status: "FAILED", finishedAt: Date.now(), detail: appError.message };
    }
    await persist({
      status: "FAILED",
      steps: steps as never,
      error: appError.message,
      errorCode: appError.code,
      finishedAt: new Date(),
      lockedAt: null,
    });
    await audit({
      action: "job.failed",
      userId: context.userId,
      walletId: context.walletId,
      referenceId: jobId,
      result: "failure",
      metadata: { code: appError.code, message: appError.message, step: failedStep },
    });
  }
}

export async function getJob(id: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!rows[0]) throw new AppError("job_not_found", `Job ${id} was not found.`);
  return rows[0];
}

export async function listJobs(walletId: string, limit = 20) {
  return db.select().from(jobs).where(eq(jobs.walletId, walletId)).orderBy(desc(jobs.createdAt)).limit(limit);
}

/** Clear locks from jobs whose worker died, so they can be retried. */
export async function reapStaleJobs(): Promise<{ reaped: number }> {
  const cutoff = new Date(Date.now() - jobConfig.jobTimeoutMs);
  const stale = await db
    .update(jobs)
    .set({ status: "FAILED", errorCode: "job_timeout", error: "Job timed out and was reaped.", lockedAt: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(jobs.status, ["QUEUED", "SYNCING", "FETCHING", "VERIFYING", "NORMALIZING", "EVALUATING", "DECIDING"]), sql`${jobs.updatedAt} < ${cutoff}`))
    .returning({ id: jobs.id });
  return { reaped: stale.length };
}

export function jobStepSummary(stepRecords: JobStepRecord[]) {
  return stepRecords.map((s) => ({ step: s.step, status: s.status, detail: s.detail }));
}

export type { JobStep };
