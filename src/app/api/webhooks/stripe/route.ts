import { NextRequest, NextResponse } from "next/server";
import { loadEnv } from "@/config/env";
import { verifyStripeSignature } from "@/lib/stripe-webhook";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver. The Stripe-Signature header is verified against the
 * webhook signing secret over the RAW body before the event is trusted, so an
 * unauthenticated caller cannot forge billing events. Fails closed: a missing,
 * malformed, or unverifiable signature (including an unconfigured secret) is
 * rejected with 400 and never processed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = loadEnv().STRIPE_WEBHOOK_SECRET;

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type ?? "unknown"}`);
  return NextResponse.json({ received: true });
}
