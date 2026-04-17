/**
 * GET /api/usage
 * Returns current billing period usage stats
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PLAN_LIMITS } from "@/types";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billingPeriod = new Date().toISOString().slice(0, 7);

  const [usageResult, jobCounts] = await Promise.all([
    prisma.usageEvent.aggregate({
      where: { userId: user.id, billingPeriod },
      _sum: { minutesUsed: true },
    }),
    prisma.job.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: true,
    }),
  ]);

  const usedMinutes = usageResult._sum.minutesUsed ?? 0;
  const limits = PLAN_LIMITS[user.plan];

  const statusMap: Record<string, number> = {};
  for (const row of jobCounts) {
    statusMap[row.status] = row._count;
  }

  return NextResponse.json({
    plan: user.plan,
    billingPeriod,
    usedMinutes: Math.round(usedMinutes * 10) / 10,
    monthlyMinutes: limits.monthlyMinutes,
    remainingMinutes: Math.max(0, limits.monthlyMinutes - usedMinutes),
    maxFileSizeMb: limits.maxFileSizeMb,
    jobCounts: statusMap,
  });
}
