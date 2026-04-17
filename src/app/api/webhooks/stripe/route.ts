/**
 * POST /api/webhooks/stripe
 * Handles Stripe subscription lifecycle events
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import type { Plan } from "@/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

function planFromPriceId(priceId: string): Plan {
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return "PREMIUM";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  return "FREE";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const plan = planFromPriceId(priceId ?? "");

      await prisma.subscription.upsert({
        where: { stripeCustomerId: sub.customer as string },
        create: {
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status.toUpperCase() as "ACTIVE",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          user: { connect: { id: "will-be-connected-via-metadata" } },
        },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status.toUpperCase() as "ACTIVE",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      }).catch(() => null);

      // Update user plan
      const subscription = await prisma.subscription.findUnique({
        where: { stripeCustomerId: sub.customer as string },
        include: { user: true },
      });
      if (subscription) {
        await prisma.user.update({
          where: { id: subscription.userId },
          data: { plan },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const subscription = await prisma.subscription.findUnique({
        where: { stripeCustomerId: sub.customer as string },
      });
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELED", plan: "FREE" },
        });
        await prisma.user.update({
          where: { id: subscription.userId },
          data: { plan: "FREE" },
        });
      }
      break;
    }

    default:
      // Ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}
