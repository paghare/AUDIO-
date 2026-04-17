/**
 * POST /api/jobs/:id/retry
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enqueueProcessingJob } from "@/lib/queue/client";
import { PLAN_LIMITS } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.job.findFirst({
    where: { id, userId: user.id },
    include: { upload: true, settings: true },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "FAILED") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }
  if (job.retryCount >= 3) {
    return NextResponse.json({ error: "Maximum retry attempts reached" }, { status: 400 });
  }

  // Re-queue
  await prisma.job.update({
    where: { id: job.id },
    data: { status: "QUEUED", errorMessage: null, queuedAt: new Date() },
  });

  const priority = user.plan === "PREMIUM" ? 1 : user.plan === "PRO" ? 5 : 10;
  await enqueueProcessingJob(
    {
      jobId: job.id,
      uploadId: job.uploadId,
      userId: user.id,
      s3Key: job.upload.s3Key,
      preset: job.preset,
      quality: job.quality,
      lufsTarget: job.lufsTarget,
      settings: {
        denoise: job.settings?.denoise ?? true,
        removeBreaths: job.settings?.removeBreaths ?? false,
        removeMusic: job.settings?.removeMusic ?? false,
        keepMusicSfx: job.settings?.keepMusicSfx ?? false,
        deEss: job.settings?.deEss ?? true,
        normalize: job.settings?.normalize ?? true,
      },
    },
    priority,
  );

  return NextResponse.json({ success: true, status: "QUEUED" });
}
