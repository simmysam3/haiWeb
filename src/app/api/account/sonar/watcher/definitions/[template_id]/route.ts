import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { RunsDispositionSchema, type UpdateRunTemplateRequest } from '@haiwave/protocol';

/**
 * GET/PATCH/DELETE /api/account/sonar/watcher/definitions/[template_id]
 * — v1.43 (Plan 2) BFF mirroring /api/account/sonar/audit/definitions/[id].
 *
 * haiCore's RunTemplate endpoints are observation_class-agnostic. This BFF
 * enforces observation_class='watcher' so audit (or PD) templates can't be
 * guessed into a watcher definition surface via their template_id. Non-watcher
 * templates return 404 even though they exist server-side, matching the same
 * filtering invariant the list route applies.
 */
type RouteParams = Record<string, string> & { template_id: string };

export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  const { template } = await client.getRunTemplate(params.template_id);
  if (!template || template.observation_class !== 'watcher') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ template });
});

export const PATCH = withHaiCore<RouteParams>(async ({ client, request, params }) => {
  const existing = await client.getRunTemplate(params.template_id);
  if (!existing.template || existing.template.observation_class !== 'watcher') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as UpdateRunTemplateRequest;
  return NextResponse.json(await client.updateRunTemplate(params.template_id, body));
});

// v1.85 (2026-09-02): D-206 — ?runs= carries the caller's disposition for the
// template's prior runs (delete | archive | keep). Validated here against the
// closed protocol enum before it ever reaches the haiCore client, which
// interpolates it raw into the request URL.
export const DELETE = withHaiCore<RouteParams>(async ({ client, request, params }) => {
  const existing = await client.getRunTemplate(params.template_id);
  if (!existing.template || existing.template.observation_class !== 'watcher') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const runsRaw = new URL(request.url).searchParams.get('runs') ?? undefined;
  const parsedRuns = RunsDispositionSchema.optional().safeParse(runsRaw);
  if (!parsedRuns.success) {
    return NextResponse.json({ error: 'invalid_runs' }, { status: 400 });
  }
  return NextResponse.json(await client.deleteRunTemplate(params.template_id, { runs: parsedRuns.data }));
});
