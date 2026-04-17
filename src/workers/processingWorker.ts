/**
 * Processing Worker
 * Handles: FFmpeg probe → audio extraction → DSP chain → loudness normalization
 * After completion: enqueues transcript job
 */

import { Worker, Job } from "bullmq";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRedisConnection, QUEUE_NAMES, ProcessingJobPayload, enqueueTranscriptJob } from "@/lib/queue/client";
import { getDownloadPresignedUrl, getUploadPresignedUrl, outputKey, s3, BUCKET } from "@/lib/s3/client";
import { prisma } from "@/lib/db/prisma";
import { LUFS_VALUES } from "@/types";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg helpers
// ─────────────────────────────────────────────────────────────────────────────

async function probeMedia(filePath: string): Promise<{
  duration: number;
  hasVideo: boolean;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  inputLufs: number;
}> {
  // Get stream info
  const { stdout: probeOut } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);

  const probe = JSON.parse(probeOut);
  const audioStream = probe.streams?.find((s: Record<string, string>) => s.codec_type === "audio");
  const videoStream = probe.streams?.find((s: Record<string, string>) => s.codec_type === "video");

  // Measure loudness
  const { stderr: loudnessOut } = await execFileAsync("ffmpeg", [
    "-i", filePath,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);

  let inputLufs = -20;
  const match = loudnessOut.match(/"input_i"\s*:\s*"([\-\d.]+)"/);
  if (match) inputLufs = parseFloat(match[1]);

  return {
    duration: parseFloat(probe.format?.duration ?? "0"),
    hasVideo: !!videoStream,
    codec: audioStream?.codec_name ?? "unknown",
    bitrate: parseInt(probe.format?.bit_rate ?? "0") / 1000,
    sampleRate: parseInt(audioStream?.sample_rate ?? "44100"),
    channels: parseInt(audioStream?.channels ?? "2"),
    inputLufs,
  };
}

async function extractAndEnhanceAudio(
  inputPath: string,
  outputPath: string,
  settings: ProcessingJobPayload["settings"],
  lufsTarget: number,
  quality: string,
): Promise<void> {
  // Build FFmpeg audio filter chain
  const filters: string[] = [];

  // 1. High-pass filter to cut rumble
  if (settings.eqCutRumble !== false) {
    filters.push("highpass=f=80");
  }

  // 2. De-essing
  if (settings.deEss !== false) {
    filters.push("deesser=i=0.5:m=0.5:f=0.5");
  }

  // 3. Presence boost (optional)
  if (settings.eqBoostPresence) {
    filters.push("equalizer=f=3000:t=o:w=1000:g=2");
  }

  // 4. Compression
  filters.push("acompressor=threshold=-18dB:ratio=4:attack=5:release=50:makeup=2dB");

  // 5. Loudness normalization (two-pass loudnorm)
  if (settings.normalize !== false) {
    filters.push(`loudnorm=I=${lufsTarget}:TP=-1.5:LRA=11`);
  }

  const filterChain = filters.join(",");

  const args = [
    "-i", inputPath,
    "-vn",               // strip video
    "-af", filterChain,
    "-ar", "48000",      // resample to 48kHz
    "-ac", "2",          // stereo
    "-c:a", "pcm_s16le", // uncompressed for further processing
    "-y",
    outputPath,
  ];

  await execFileAsync("ffmpeg", args);
}

async function encodeFinalAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-i", inputPath,
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-id3v2_version", "3",
    "-y",
    outputPath,
  ]);
}

async function muxAudioIntoVideo(
  originalVideoPath: string,
  cleanAudioPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-i", originalVideoPath,
    "-i", cleanAudioPath,
    "-c:v", "copy",       // copy video stream unchanged
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:a", "aac",
    "-b:a", "192k",
    "-y",
    outputPath,
  ]);
}

