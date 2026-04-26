import { cache } from 'react';
import { cookies, headers } from 'next/headers';

/**
 * React.cache so the shared layout and each tab's page can all call this
 * without triggering multiple round-trips within a single request.
 */
export const getVendorName = cache(async (id: string): Promise<string | null> => {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  try {
    const res = await fetch(`${baseUrl}/api/account/company/${id}/profile`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { legal_name?: string; name?: string };
    return data.legal_name ?? data.name ?? null;
  } catch {
    return null;
  }
});
