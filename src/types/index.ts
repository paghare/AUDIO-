// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types — used across frontend and backend
// ─────────────────────────────────────────────────────────────────────────────

export type Plan = "FREE" | "PRO" | "PREMIUM";
export type JobStatus = "UPLOADED" | "QUEUED" | "PROCESSING" | "TRANSCRIBING" | "COMPLETED" | "FAILED";
export type QualityMode = "FAST" | "PRO" | "PREMIUM";
export type LoudnessTarget = "APPLE_PODCASTS" | "SPOTIFY" | "YOUTUBE" | "BROADCAST" | "MOBILE";
export type OutputType = "AUDIO_MASTERED" | "VIDEO_PROCESSED" | "TRANSCRIPT_TXT" | "TRANSCRIPT_SRT" | "TRANSCRIPT_VTT" | "WAVEFORM_JSON";

export type Preset =
  | "VOICE_CLEANER"
  | "VOICE_CLEANER_KEEP_MUSIC"
  | "VOICE_CLEANER_REMOVE_BREATHS"
  | "VOICE_CLEANER_REMOVE_MUSIC"
  | "TRANSCRIPT_ONLY"
  | "MASTERING_ONLY";

// ─────────────────────────────────────────────────────────────────────────────
// Loudness target values (LUFS)
// ─────────────────────────────────────────────────────────────────────────────
export const LUFS_VALUES: Record<LoudnessTarget, number> = {
  APPLE_PODCASTS: -16,
  SPOTIFY: -14,
  YOUTUBE: -14,
  BROADCAST: -23,
  MOBILE: -19,
};

export const LOUDNESS_LABELS: Record<LoudnessTarget, string> = {
  APPLE_PODCASTS: "Apple Podcasts (−16 LUFS)",
  SPOTIFY: "Spotify (−14 LUFS)",
  YOUTUBE: "YouTube (−14 LUFS)",
  BROADCAST: "Broadcast (−23 LUFS)",
  MOBILE: "Mobile (−19 LUFS)",
};

export const PRESET_LABELS: Record<Preset, string> = {
  VOICE_CLEANER: "Voice Cleaner",
  VOICE_CLEANER_KEEP_MUSIC: "Voice Cleaner (keep music & SFX)",
  VOICE_CLEANER_REMOVE_BREATHS: "Voice Cleaner (remove breaths)",
  VOICE_CLEANER_REMOVE_MUSIC: "Voice Cleaner (remove music)",
  TRANSCRIPT_ONLY: "Transcript Only",
  MASTERING_ONLY: "Mastering Only",
};

export const QUALITY_LABELS: Record<QualityMode, string> = {
  FAST: "Fast — FFmpeg DSP only",
  PRO: "Pro — Neural denoise + DSP",
  PREMIUM: "Premium — Advanced restoration",
};

// ─────────────────────────────────────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiJob {
  id: string;
  status: JobStatus;
  preset: Preset;
  quality: QualityMode;
  lufsTarget: LoudnessTarget;
  inputLufs: number | null;
  outputLufs: number | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  upload: {
    id: string;
    originalName: string;
    sizeBytes: number;
    durationSecs: number | null;
    isVideo: boolean;
  };
  outputs: ApiOutput[];
  transcript: ApiTranscript | null;
}

export interface ApiOutput {
  id: string;
  type: OutputType;
  sizeBytes: number | null;
  mimeType: string | null;
  signedUrl?: string;
}

export interface ApiTranscript {
  id: string;
  language: string;
  plainText: string | null;
  segments: TranscriptSegment[] | null;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job settings
// ─────────────────────────────────────────────────────────────────────────────

export interface JobSettingsInput {
  preset: Preset;
  quality: QualityMode;
  lufsTarget: LoudnessTarget;
  denoise?: boolean;
  removeBreaths?: boolean;
  removeMusic?: boolean;
  keepMusicSfx?: boolean;
  deEss?: boolean;
  normalize?: boolean;
  eqBoostPresence?: boolean;
  eqCutRumble?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan limits
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, {
  maxFileSizeMb: number;
  monthlyMinutes: number;
  allowedQuality: QualityMode[];
  transcriptExports: boolean;
  jobHistory: boolean;
  priorityQueue: boolean;
}> = {
  FREE: {
    maxFileSizeMb: 50,
    monthlyMinutes: 30,
    allowedQuality: ["FAST"],
    transcriptExports: false,
    jobHistory: false,
    priorityQueue: false,
  },
  PRO: {
    maxFileSizeMb: 500,
    monthlyMinutes: 300,
    allowedQuality: ["FAST", "PRO"],
    transcriptExports: true,
    jobHistory: true,
    priorityQueue: false,
  },
  PREMIUM: {
    maxFileSizeMb: 2048,
    monthlyMinutes: 9999,
    allowedQuality: ["FAST", "PRO", "PREMIUM"],
    transcriptExports: true,
    jobHistory: true,
    priorityQueue: true,
  },
};

// Accepted MIME types
export const ACCEPTED_MIME_TYPES = [
  "audio/wav", "audio/wave",
  "audio/mpeg", "audio/mp3",
  "audio/mp4", "audio/x-m4a",
  "audio/flac", "audio/x-flac",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "video/x-m4v",
] as const;

export const ACCEPTED_EXTENSIONS = [
  ".wav", ".mp3", ".m4a", ".flac",
  ".mp4", ".mov", ".mkv", ".webm", ".m4v",
];
