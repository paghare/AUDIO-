import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    UPLOADED: "text-yellow-600 bg-yellow-50 border-yellow-200",
    QUEUED: "text-blue-600 bg-blue-50 border-blue-200",
    PROCESSING: "text-brand-600 bg-brand-50 border-brand-200",
    TRANSCRIBING: "text-purple-600 bg-purple-50 border-purple-200",
    COMPLETED: "text-green-600 bg-green-50 border-green-200",
    FAILED: "text-red-600 bg-red-50 border-red-200",
  };
  return map[status] ?? "text-gray-600 bg-gray-50 border-gray-200";
}
