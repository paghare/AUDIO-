/**
 * POST /api/jobs/create
 * Creates a processing job and enqueues it
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { enqueueProcessingJob } from "@/lib/queue/client";
import { PLAN_LIMITS } from "@/types";

const RequestSchema = z.object({
  uploadId: z.string().min(1),
  preset: z.enum([
    "VOICE_CLEANER",
    "VOICE_CLEANER_KEEP_MUSIC",
    "VOICE_CLEANER_REMOVE_BREATHS",
    "VOICE_CLEANER_REMOVE_MUSIC",
    "TRANSCRIPT_ONLY",
    "MASTERING_ONLY",
  ]),
  quality: z.enum(["FAST", "PRO", "PREMIUM"]),
  lufsTarget: z.enum(["APPLE_PODCASTS", "SPOTIFY", "YOUTUBE", "BROADCAST", "MOBILE"]),
  settings: z
    .object({
      denoise: z.boolean().optional(),
      removeBreaths: z.boolean().optional(),
      removeMusic: z.boolean().optional(),
      keepMusicSfx: z.boolean().optional(),
      deEss: z.boolean().optional(),
      normalize: z.boolean().optional(),
      eqBoostPresence: z.boolean().optional(),
      eqCutRumble: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { uploadId, preset, quality, lufsTarget, settings } = parsed.data;

  // Get user
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check plan allows requested quality
  const limits = PLAN_LIMITS[user.plan];
  if (!limits.allowedQuality.includes(quality)) {
    return NextResponse.json(
      { error: `Quality mode "${quality}" requires a higher plan. Upgrade to access it.` },
      { status: 403 }
    );
  }

  // Verify upload belongs to user
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, userId: user.id },
  });
  if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  // Derive settings from preset
  const derivedSettings = {
    denoise: preset !== "MASTERING_ONLY",
    removeBreaths: preset === "VOICE_CLEANER_REMOVE_BREATHS",
    removeMusic: preset === "VOICE_CLEANER_REMOVE_MUSIC",
    keepMusicSfx: preset === "VOICE_CLEANER_KEEP_MUSIC",
    deEss: true,
    normalize: true,
    eqBoostPresence: false,
    eqCutRumble: true,
    ...settings,
  };

  // Create job
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      uploadId,
      preset,
      quality,
      lufsTarget,
      status: "QUEUED",
      queuedAt: new Date(),
      settings: { create: derivedSettings },
    },
    include: { settings: true },
  });

  // Determine priority based on plan
  const priority = user.plan === "PREMIUM" ? 1 : user.plan === "PRO" ? 5 : 10;

  // Enqueue
  const bullJobId = await enqueueProcessingJob(
    {
      jobId: job.id,
      uploadId: upload.id,
      userId: user.id,
      s3Key: upload.s3Key,
      preset,
      quality,
      lufsTarget,
      settings: derivedSettings,
    },
    priority,
  );

  // Save BullMQ job ID reference
  await prisma.job.update({
    where: { id: job.id },
    data: { bullJobId: bullJobId ?? null },
  });

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 201 });
}
