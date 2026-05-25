import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/audit/wizard-options — data source for the New Audit
 * wizard's counterparty + SKU pickers (v.1.41 spec restore).
 *
 * Thin proxy over haiCore's GET /audit-scopes/wizard-options. The shape
 * returned is exactly what the pickers consume — flattened (counterparty_id,
 * counterparty_legal_name, product_ids[]) per the auditor's accepted+active
 * audit scopes. Pending/declined/withdrawn/disabled scopes are filtered out
 * server-side, so the picker never surfaces options the trigger gate would
 * reject downstream.
 */
export const GET = withHaiCore(async ({ client }) => {
  const data = await client.getAuditWizardOptions();
  return NextResponse.json(data);
});
