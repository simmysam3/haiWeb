import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ResolutionClass } from '@haiwave/protocol';
import type { OnNetworkStatus } from '@/app/account/sonar/compliance/posture/obligations/_lib/types';

export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const resolution_class = sp.getAll('resolution_class') as ResolutionClass[];
  const on_network_status = sp.getAll('on_network_status') as OnNetworkStatus[];
  const min_request_count_raw = sp.get('min_request_count');

  let min_request_count: number | undefined;
  if (min_request_count_raw !== null) {
    // Validate explicitly: a malformed value (e.g. "foo", "1.5", "-3")
    // must fail loudly with 400 instead of being silently dropped, so the
    // caller can fix the URL rather than wonder why their filter has no
    // effect.
    const parsed = Number(min_request_count_raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'min_request_count must be a non-negative integer',
          },
        },
        { status: 400 },
      );
    }
    min_request_count = parsed;
  }

  return client.getDownstreamGaps({
    resolution_class: resolution_class.length ? resolution_class : undefined,
    on_network_status: on_network_status.length ? on_network_status : undefined,
    min_request_count,
  });
});
