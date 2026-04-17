import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatBytes, formatRelativeTime, statusColor } from "@/lib/utils";
import { PLAN_LIMITS, PRESET_LABELS } from "@/types";
import { Upload, Plus, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/auth/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { upload: true },
      },
    },
  });

  if (!user) redirect("/auth/sign-in");

  const billingPeriod = new Date().toISOString().slice(0, 7);
  const usageResult = await prisma.usageEvent.aggregate({
    where: { userId: user.id, billingPeriod },
    _sum: { minutesUsed: true },
  });

  const usedMinutes = usageResult._sum.minutesUsed ?? 0;
  const limits = PLAN_LIMITS[user.plan];
  const usagePercent = Math.min(100, (usedMinutes / limits.monthlyMinutes) * 100);

  const stats = {
    total: user.jobs.length,
    completed: user.jobs.filter((j) => j.status === "COMPLETED").length,
    processing: user.jobs.filter((j) =>
      ["QUEUED", "PROCESSING", "TRANSCRIBING"].includes(j.status)
    ).length,
    failed: user.jobs.filter((j) => j.status === "FAILED").length,
  };

  const STATUS_ICONS: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircle className="h-3.5 w-3.5" />,
    FAILED: <AlertCircle className="h-3.5 w-3.5" />,
    PROCESSING: <Loader className="h-3.5 w-3.5 animate-spin" />,
    TRANSCRIBING: <Loader className="h-3.5 w-3.5 animate-spin" />,
    QUEUED: <Clock className="h-3.5 w-3.5" />,
    UPLOADED: <Clock className="h-3.5 w-3.5" />,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back — here&apos;s what&apos;s happening
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Upload
        </Link>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Jobs", value: stats.total, icon: Upload, color: "text-brand-600" },
          { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-green-600" },
          { label: "In Progress", value: stats.processing, icon: Loader, color: "text-blue-600" },
          { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Usage bar */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Monthly Usage</p>
            <p className="text-xs text-muted-foreground">{billingPeriod}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              {Math.round(usedMinutes)} / {limits.monthlyMinutes === 9999 ? "∞" : limits.monthlyMinutes} min
            </p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              user.plan === "PREMIUM" ? "bg-purple-50 text-purple-700" :
              user.plan === "PRO" ? "bg-blue-50 text-blue-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {user.plan} Plan
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              usagePercent > 90 ? "bg-red-500" :
              usagePercent > 70 ? "bg-yellow-500" :
              "bg-brand-600"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {usagePercent > 80 && (
          <p className="mt-2 text-xs text-yellow-600">
            Running low on minutes.{" "}
            <Link href="/billing" className="underline">Upgrade your plan</Link>
          </p>
        )}
      </div>

      {/* Recent jobs */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Recent Jobs</h2>
          <Link href="/jobs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>

        {user.jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload your first audio or video file to get started</p>
            <Link
              href="/upload"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Upload now
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {user.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.upload.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {PRESET_LABELS[job.preset as keyof typeof PRESET_LABELS]} ·{" "}
                      {formatBytes(job.upload.sizeBytes)} ·{" "}
                      {formatRelativeTime(job.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`ml-4 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor(job.status)}`}
                  >
                    {STATUS_ICONS[job.status]}
                    {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