async function generateWaveform(
  audioPath: string,
  outputPath: string,
  samples = 200,
): Promise<void> {
  // Generate waveform data using ffmpeg
  const { stdout } = await execFileAsync("ffmpeg", [
    "-i", audioPath,
    "-af", `aresample=8000,aformat=sample_fmts=s16:channel_layouts=mono`,
    "-ac", "1",
    "-ar", "8000",
    "-f", "s16le",
    "-",
  ]);

  // Downsample to requested number of data points
  const buffer = Buffer.from(stdout, "binary");
  const totalSamples = buffer.length / 2;
  const step = Math.floor(totalSamples / samples);
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const offset = i * step * 2;
    if (offset + 2 <= buffer.length) {
      const sample = Math.abs(buffer.readInt16LE(offset));
      waveform.push(Math.round((sample / 32768) * 100) / 100);
    }
  }

  await fs.writeFile(outputPath, JSON.stringify({ samples: waveform, count: samples }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Download S3 file to local temp
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

async function uploadToS3(localPath: string, s3Key: string, contentType: string): Promise<void> {
  const data = await fs.readFile(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: data,
    ContentType: contentType,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main processor
// ─────────────────────────────────────────────────────────────────────────────
async function processJob(job: Job<ProcessingJobPayload>): Promise<void> {
  const { jobId, uploadId, userId, s3Key, preset, quality, lufsTarget, settings } = job.data;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `ar-${jobId}-`));

  try {
    // 1. Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    // 2. Download original file
    const ext = path.extname(s3Key);
    const originalPath = path.join(tmpDir, `original${ext}`);
    await downloadFromS3(s3Key, originalPath);
    await job.updateProgress(15);

    // 3. Probe media
    const probe = await probeMedia(originalPath);

    // Update upload with probe data
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        durationSecs: probe.duration,
        codec: probe.codec,
        bitrate: probe.bitrate,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
        isVideo: probe.hasVideo,
      },
    });

    // Update job with input LUFS
    await prisma.job.update({
      where: { id: jobId },
      data: { inputLufs: probe.inputLufs },
    });

    await job.updateProgress(25);

    // 4. Extract & enhance audio (skip if TRANSCRIPT_ONLY)
    const lufsValue = LUFS_VALUES[lufsTarget as keyof typeof LUFS_VALUES] ?? -14;
    const rawAudioPath = path.join(tmpDir, "audio_raw.wav");
    const enhancedAudioPath = path.join(tmpDir, "audio_enhanced.wav");
    const finalAudioPath = path.join(tmpDir, "audio_final.mp3");

    if (preset !== "TRANSCRIPT_ONLY") {
      await extractAndEnhanceAudio(
        originalPath,
        enhancedAudioPath,
        settings,
        lufsValue,
        quality,
      );
      await encodeFinalAudio(enhancedAudioPath, finalAudioPath);
    } else {
      // Just extract audio for transcription
      await execFileAsync("ffmpeg", [
        "-i", originalPath,
        "-vn", "-ar", "16000", "-ac", "1",
        "-y", rawAudioPath,
      ]);
    }

    await job.updateProgress(60);

    // 5. Upload mastered audio
    const audioOutputKey = outputKey(userId, jobId, "audio_mastered.mp3");
    if (preset !== "TRANSCRIPT_ONLY") {
      await uploadToS3(finalAudioPath, audioOutputKey, "audio/mpeg");

      const stat = await fs.stat(finalAudioPath);
      await prisma.output.create({
        data: {
          jobId,
          type: "AUDIO_MASTERED",
          s3Key: audioOutputKey,
          s3Bucket: BUCKET,
          sizeBytes: stat.size,
          mimeType: "audio/mpeg",
        },
      });
    }

    await job.updateProgress(70);

    // 6. If input was video, mux clean audio back in
    if (probe.hasVideo && preset !== "TRANSCRIPT_ONLY" && preset !== "MASTERING_ONLY") {
      const videoOutputPath = path.join(tmpDir, "video_processed.mp4");
      await muxAudioIntoVideo(originalPath, finalAudioPath, videoOutputPath);

      const videoKey = outputKey(userId, jobId, "video_processed.mp4");
      await uploadToS3(videoOutputPath, videoKey, "video/mp4");

      const stat = await fs.stat(videoOutputPath);
      await prisma.output.create({
        data: {
          jobId,
          type: "VIDEO_PROCESSED",
          s3Key: videoKey,
          s3Bucket: BUCKET,
          sizeBytes: stat.size,
          mimeType: "video/mp4",
        },
      });
    }

    await job.updateProgress(80);

    // 7. Generate waveform JSON
    const waveformPath = path.join(tmpDir, "waveform.json");
    const audioForWaveform = preset !== "TRANSCRIPT_ONLY" ? finalAudioPath : rawAudioPath;
    await generateWaveform(audioForWaveform, waveformPath);

    const waveformKey = outputKey(userId, jobId, "waveform.json");
    await uploadToS3(waveformPath, waveformKey, "application/json");

    await prisma.output.create({
      data: {
        jobId,
        type: "WAVEFORM_JSON",
        s3Key: waveformKey,
        s3Bucket: BUCKET,
        mimeType: "application/json",
      },
    });

    await job.updateProgress(85);

    // 8. Measure output loudness
    let outputLufs = lufsValue;
    if (preset !== "TRANSCRIPT_ONLY") {
      const { stderr } = await execFileAsync("ffmpeg", [
        "-i", finalAudioPath,
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
      ]);
      const match = stderr.match(/"input_i"\s*:\s*"([\-\d.]+)"/);
      if (match) outputLufs = parseFloat(match[1]);
    }

    // 9. Update job status to TRANSCRIBING and enqueue transcript job
    const audioKeyForTranscript = preset !== "TRANSCRIPT_ONLY" ? audioOutputKey : outputKey(userId, jobId, "audio_raw.wav");

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "TRANSCRIBING", outputLufs },
    });

    // Enqueue transcript generation
    if (preset !== "MASTERING_ONLY") {
      await enqueueTranscriptJob({
        jobId,
        userId,
        audioS3Key: audioKeyForTranscript,
      });
    } else {
      // No transcript needed — mark complete
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      // Log usage
      const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (upload && user) {
        await prisma.usageEvent.create({
          data: {
            userId,
            jobId,
            eventType: "job_completed",
            minutesUsed: (upload.durationSecs ?? 0) / 60,
            plan: user.plan,
            qualityTier: job.data.quality as "FAST" | "PRO" | "PREMIUM",
            billingPeriod: new Date().toISOString().slice(0, 7),
          },
        });
      }
    }

    await job.updateProgress(100);
  } finally {
    // Cleanup temp dir
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker instance
// ─────────────────────────────────────────────────────────────────────────────
export const processingWorker = new Worker<ProcessingJobPayload>(
  QUEUE_NAMES.UPLOAD_PROCESSING,
  processJob,
  {
    connection: createRedisConnection(),
    concurrency: 2, // 2 concurrent processing jobs per worker instance
    limiter: { max: 10, duration: 60_000 }, // max 10 jobs/minute
  },
);

processingWorker.on("completed", (job) => {
  console.log(`[processing] Job ${job.id} completed`);
});

processingWorker.on("failed", async (job, err) => {
  console.error(`[processing] Job ${job?.id} failed:`, err.message);
  if (job) {
    await prisma.job.update({
      where: { id: job.data.jobId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: err.message.slice(0, 500),
        retryCount: { increment: 1 },
      },
    });
  }
});
