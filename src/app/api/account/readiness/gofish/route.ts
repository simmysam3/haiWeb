import { withHaiCore } from '@/lib/with-hai-core';
import type { GoFishQueryRequest } from '@haiwave/protocol';

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as GoFishQueryRequest;
  return client.goFishQuery(body);
});
