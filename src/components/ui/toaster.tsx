"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// Simple global toast state
const listeners: ((toast: Toast) => void)[] = [];

export function toast(message: string, type: ToastType = "info") {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((l) => l({ id, type, message }));
}

toast.success = (message: string) => toast(message, "success");
toast.error = (message: string) => toast(message, "error");

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-slide-in-right",
            t.type === "success" && "border-green-200 bg-green-50 text-green-800",
            t.type === "error" && "border-red-200 bg-red-50 text-red-800",
            t.type === "info" && "border-border bg-card text-foreground",
          )}
        >
          {t.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
          {t.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
