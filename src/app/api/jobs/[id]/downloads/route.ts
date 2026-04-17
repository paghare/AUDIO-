/**
 * GET /api/jobs/:id/downloads
 * Returns fresh signed download URLs for all outputs
 */
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDownloadPresignedUrl } from "@/lib/s3/client";

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
    include: { outputs: true, upload: true },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const downloads = await Promise.all(
    job.outputs.map(async (output) => {
      const filename = output.s3Key.split("/").pop() ?? "download";
      const signedUrl = await getDownloadPresignedUrl(output.s3Key, 3600, filename);
      return {
        type: output.type,
        filename,
        sizeBytes: output.sizeBytes,
        mimeType: output.mimeType,
        signedUrl,
      };
    })
  );

  return NextResponse.json({ downloads });
}
