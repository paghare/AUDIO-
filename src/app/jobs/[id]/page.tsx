"use client";

import { useParams } from "next/navigation";
import { useJob, useRetryJob, useDeleteJob } from "@/hooks/useJob";
import { formatBytes, formatDuration, formatRelativeTime, statusColor } from "@/lib/utils";
import { PRESET_LABELS, QUALITY_LABELS, LOUDNESS_LABELS } from "@/types";
import {
  Download, RefreshCw, Trash2, Loader, CheckCircle,
  AlertCircle, Clock, Radio, FileText, FileVideo, FileAudio,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { ApiOutput } from "@/types";

// Dynamically import waveform to avoid SSR issues
const WaveformPlayer = dynamic(
  () => import("@/components/audio/WaveformPlayer").then((m) => m.WaveformPlayer),
  { ssr: false, loading: () => <div className="h-24 skeleton rounded-lg" /> }
);

const TranscriptViewer = dynamic(
  () => import("@/components/transcript/TranscriptViewer").then((m) => m.TranscriptViewer),
  { ssr: false }
);

export default function JobPage() {
  const params = useParams();
  const jobId = params.id as string;

  const { data: job, isLoading, error } = useJob(jobId);
  const retry = useRetryJob();
  const deleteJob = useDeleteJob();

  if (isLoading) return <JobSkeleton />;
  if (error || !job) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
      <p className="font-medium">Job not found</p>
      <p className="text-sm text-muted-foreground">This job may have been deleted.</p>
    </div>
  );

  const isProcessing = ["QUEUED", "PROCESSING", "TRANSCRIBING"].includes(job.status);
  const isComplete = job.status === "COMPLETED";
  const isFailed = job.status === "FAILED";

  const audioOutput = job.outputs.find((o) => o.type === "AUDIO_MASTERED");
  const videoOutput = job.outputs.find((o) => o.type === "VIDEO_PROCESSED");
  const waveformOutput = job.outputs.find((o) => o.type === "WAVEFORM_JSON");

  const downloadOutputs = job.outputs.filter(
    (o) => !["WAVEFORM_JSON"].includes(o.type)
  );

  const OUTPUT_LABELS: Record<string, string> = {
    AUDIO_MASTERED: "Mastered Audio (MP3)",
    VIDEO_PROCESSED: "Processed Video (MP4)",
    TRANSCRIPT_TXT: "Transcript (TXT)",
    TRANSCRIPT_SRT: "Subtitles (SRT)",
    TRANSCRIPT_VTT: "Captions (VTT)",
  };

  const OUTPUT_ICONS: Record<string, React.ReactNode> = {
    AUDIO_MASTERED: <FileAudio className="h-4 w-4" />,
    VIDEO_PROCESSED: <FileVideo className="h-4 w-4" />,
    TRANSCRIPT_TXT: <FileText className="h-4 w-4" />,
    TRANSCRIPT_SRT: <FileText className="h-4 w-4" />,
    TRANSCRIPT_VTT: <FileText className="h-4 w-4" />,
  };

  return (
    <div className="mx-auto max-w-3xl p-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{job.upload.originalName}</h1>
          <p className="text-sm text-muted-foreground">
            {formatBytes(job.upload.sizeBytes)}
            {job.upload.durationSecs && ` · ${formatDuration(job.upload.durationSecs)}`}
            {" · "}
            {formatRelativeTime(job.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${statusColor(job.status)}`}>
          {isProcessing && <Loader className="h-3.5 w-3.5 animate-spin" />}
          {isComplete && <CheckCircle className="h-3.5 w-3.5" />}
          {isFailed && <AlertCircle className="h-3.5 w-3.5" />}
          {!isProcessing && !isComplete && !isFailed && <Clock className="h-3.5 w-3.5" />}
          {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
        </span>
      </div>

      {/* ── Processing / progress ───────────────────────────────────────────── */}
      {isProcessing && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Loader className="h-4 w-4 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-brand-700">
              {job.status === "QUEUED" ? "Waiting in queue…" :
               job.status === "PROCESSING" ? "Enhancing audio…" :
               "Generating transcript…"}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full animate-pulse rounded-full bg-brand-400" style={{ width: "60%" }} />
          </div>
          <p className="mt-2 text-xs text-brand-600">This page refreshes automatically</p>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────────────── */}
      {isFailed && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-red-700">Processing failed</p>
              {job.errorMessage && (
                <p className="mt-1 text-sm text-red-600">{job.errorMessage}</p>
              )}
              <p className="mt-1 text-xs text-red-500">Attempt {job.retryCount + 1} of 3</p>
            </div>
            {job.retryCount < 3 && (
              <button
                onClick={() => retry.mutate(jobId)}
                disabled={retry.isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retry.isPending ? "animate-spin" : ""}`} />
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Before/after waveform + loudness ───────────────────────────────── */}
      {isComplete && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Audio Preview</h2>

          {/* Loudness delta */}
          {job.inputLufs && job.outputLufs && (
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Before</p>
                <p className="text-lg font-bold">{job.inputLufs.toFixed(1)} LUFS</p>
              </div>
              <div className="flex items-center text-muted-foreground">→</div>
              <div className="flex-1 rounded-lg bg-brand-50 border border-brand-100 p-3 text-center">
                <p className="text-xs text-brand-600 mb-0.5">After</p>
                <p className="text-lg font-bold text-brand-700">{job.outputLufs.toFixed(1)} LUFS</p>
              </div>
            </div>
          )}

          {/* Waveform players */}
          {audioOutput?.signedUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Mastered Audio
              </p>
              <WaveformPlayer
                audioUrl={audioOutput.signedUrl}
                waveformUrl={waveformOutput?.signedUrl}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Downloads ──────────────────────────────────────────────────────── */}
      {isComplete && downloadOutputs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Downloads</h2>
          <div className="space-y-2">
            {downloadOutputs.map((output) => (
              <DownloadRow key={output.id} output={output} />
            ))}
          </div>
        </div>
      )}

      {/* ── Transcript viewer ───────────────────────────────────────────────── */}
      {isComplete && job.transcript && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Transcript</h2>
          <TranscriptViewer transcript={job.transcript} />
        </div>
      )}

      {/* ── Job meta ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Job Details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Preset", PRESET_LABELS[job.preset as keyof typeof PRESET_LABELS]],
            ["Quality", QUALITY_LABELS[job.quality as keyof typeof QUALITY_LABELS]?.split(" —")[0]],
            ["Target", LOUDNESS_LABELS[job.lufsTarget as keyof typeof LOUDNESS_LABELS]],
            ["Job ID", job.id],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Danger zone ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => {
            if (confirm("Delete this job and all its files? This cannot be undone.")) {
              deleteJob.mutate(jobId, {
                onSuccess: () => { window.location.href = "/jobs"; },
              });
            }
          }}
          disabled={deleteJob.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete job
        </button>
      </div>
    </div>
  );
}

// ── Download row ──────────────────────────────────────────────────────────────
function DownloadRow({ output }: { output: ApiOutput & { signedUrl?: string } }) {
  const labels: Record<string, string> = {
    AUDIO_MASTERED: "Mastered Audio (MP3)",
    VIDEO_PROCESSED: "Processed Video (MP4)",
    TRANSCRIPT_TXT: "Transcript (TXT)",
    TRANSCRIPT_SRT: "Subtitles (SRT)",
    TRANSCRIPT_VTT: "Captions (VTT)",
  };

  if (!output.signedUrl) return null;

  return (
    <a
      href={output.signedUrl}
      download
      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{labels[output.type] ?? output.type}</span>
        {output.sizeBytes && (
          <span className="text-muted-foreground">{formatBytes(output.sizeBytes)}</span>
        )}
      </div>
      <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </a>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function JobSkeleton() {
  return (
    <div className="mx-auto max-w-3xl p-8 space-y-6 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-6 w-64 skeleton" />
          <div className="h-4 w-40 skeleton" />
        </div>
        <div className="h-8 w-24 skeleton rounded-full" />
      </div>
      <div className="h-32 skeleton rounded-xl" />
      <div className="h-48 skeleton rounded-xl" />
    </div>
  );
}
