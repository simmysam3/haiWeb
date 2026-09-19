'use client';

import { useState } from 'react';
import { PageHeader, Button } from '@/components';
import { Tabs } from '@/components/tabs';
import { InquiryHistoryTable } from './inquiry-history-table';
import { INQUIRY_NOT_ENABLED_MESSAGE, type InquiryDirection, type InquiryLogRow } from '@/lib/safe-room-types';

interface DirectionState { rows: InquiryLogRow[]; nextCursor: string | null }

export function InquiriesClient({ inbound, outbound, notEnabled, error }: { inbound: DirectionState; outbound: DirectionState; notEnabled: boolean; error: string | null }) {
  const [tab, setTab] = useState<InquiryDirection>('inbound');
  const [state, setState] = useState<Record<InquiryDirection, DirectionState>>({ inbound, outbound });
  const [loadingMore, setLoadingMore] = useState(false);
  const current = state[tab];

  async function loadMore() {
    if (!current.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/account/sonar/inquiries?direction=${tab}&cursor=${encodeURIComponent(current.nextCursor)}`);
      if (!res.ok) return;
      const payload = (await res.json()) as { rows: InquiryLogRow[]; next_cursor: string | null };
      setState((prev) => ({ ...prev, [tab]: { rows: [...prev[tab].rows, ...payload.rows], nextCursor: payload.next_cursor } }));
    } finally {
      setLoadingMore(false);
    }
  }

  const header = <PageHeader title="Inquiry Log" description="Qualified inquiries sent to you and by you — verdicts, commitments, and guard activity. There is no composer here; inquiries are made by your agent." />;

  // PF P15 (Q3): upstream refused the inquiry scope. One fixed state, no table, no pagination.
  if (notEnabled) {
    return (
      <div className="space-y-6">
        {header}
        <p className="rounded-md border border-slate/15 bg-light-gray px-4 py-3 text-sm text-slate">{INQUIRY_NOT_ENABLED_MESSAGE}</p>
      </div>
    );
  }

  const tabs = [{ key: 'inbound', label: 'Inbound', count: state.inbound.rows.length }, { key: 'outbound', label: 'Outbound', count: state.outbound.rows.length }];
  return (
    <div className="space-y-6">
      {header}
      {error && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error}</div>}
      <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as InquiryDirection)} />
      <InquiryHistoryTable rows={current.rows} direction={tab} />
      {current.nextCursor && (
        <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
      )}
    </div>
  );
}
