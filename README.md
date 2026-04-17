# AudioRefinement — AI Audio Cleanup + Transcription Platform

A creator-first SaaS application for AI-powered audio cleanup, loudness mastering, and transcript generation. Built on Next.js 15, TypeScript, Prisma, BullMQ, and Whisper.

---

## Quick Start

### 1. Clone & install
```bash
git init && npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Set up the database
```bash
npm run db:migrate
npm run db:generate
```

### 4. Start services (Docker recommended)
```bash
# PostgreSQL + Redis
docker run -d --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=audiorefinement -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

### 5. Run the app
```bash
# Terminal 1 — Next.js app
npm run dev

# Terminal 2 — BullMQ workers
npm run worker
```

Open http://localhost:3000

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── auth/                       # Clerk auth pages
│   ├── dashboard/                  # Dashboard + layout
│   ├── upload/                     # Upload flow
│   ├── jobs/[id]/                  # Job results + player
│   └── api/
│       ├── jobs/                   # create, list, [id], retry, downloads
│       ├── uploads/sign/           # S3 presigned URL
│       ├── usage/                  # Usage stats
│       └── webhooks/               # Clerk + Stripe
├── components/
│   ├── audio/WaveformPlayer.tsx    # Wavesurfer.js player
│   ├── transcript/TranscriptViewer.tsx
│   ├── layout/Sidebar.tsx
│   └── ui/toaster.tsx
├── lib/
│   ├── db/prisma.ts                # Prisma singleton
│   ├── s3/client.ts                # S3 upload/download/presign
│   └── queue/client.ts             # BullMQ queues
├── workers/
│   ├── index.ts                    # Worker entry point
│   ├── processingWorker.ts         # FFmpeg pipeline
│   └── transcriptWorker.ts         # Whisper pipeline
├── hooks/useJob.ts                 # React Query hooks
└── types/index.ts                  # Shared types
```

---

## System Dependencies

Install on your worker server:

```bash
# FFmpeg
sudo apt install ffmpeg

# Whisper (choose one)
pip install openai-whisper
# OR for faster-whisper:
pip install faster-whisper

# For neural denoise (Phase 2):
pip install deepfilternet
```

---

## Environment Variables

See `.env.example` for the full list. Required for Phase 1:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/uploads/sign` | Get presigned S3 upload URL |
| POST | `/api/jobs/create` | Create processing job |
| GET | `/api/jobs` | List all user jobs |
| GET | `/api/jobs/:id` | Get job details + signed download URLs |
| POST | `/api/jobs/:id/retry` | Retry a failed job |
| GET | `/api/jobs/:id/downloads` | Get fresh download URLs |
| DELETE | `/api/jobs/:id` | Delete job + files |
| GET | `/api/usage` | Current billing period usage |
| POST | `/api/webhooks/stripe` | Stripe subscription events |
| POST | `/api/webhooks/clerk` | Clerk user sync |

---

## Processing Pipeline

1. **Ingest** — file lands in S3 via presigned PUT
2. **Probe** — FFmpeg reads codec, bitrate, duration, initial LUFS
3. **Demux** — extract audio from video if needed
4. **Enhance** — FFmpeg DSP chain (highpass → de-ess → compress → EQ)
5. **Normalize** — loudnorm to target LUFS
6. **Transcribe** — Whisper with word-level timestamps
7. **Export** — TXT, SRT, VTT generated
8. **Mux** — clean audio reattached to video if needed
9. **Waveform** — preview JSON generated
10. **Complete** — outputs saved, job marked done

---

## Build Plan

- **Phase 1 (This codebase):** Upload, FFmpeg DSP, Whisper, results UI, auth, billing skeleton
- **Phase 2:** DeepFilterNet denoise, Demucs music removal, preset abstraction, subscription gating
- **Phase 3:** Transcript editor, summaries, speaker diarization, public API

---

## License

Private / proprietary. All rights reserved.
