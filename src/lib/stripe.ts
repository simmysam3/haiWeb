/**
 * Stripe client configuration.
 *
 * Stripe objects mapping:
 * - Participant → Stripe Customer (participant_id in metadata)
 * - Platform fee → Subscription (annual, $10,000/year)
 * - Connection fees → Subscription (monthly, metered, tiered)
 *
 * Billing lifecycle:
 * 1. Registration: Customer + platform Subscription created
 * 2. First trading pair: metered connection Subscription created
 * 3. Monthly: BFF reports active pair count via Usage Records
 * 4. Annual: Stripe auto-renews platform subscription
 */

// TODO: Initialize Stripe client with STRIPE_SECRET_KEY
// TODO: Customer creation helper
// TODO: Subscription creation (platform fee, connection fee)
// TODO: Usage record reporting for metered billing
// TODO: Webhook signature verification
// TODO: Invoice retrieval for billing history
