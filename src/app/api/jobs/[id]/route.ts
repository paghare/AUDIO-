/**
 * GET  /api/jobs/:id  — fetch job details + signed download URLs
 * DELETE /api/jobs/:id — delete job + all outputs
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDownloadPresignedUrl, deleteObject } from "@/lib/s3/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.job.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      upload: true,
      outputs: true,
      transcript: true,
      settings: true,
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Attach signed download URLs to each output
  const outputsWithUrls = await Promise.all(
    job.outputs.map(async (output) => {
      const signedUrl = await getDownloadPresignedUrl(output.s3Key, 3600);
      return { ...output, signedUrl };
    })
  );

  return NextResponse.json({
    ...job,
    outputs: outputsWithUrls,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    upload: {
      ...job.upload,
      createdAt: job.upload.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.job.findFirst({
    where: { id: params.id, userId: user.id },
    include: { outputs: true, upload: true },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Delete all S3 objects
  await Promise.allSettled([
    deleteObject(job.upload.s3Key),
    ...job.outputs.map((o) => deleteObject(o.s3Key)),
  ]);

  // Delete from DB
  await prisma.job.delete({ where: { id: job.id } });

  return NextResponse.json({ success: true });
}
