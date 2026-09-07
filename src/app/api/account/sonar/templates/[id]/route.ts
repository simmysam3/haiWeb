import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { RunsDispositionSchema, type UpdateRunTemplateRequest } from '@haiwave/protocol';

type RouteParams = Record<string, string> & { id: string };

export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  return NextResponse.json(await client.getRunTemplate(params.id));
});

export const PATCH = withHaiCore<RouteParams>(async ({ client, request, params }) => {
  const body = (await request.json().catch(() => ({}))) as UpdateRunTemplateRequest;
  return NextResponse.json(await client.updateRunTemplate(params.id, body));
}, { role: 'account_admin' });

// v1.85 (2026-09-02): D-206 — ?runs= carries the caller's disposition for the
// template's prior runs (delete | archive | keep). Validated here against the
// closed protocol enum before it ever reaches the haiCore client, which
// interpolates it raw into the request URL.
export const DELETE = withHaiCore<RouteParams>(async ({ client, request, params }) => {
  const runsRaw = new URL(request.url).searchParams.get('runs') ?? undefined;
  const parsedRuns = RunsDispositionSchema.optional().safeParse(runsRaw);
  if (!parsedRuns.success) {
    return NextResponse.json({ error: 'invalid_runs' }, { status: 400 });
  }
  return NextResponse.json(await client.deleteRunTemplate(params.id, { runs: parsedRuns.data }));
}, { role: 'account_admin' });
