import { fetchBffJson } from '@/lib/server-fetch';
import { InquiriesClient } from './_components/inquiries-client';
import type { InquiryListResponse } from '@/lib/safe-room-types';

export default async function InquiriesPage() {
  const [inboundRes, outboundRes] = await Promise.all([
    fetchBffJson<InquiryListResponse>('/api/account/sonar/inquiries?direction=inbound'),
    fetchBffJson<InquiryListResponse>('/api/account/sonar/inquiries?direction=outbound'),
  ]);
  const inbound = inboundRes.kind === 'ok' ? inboundRes.data : { rows: [], next_cursor: null };
  const outbound = outboundRes.kind === 'ok' ? outboundRes.data : { rows: [], next_cursor: null };
  const error = inboundRes.kind === 'error' ? inboundRes.message : outboundRes.kind === 'error' ? outboundRes.message : null;
  // PF P15: either direction being scope-refused means the surface is off for this console.
  const notEnabled = Boolean(('not_enabled' in inbound && inbound.not_enabled) || ('not_enabled' in outbound && outbound.not_enabled));
  return (
    <InquiriesClient
      inbound={{ rows: inbound.rows, nextCursor: inbound.next_cursor }}
      outbound={{ rows: outbound.rows, nextCursor: outbound.next_cursor }}
      notEnabled={notEnabled}
      error={error}
    />
  );
}
