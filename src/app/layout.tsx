import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans } from "next/font/google";
import { QueryProvider } from "@/components/layout/QueryProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AudioRefinement — AI Audio Cleanup & Transcription",
    template: "%s | AudioRefinement",
  },
  description:
    "Upload audio or video, AI-clean and master your spoken audio, generate transcripts with SRT/VTT/TXT, and download publish-ready outputs.",
  openGraph: {
    title: "AudioRefinement",
    description: "AI-powered audio cleanup and transcription for creators.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${dmSans.variable} antialiased`}>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
