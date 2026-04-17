import { Queue } from "bullmq";
import IORedis from "ioredis";

// ─────────────────────────────────────────────────────────────────────────────
// Queue names
// ─────────────────────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  UPLOAD_PROCESSING: "upload-processing",
  TRANSCRIPT_GENERATION: "transcript-generation",
  EXPORT_RENDER: "export-render",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Lazy singleton connection — only created when first used (not at build time)
// ─────────────────────────────────────────────────────────────────────────────
let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

// For backwards-compat with workers
export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy queue singletons
// ─────────────────────────────────────────────────────────────────────────────
let _uploadProcessingQueue: Queue | null = null;
let _transcriptQueue: Queue | null = null;
let _exportRenderQueue: Queue | null = null;

export function getUploadProcessingQueue(): Queue {
  if (!_uploadProcessingQueue) {
    _uploadProcessingQueue = new Queue(QUEUE_NAMES.UPLOAD_PROCESSING, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _uploadProcessingQueue;
}

export function getTranscriptQueue(): Queue {
  if (!_transcriptQueue) {
    _transcriptQueue = new Queue(QUEUE_NAMES.TRANSCRIPT_GENERATION, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _transcriptQueue;
}

export function getExportRenderQueue(): Queue {
  if (!_exportRenderQueue) {
    _exportRenderQueue = new Queue(QUEUE_NAMES.EXPORT_RENDER, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return _exportRenderQueue;
}

// Backwards-compat named exports (lazy proxies)
export const uploadProcessingQueue = {
  add: (...args: Parameters<Queue["add"]>) => getUploadProcessingQueue().add(...args),
};

export const transcriptQueue = {
  add: (...args: Parameters<Queue["add"]>) => getTranscriptQueue().add(...args),
};

export const exportRenderQueue = {
  add: (...args: Parameters<Queue["add"]>) => getExportRenderQueue().add(...args),
};

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
// Enqueue helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function enqueueProcessingJob(
  payload: ProcessingJobPayload,
  priority: number = 10,
) {
  const job = await getUploadProcessingQueue().add("process", payload, {
    priority,
    jobId: `proc-${payload.jobId}`,
  });
  return job.id;
}

export async function enqueueTranscriptJob(payload: TranscriptJobPayload) {
  const job = await getTranscriptQueue().add("transcribe", payload, {
    jobId: `trans-${payload.jobId}`,
  });
  return job.id;
}
