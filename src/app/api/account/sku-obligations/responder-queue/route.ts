import { withHaiCore } from '@/lib/with-hai-core';
import type { SkuObligationStatus } from '@haiwave/protocol';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.getAll('status') as SkuObligationStatus[];
  const observer_id = sp.getAll('observer_id');
  const product_class = sp.getAll('product_class');
  return client.getResponderQueue({
    status: status.length ? status : undefined,
    observer_id: observer_id.length ? observer_id : undefined,
    product_class: product_class.length ? product_class : undefined,
  });
});
