import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';
import type { InstallationPatch } from '@haiwave/protocol';

export const PATCH = withHaiCore(async ({ client, request, params }: { client: HaiwaveClient; request: Request; params: { installationId: string } }) => {
  const body = (await request.json()) as InstallationPatch;
  return NextResponse.json(await client.updateInstallation(params.installationId, body));
});

export const DELETE = withHaiCore(async ({ client, params }: { client: HaiwaveClient; params: { installationId: string } }) => {
  return NextResponse.json(await client.removeInstallation(params.installationId));
});
