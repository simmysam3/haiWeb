import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') as 'audit' | 'watcher' | 'phantom_demand' | null;
  if (!tab) {
    return NextResponse.json({ error: 'tab querystring required' }, { status: 400 });
  }
  const result = await client.listReports({
    tab,
    status: url.searchParams.get('status') ?? undefined,
    date_from: url.searchParams.get('date_from') ?? undefined,
    date_to: url.searchParams.get('date_to') ?? undefined,
  });
  return NextResponse.json(result);
});
