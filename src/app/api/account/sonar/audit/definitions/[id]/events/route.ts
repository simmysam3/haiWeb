import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { id: string };

// v.1.42 — Proxy for the lifecycle history of an audit-definition template.
// The History step on /account/sonar/audit/definitions/[template_id] reads
// from this endpoint. Returns newest-first events; haiCore enforces owner
// scoping + responds 404 for non-owned/non-existent templates.
export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  return NextResponse.json(await client.listRunTemplateEvents(params.id));
});
