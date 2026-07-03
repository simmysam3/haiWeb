import { cache } from 'react';
import { fetchBffJson } from '@/lib/server-fetch';

/**
 * React.cache so the shared layout and each tab's page can all call this
 * without triggering multiple round-trips within a single request.
 */
export const getVendorName = cache(async (id: string): Promise<string | null> => {
  const result = await fetchBffJson<{ legal_name?: string; name?: string }>(
    `/api/account/company/${id}/profile`,
  );
  if (result.kind === 'error') return null;
  return result.data.legal_name ?? result.data.name ?? null;
});
