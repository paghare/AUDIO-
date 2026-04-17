"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiJob } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Fetch single job — polls while in-progress
// ─────────────────────────────────────────────────────────────────────────────
export function useJob(jobId: string | null) {
  return useQuery<ApiJob>({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "FAILED") return false;
      return 2000; // poll every 2s while in progress
    },
    refetchIntervalInBackground: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all jobs (dashboard list)
// ─────────────────────────────────────────────────────────────────────────────
export function useJobs() {
  return useQuery<ApiJob[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    staleTime: 10_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry a failed job
// ─────────────────────────────────────────────────────────────────────────────
export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Retry failed");
      }
      return res.json();
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a job
// ─────────────────────────────────────────────────────────────────────────────
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: (_, jobId) => {
      queryClient.removeQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
