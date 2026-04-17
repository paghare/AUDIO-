"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ApiTranscript, TranscriptSegment } from "@/types";
import { formatDuration } from "@/lib/utils";

interface TranscriptViewerProps {
  transcript: ApiTranscript;
}

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"segments" | "plain">("segments");

  const segments = transcript.segments as TranscriptSegment[] | null;

  async function copyText() {
    await navigator.clipboard.writeText(transcript.plainText ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["segments", "plain"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-brand-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "segments" ? "Timestamped" : "Plain Text"}
            </button>
          ))}
        </div>
        <button
          onClick={copyText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto rounded-xl border border-border bg-muted/10 p-4">
        {view === "segments" && segments ? (
          <div className="space-y-3">
            {segments.map((seg) => (
              <div key={seg.id} className="flex gap-3 group">
                <span className="shrink-0 w-14 pt-0.5 font-mono text-xs text-muted-foreground">
                  {formatDuration(seg.start)}
                </span>
                <p className="text-sm leading-relaxed">{seg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {transcript.plainText ?? "No transcript available."}
          </p>
        )}
      </div>

      {/* Language */}
      <p className="text-xs text-muted-foreground">
        Detected language: <span className="font-medium">{transcript.language.toUpperCase()}</span>
      </p>
    </div>
  );
}
