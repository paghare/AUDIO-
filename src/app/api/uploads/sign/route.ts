/**
 * POST /api/uploads/sign
 * Returns a presigned S3 URL for direct client upload
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getUploadPresignedUrl, uploadKey, BUCKET } from "@/lib/s3/client";
import { ACCEPTED_MIME_TYPES, PLAN_LIMITS } from "@/types";
import { randomBytes } from "crypto";

const RequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
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

  const { filename, contentType, sizeBytes } = parsed.data;

  // Validate MIME type
  if (!ACCEPTED_MIME_TYPES.includes(contentType as typeof ACCEPTED_MIME_TYPES[number])) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  // Get user + plan
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const limits = PLAN_LIMITS[user.plan];
  const maxSizeBytes = limits.maxFileSizeMb * 1024 * 1024;

  if (sizeBytes > maxSizeBytes) {
    return NextResponse.json(
      { error: `File too large. Your ${user.plan} plan allows up to ${limits.maxFileSizeMb} MB.` },
      { status: 413 }
    );
  }

  // Check monthly usage
  const billingPeriod = new Date().toISOString().slice(0, 7);
  const usageResult = await prisma.usageEvent.aggregate({
    where: { userId: user.id, billingPeriod },
    _sum: { minutesUsed: true },
  });
  const usedMinutes = usageResult._sum.minutesUsed ?? 0;
  if (usedMinutes >= limits.monthlyMinutes) {
    return NextResponse.json(
      { error: "Monthly minute limit reached. Please upgrade your plan." },
      { status: 429 }
    );
  }

  // Create upload record
  const uploadId = randomBytes(12).toString("hex");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const s3Key = uploadKey(user.id, uploadId, safeFilename);

  await prisma.upload.create({
    data: {
      id: uploadId,
      userId: user.id,
      filename: safeFilename,
      originalName: filename,
      mimeType: contentType,
      sizeBytes,
      s3Key,
      s3Bucket: BUCKET,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Generate presigned upload URL (10 minute window)
  const presignedUrl = await getUploadPresignedUrl(s3Key, contentType, 600);

  return NextResponse.json({ uploadId, presignedUrl, s3Key });
}
