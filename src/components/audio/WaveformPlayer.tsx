"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface WaveformPlayerProps {
  audioUrl: string;
  waveformUrl?: string;
  label?: string;
}

export function WaveformPlayer({ audioUrl, waveformUrl, label }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#c7d2fe",     // brand-200
      progressColor: "#5B4CF5", // brand-600
      cursorColor: "#5B4CF5",
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
      height: 64,
      normalize: true,
    });

    wsRef.current = ws;

    ws.load(audioUrl);
    ws.setVolume(volume);

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setReady(true);
    });

    ws.on("timeupdate", (time) => setCurrentTime(time));

    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));

    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const togglePlay = () => {
    wsRef.current?.playPause();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    wsRef.current?.setVolume(v);
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      {label && <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>}

      {/* Waveform */}
      <div
        ref={containerRef}
        className="waveform-container mb-3"
        style={{ opacity: ready ? 1 : 0.4, transition: "opacity 0.3s" }}
      />

      {!ready && (
        <div className="h-16 skeleton rounded mb-3" />
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!ready}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
        </button>

        <div className="flex-1 text-xs text-muted-foreground">
          <span className="font-mono">{formatDuration(currentTime)}</span>
          {" / "}
          <span className="font-mono">{formatDuration(duration)}</span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-16 accent-brand-600"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
