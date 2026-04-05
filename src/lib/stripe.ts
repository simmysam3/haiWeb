/**
 * Stripe client — mock implementation.
 *
 * Only `createCustomer` is wired up today (called from registration).
 * Further Stripe integration (subscriptions, invoices, billing portal) is
 * planned but intentionally omitted until we have real Stripe credentials.
 */

export async function createCustomer(_params: {
  email: string;
  name: string;
  participantId: string;
}): Promise<{ id: string }> {
  return { id: `cus_mock_${Date.now()}` };
}
