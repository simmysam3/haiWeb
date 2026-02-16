import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler for billing events.
 * Accepts webhook, logs event type, returns 200 (no real processing yet).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body?.type ?? "unknown";

    // Log the event for now
    console.log(`[Stripe Webhook] Received event: ${eventType}`);

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }
}
