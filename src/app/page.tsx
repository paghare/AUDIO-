import Link from "next/link";
import { ArrowRight, Mic, FileText, Zap, Shield, ChevronRight } from "lucide-react";

const PRESETS = [
  "Voice Cleaner",
  "Remove Music",
  "Remove Breaths",
  "Transcript Only",
  "Mastering Only",
];

const FEATURES = [
  {
    icon: Mic,
    title: "AI-Powered Cleanup",
    desc: "DeepFilterNet neural denoising, vocal isolation, de-essing, and custom DSP chain trained on podcasts and voice recordings.",
  },
  {
    icon: FileText,
    title: "Instant Transcripts",
    desc: "Whisper-powered speech-to-text with word-level timestamps. Export to TXT, SRT, or VTT in seconds.",
  },
  {
    icon: Zap,
    title: "Loudness Mastering",
    desc: "Auto-normalize to Apple Podcasts, Spotify, YouTube, or Broadcast specs. No guesswork.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    desc: "Files are encrypted in transit and at rest. Auto-deleted after your retention window. GDPR compliant.",
  },
];

const LOUDNESS = [
  { name: "Apple Podcasts", lufs: "−16 LUFS" },
  { name: "Spotify", lufs: "−14 LUFS" },
  { name: "YouTube", lufs: "−14 LUFS" },
  { name: "Broadcast", lufs: "−23 LUFS" },
  { name: "Mobile", lufs: "−19 LUFS" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">AudioRefinement</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#presets" className="hover:text-foreground transition-colors">Presets</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors btn-glow"
            >
              Start free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Gradient orb */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 flex items-start justify-center overflow-hidden"
          aria-hidden
        >
          <div className="h-[600px] w-[900px] -translate-y-1/3 rounded-full bg-brand-600/10 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            AI audio processing for creators
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Clean audio.{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              Perfect transcripts.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Upload any audio or video. Get AI-cleaned, loudness-mastered audio and
            word-perfect transcripts — ready to publish in minutes, not hours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-brand-700 transition-all duration-200 btn-glow"
            >
              Upload your first file <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-base font-medium text-foreground hover:bg-muted transition-colors"
            >
              See how it works <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-muted-foreground">
            Free to start · No credit card required · 30 minutes/month free
          </p>
        </div>
      </section>

      {/* ── Presets Strip ───────────────────────────────────────────────────── */}
      <section id="presets" className="border-y border-border bg-muted/30 px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Processing presets
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PRESETS.map((preset) => (
              <span
                key={preset}
                className="rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground"
              >
                {preset}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-3xl font-bold">
            Everything you need to ship great audio
          </h2>
          <p className="mb-16 text-center text-muted-foreground">
            One platform, from raw recording to publish-ready output.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 hover:border-brand-200 hover:shadow-md transition-all duration-200"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Loudness targets ───────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-y border-border px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-2xl font-bold">Loudness targets built in</h2>
          <p className="mb-10 text-muted-foreground">
            One click to master for any platform. No manual LUFS math.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {LOUDNESS.map(({ name, lufs }) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-background px-5 py-3 text-center"
              >
                <div className="text-xs text-muted-foreground">{name}</div>
                <div className="text-base font-bold text-brand-600">{lufs}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-3 text-center text-3xl font-bold">Simple, creator pricing</h2>
          <p className="mb-16 text-center text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Try it out",
                features: ["30 min/month", "50 MB max file", "Fast mode only", "TXT export"],
                cta: "Start free",
                href: "/auth/sign-up",
                highlighted: false,
              },
              {
                name: "Pro",
                price: "$19",
                desc: "/month",
                features: ["300 min/month", "500 MB max file", "Pro neural mode", "TXT, SRT, VTT", "Job history"],
                cta: "Start Pro",
                href: "/auth/sign-up?plan=pro",
                highlighted: true,
              },
              {
                name: "Premium",
                price: "$49",
                desc: "/month",
                features: ["Unlimited minutes", "2 GB max file", "Premium pipeline", "Priority queue", "All exports"],
                cta: "Go Premium",
                href: "/auth/sign-up?plan=premium",
                highlighted: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 ${
                  tier.highlighted
                    ? "border-brand-600 bg-brand-50 shadow-lg ring-1 ring-brand-600"
                    : "border-border bg-card"
                }`}
              >
                {tier.highlighted && (
                  <div className="mb-3 inline-flex rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </div>
                )}
                <div className="mb-1 text-xl font-bold">{tier.name}</div>
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">{tier.desc}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-border bg-background hover:bg-muted"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-brand-600 flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">AudioRefinement</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AudioRefinement. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
