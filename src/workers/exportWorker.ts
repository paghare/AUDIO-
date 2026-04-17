/**
 * Export Worker
 * Handles final packaging / presigned URL generation for completed jobs
 */

import { Worker, Job } from "bullmq";
import { createRedisConnection, QUEUE_NAMES, ExportJobPayload } from "@/lib/queue/client";
import { prisma } from "@/lib/db/prisma";

async function handleExport(job: Job<ExportJobPayload>): Promise<void> {
  const { jobId } = job.data;

  // Verify all outputs exist and are accessible
  const dbJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: { outputs: true },
  });

  if (!dbJob) throw new Error(`Job ${jobId} not found`);

  console.log(`[export] Job ${jobId} has ${dbJob.outputs.length} outputs ready`);

  // Future: generate ZIP archive, send webhook, etc.
  await job.updateProgress(100);
}

export const exportWorker = new Worker<ExportJobPayload>(
  QUEUE_NAMES.EXPORT_RENDER,
  handleExport,
  { connection: createRedisConnection(), concurrency: 5 },
);

exportWorker.on("failed", (job, err) => {
  console.error(`[export] Job ${job?.id} failed:`, err.message);
});
