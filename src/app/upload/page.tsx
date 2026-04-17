"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileAudio, FileVideo, Loader, ChevronDown } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import {
  PRESET_LABELS, QUALITY_LABELS, LOUDNESS_LABELS,
  ACCEPTED_EXTENSIONS, type Preset, type QualityMode, type LoudnessTarget,
} from "@/types";

const PRESETS = Object.entries(PRESET_LABELS) as [Preset, string][];
const QUALITIES = Object.entries(QUALITY_LABELS) as [QualityMode, string][];
const LOUDNESS = Object.entries(LOUDNESS_LABELS) as [LoudnessTarget, string][];

type UploadState = "idle" | "uploading" | "queuing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("VOICE_CLEANER");
  const [quality, setQuality] = useState<QualityMode>("FAST");
  const [lufsTarget, setLufsTarget] = useState<LoudnessTarget>("SPOTIFY");

  const isAudio = file?.type.startsWith("audio/") ?? false;
  const isVideo = file?.type.startsWith("video/") ?? false;

  // ── Drop zone handlers ────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // ── Upload + job create flow ──────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setState("uploading");
    setProgress(0);

    try {
      // 1. Get presigned URL
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!signRes.ok) {
        const data = await signRes.json();
        throw new Error(data.error ?? "Failed to prepare upload");
      }

      const { uploadId, presignedUrl } = await signRes.json();

      // 2. Upload directly to S3 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 85));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      setProgress(90);
      setState("queuing");

      // 3. Create processing job
      const jobRes = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, preset, quality, lufsTarget }),
      });

      if (!jobRes.ok) {
        const data = await jobRes.json();
        throw new Error(data.error ?? "Failed to start processing");
      }

      const { jobId } = await jobRes.json();
      setProgress(100);
      setState("done");

      // Redirect to results page
      setTimeout(() => router.push(`/jobs/${jobId}`), 600);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">New Upload</h1>
        <p className="text-sm text-muted-foreground">
          Upload a file, choose your processing options, and we&apos;ll handle the rest.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Drop zone ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200",
            isDragging ? "drop-zone-active border-brand-400" : "border-border hover:border-brand-300 hover:bg-muted/30",
            file && "border-brand-300 bg-brand-50"
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
          />

          {file ? (
            <div className="flex items-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100">
                {isVideo ? (
                  <FileVideo className="h-6 w-6 text-brand-600" />
                ) : (
                  <FileAudio className="h-6 w-6 text-brand-600" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="px-6 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium">Drop a file here or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Audio: WAV, MP3, M4A, FLAC · Video: MP4, MOV, MKV, WebM, M4V
              </p>
            </div>
          )}
        </div>

        {/* ── Processing options ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Processing Options</h2>

          {/* Preset */}
          <SelectField
            label="Preset"
            value={preset}
            onChange={(v) => setPreset(v as Preset)}
            options={PRESETS}
          />

          {/* Quality */}
          <SelectField
            label="Quality Mode"
            value={quality}
            onChange={(v) => setQuality(v as QualityMode)}
            options={QUALITIES}
          />

          {/* Loudness target */}
          {preset !== "TRANSCRIPT_ONLY" && (
            <SelectField
              label="Loudness Target"
              value={lufsTarget}
              onChange={(v) => setLufsTarget(v as LoudnessTarget)}
              options={LOUDNESS}
            />
          )}
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        {state !== "idle" && state !== "error" && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {state === "uploading" ? "Uploading…" :
                 state === "queuing" ? "Queuing job…" :
                 "Done! Redirecting…"}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={!file || state === "uploading" || state === "queuing" || state === "done"}
          className={cn(
            "w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200",
            file && state === "idle"
              ? "bg-brand-600 text-white hover:bg-brand-700 btn-glow cursor-pointer"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {state === "uploading" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="h-4 w-4 animate-spin" /> Uploading…
            </span>
          ) : state === "queuing" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="h-4 w-4 animate-spin" /> Starting job…
            </span>
          ) : state === "done" ? (
            "Redirecting to results…"
          ) : (
            "Upload & Process"
          )}
        </button>
      </form>
    </div>
  );
}

// ── Reusable select field ─────────────────────────────────────────────────────
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm font-medium w-36 shrink-0">{label}</label>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          {options.map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
