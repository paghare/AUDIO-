import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

// ─────────────────────────────────────────────────────────────────────────────
// Redis connection
// ─────────────────────────────────────────────────────────────────────────────
export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

const connection = createRedisConnection();

// ─────────────────────────────────────────────────────────────────────────────
// Queue names
// ─────────────────────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  UPLOAD_PROCESSING: "upload-processing",
  TRANSCRIPT_GENERATION: "transcript-generation",
  EXPORT_RENDER: "export-render",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Queues
// ─────────────────────────────────────────────────────────────────────────────
export const uploadProcessingQueue = new Queue(QUEUE_NAMES.UPLOAD_PROCESSING, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const transcriptQueue = new Queue(QUEUE_NAMES.TRANSCRIPT_GENERATION, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const exportRenderQueue = new Queue(QUEUE_NAMES.EXPORT_RENDER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Job payload types
// ─────────────────────────────────────────────────────────────────────────────
export interface ProcessingJobPayload {
  jobId: string;
  uploadId: string;
  userId: string;
  s3Key: string;
  preset: string;
  quality: string;
  lufsTarget: string;
  settings: Record<string, boolean>;
}

export interface TranscriptJobPayload {
  jobId: string;
  userId: string;
  audioS3Key: string;
  language?: string;
}

export interface ExportJobPayload {
  jobId: string;
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue a new processing job
// ─────────────────────────────────────────────────────────────────────────────
export async function enqueueProcessingJob(
  payload: ProcessingJobPayload,
  priority: number = 10,
) {
  const job = await uploadProcessingQueue.add("process", payload, {
    priority,
    jobId: `proc-${payload.jobId}`,
  });
  return job.id;
}

export async function enqueueTranscriptJob(payload: TranscriptJobPayload) {
  const job = await transcriptQueue.add("transcribe", payload, {
    jobId: `trans-${payload.jobId}`,
  });
  return job.id;
}
