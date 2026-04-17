/**
 * Worker Entry Point
 * Run with: npm run worker
 *
 * Spawns BullMQ workers for:
 *   - upload-processing   (FFmpeg + denoise pipeline)
 *   - transcript-generation (Whisper)
 *   - export-render        (final packaging)
 */

import { processingWorker } from "./processingWorker";
import { transcriptWorker } from "./transcriptWorker";
import { exportWorker } from "./exportWorker";

console.log("🎛  AudioRefinement Workers starting...");
console.log("   ├── upload-processing worker");
console.log("   ├── transcript-generation worker");
console.log("   └── export-render worker");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all([
    processingWorker.close(),
    transcriptWorker.close(),
    exportWorker.close(),
  ]);
  process.exit(0);
});

process.on("SIGINT", async () => {
  await Promise.all([
    processingWorker.close(),
    transcriptWorker.close(),
    exportWorker.close(),
  ]);
  process.exit(0);
});
