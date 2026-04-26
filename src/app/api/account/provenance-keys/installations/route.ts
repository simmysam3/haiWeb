import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import type { InstallationCreationRequest } from '@haiwave/protocol';

export const GET = withHaiCore(async ({ client, request }: { client: HaiwaveClient; request: Request }) => {
  const url = new URL(request.url);
  const includeRemoved = url.searchParams.get('include_removed') === 'true';
  const activeOnly = url.searchParams.get('active_only') === 'true';
  const installations = await client.listMyInstallations(includeRemoved);
  // active_only filters to installations that are not removed. The backend
  // already excludes removed unless include_removed=true is passed, so
  // active_only is effectively the default — we keep the param for forward
  // compatibility with the banner fetch shape.
  const filtered = activeOnly
    ? installations.filter((i) => i.removed_at === null)
    : installations;
  return NextResponse.json({ installations: filtered });
});

export const POST = withHaiCore(async ({ client, request }: { client: HaiwaveClient; request: Request }) => {
  const body = (await request.json()) as InstallationCreationRequest;
  return NextResponse.json(await client.installKey(body));
});
