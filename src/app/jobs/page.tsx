import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatBytes, formatRelativeTime, statusColor } from "@/lib/utils";
import { PRESET_LABELS } from "@/types";
import { Upload, Plus, ChevronRight, Loader, CheckCircle, AlertCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/auth/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) redirect("/auth/sign-in");

  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { upload: true },
  });

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Jobs</h1>
          <p className="text-sm text-muted-foreground">{jobs.length} total</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Upload
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-24 text-center">
          <Upload className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium">No jobs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload your first file to get started</p>
          <Link
            href="/upload"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Upload now
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_140px_120px_100px_28px] gap-4 border-b border-border bg-muted/30 px-5 py-3">
            {["File", "Preset", "Size", "Status", ""].map((h) => (
              <div key={h} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</div>
            ))}
          </div>

          <ul className="divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="grid grid-cols-[1fr_140px_120px_100px_28px] gap-4 items-center px-5 py-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.upload.originalName}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(job.createdAt)}</p>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {PRESET_LABELS[job.preset as keyof typeof PRESET_LABELS]}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatBytes(job.upload.sizeBytes)}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor(job.status)}`}>
                    {STATUS_ICONS[job.status]}
                    {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
