/**
 * Transcript Worker
 * Handles: Whisper speech-to-text → TXT / SRT / VTT generation
 */

import { Worker, Job } from "bullmq";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRedisConnection, QUEUE_NAMES, TranscriptJobPayload } from "@/lib/queue/client";
import { s3, BUCKET, outputKey } from "@/lib/s3/client";
import { prisma } from "@/lib/db/prisma";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import type { TranscriptSegment } from "@/types";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatTimeVTT(seconds: number): string {
  return formatTimeSRT(seconds).replace(",", ".");
}

function segmentsToSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) =>
      `${i + 1}\n${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n${seg.text.trim()}\n`
    )
    .join("\n");
}

function segmentsToVTT(segments: TranscriptSegment[]): string {
  const header = "WEBVTT\n\n";
  const body = segments
    .map((seg) =>
      `${formatTimeVTT(seg.start)} --> ${formatTimeVTT(seg.end)}\n${seg.text.trim()}\n`
    )
    .join("\n");
  return header + body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Whisper
// ─────────────────────────────────────────────────────────────────────────────
async function runWhisper(
  audioPath: string,
  outputDir: string,
  language = "auto",
): Promise<{ segments: TranscriptSegment[]; language: string }> {
  // Try faster-whisper CLI first, fall back to whisper
  const modelName = "base";

  try {
    await execFileAsync("faster-whisper", [
      audioPath,
      "--model", modelName,
      "--output_dir", outputDir,
      "--output_format", "json",
      "--language", language === "auto" ? "" : language,
      "--word_timestamps", "True",
      "--task", "transcribe",
    ]);
  } catch {
    // Fall back to openai-whisper
    await execFileAsync("whisper", [
      audioPath,
      "--model", modelName,
      "--output_dir", outputDir,
      "--output_format", "json",
      "--language", language === "auto" ? "" : language,
      "--word_timestamps", "True",
    ]);
  }

  // Read JSON output
  const audioBasename = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, `${audioBasename}.json`);

  const raw = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
  const segments: TranscriptSegment[] = (raw.segments ?? []).map(
    (seg: { id: number; start: number; end: number; text: string; words?: unknown[] }, i: number) => ({
      id: i,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      words: seg.words ?? [],
    })
  );

  return {
    segments,
    language: raw.language ?? language,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────────────────────────────────────
async function downloadFromS3(s3Key: string, localPath: string): Promise<void> {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const body = response.Body as Readable;
  const writeStream = (await import("fs")).createWriteStream(localPath);
  await new Promise<void>((resolve, reject) => {
    body.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}

async function uploadToS3(data: string | Buffer, s3Key: string, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: typeof data === "string" ? Buffer.from(data, "utf-8") : data,
    ContentType: contentType,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeJob(job: Job<TranscriptJobPayload>): Promise<void> {
  const { jobId, userId, audioS3Key, language = "auto" } = job.data;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `ar-trans-${jobId}-`));

  try {
    await job.updateProgress(10);

    // Download audio
    const audioPath = path.join(tmpDir, "audio.mp3");
    await downloadFromS3(audioS3Key, audioPath);
    await job.updateProgress(20);

    // Convert to 16kHz mono WAV for Whisper
    const wavPath = path.join(tmpDir, "audio_16k.wav");
    await execFileAsync("ffmpeg", [
      "-i", audioPath,
      "-ar", "16000", "-ac", "1",
      "-y", wavPath,
    ]);
    await job.updateProgress(30);

    // Run Whisper
    const whisperOutputDir = path.join(tmpDir, "whisper");
    await fs.mkdir(whisperOutputDir, { recursive: true });
    const { segments, language: detectedLang } = await runWhisper(wavPath, whisperOutputDir, language);
    await job.updateProgress(75);

    // Build plain text
    const plainText = segments.map((s) => s.text.trim()).join(" ");

    // Build SRT
    const srtContent = segmentsToSRT(segments);

    // Build VTT
    const vttContent = segmentsToVTT(segments);

    // Upload all three
    const txtKey = outputKey(userId, jobId, "transcript.txt");
    const srtKey = outputKey(userId, jobId, "transcript.srt");
    const vttKey = outputKey(userId, jobId, "transcript.vtt");

    await Promise.all([
      uploadToS3(plainText, txtKey, "text/plain"),
      uploadToS3(srtContent, srtKey, "text/plain"),
      uploadToS3(vttContent, vttKey, "text/vtt"),
    ]);

    // Save to DB
    await prisma.$transaction([
      prisma.transcript.upsert({
        where: { jobId },
        create: {
          jobId,
          language: detectedLang,
          plainText,
          segments: segments as unknown as import("@prisma/client").Prisma.InputJsonValue,
          modelName: "whisper-base",
        },
        update: {
          language: detectedLang,
          plainText,
          segments: segments as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      }),
      prisma.output.createMany({
        data: [
          { jobId, type: "TRANSCRIPT_TXT", s3Key: txtKey, s3Bucket: BUCKET, mimeType: "text/plain" },
          { jobId, type: "TRANSCRIPT_SRT", s3Key: srtKey, s3Bucket: BUCKET, mimeType: "text/plain" },
          { jobId, type: "TRANSCRIPT_VTT", s3Key: vttKey, s3Bucket: BUCKET, mimeType: "text/vtt" },
        ],
        skipDuplicates: true,
      }),
    ]);

    await job.updateProgress(90);

    // Mark job complete
    const dbJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { upload: true, user: true },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Log usage
    if (dbJob?.upload && dbJob.user) {
      await prisma.usageEvent.create({
        data: {
          userId,
          jobId,
          eventType: "job_completed",
          minutesUsed: (dbJob.upload.durationSecs ?? 0) / 60,
          plan: dbJob.user.plan,
          billingPeriod: new Date().toISOString().slice(0, 7),
        },
      });
    }

    await job.updateProgress(100);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker instance
// ─────────────────────────────────────────────────────────────────────────────
export const transcriptWorker = new Worker<TranscriptJobPayload>(
  QUEUE_NAMES.TRANSCRIPT_GENERATION,
  transcribeJob,
  {
    connection: createRedisConnection(),
    concurrency: 2,
  },
);

transcriptWorker.on("completed", (job) => {
  console.log(`[transcript] Job ${job.id} completed`);
});

transcriptWorker.on("failed", async (job, err) => {
  console.error(`[transcript] Job ${job?.id} failed:`, err.message);
  if (job) {
    await prisma.job.update({
      where: { id: job.data.jobId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: `Transcription failed: ${err.message.slice(0, 400)}`,
      },
    });
  }
});
