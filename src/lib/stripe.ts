/**
 * Stripe client — mock implementation.
 *
 * Returns mock data for all billing operations. Wire to real Stripe later.
 *
 * Stripe objects mapping:
 * - Participant -> Stripe Customer (participant_id in metadata)
 * - Platform fee -> Subscription (annual, $10,000/year)
 * - Connection fees -> Subscription (monthly, metered, tiered)
 */

import { MOCK_INVOICES } from "./mock-data";

export async function createCustomer(_params: {
  email: string;
  name: string;
  participantId: string;
}): Promise<{ id: string }> {
  return { id: `cus_mock_${Date.now()}` };
}

export async function createSubscription(_params: {
  customerId: string;
  priceId: string;
}): Promise<{ id: string; status: string }> {
  return { id: `sub_mock_${Date.now()}`, status: "active" };
}

export async function getInvoices(_customerId: string): Promise<typeof MOCK_INVOICES> {
  return MOCK_INVOICES;
}

export async function getSubscription(_subscriptionId: string): Promise<{
  id: string;
  status: string;
  current_period_end: number;
  plan: { amount: number; interval: string };
}> {
  return {
    id: "sub_mock_platform",
    status: "active",
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 365,
    plan: { amount: 1000000, interval: "year" },
  };
}

export async function createPortalSession(_customerId: string): Promise<{ url: string }> {
  return { url: "#stripe-portal-mock" };
}
