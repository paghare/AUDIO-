/**
 * POST /api/webhooks/clerk
 * Sync Clerk user events to our DB
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    primary_email_address_id?: string;
  };
}

export async function POST(req: NextRequest) {
  const event = (await req.json()) as ClerkWebhookEvent;

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    )?.email_address ?? data.email_addresses[0]?.email_address;

    if (!primaryEmail) return NextResponse.json({ ok: true });

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.upsert({
      where: { clerkId: data.id },
      create: {
        clerkId: data.id,
        email: primaryEmail,
        name,
        avatarUrl: data.image_url,
      },
      update: {
        email: primaryEmail,
        name,
        avatarUrl: data.image_url,
      },
    });
  }

  if (type === "user.deleted") {
    await prisma.user.updateMany({
      where: { clerkId: data.id },
      data: { deletedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
