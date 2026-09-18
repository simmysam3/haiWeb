'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { TRUST_CLASS_LABEL } from '@/app/account/sonar/posture/trust-bypass/_components/trust-class-label';
import type { InquiryDirection, InquiryLogRow } from '@/lib/safe-room-types';

export function InquiryHistoryTable({ rows, direction }: { rows: InquiryLogRow[]; direction: InquiryDirection }) {
  const columns: Column<InquiryLogRow>[] = [
    { key: 'requester', label: 'Requester', render: (r) => r.requester_participant_id },
    { key: 'subject', label: 'Subject', render: (r) => `${r.subjects.length} subject${r.subjects.length === 1 ? '' : 's'}` },
    { key: 'attribute', label: 'Attribute', render: (r) => r.attribute_class_id },
    { key: 'tier', label: 'Tier', render: (r) => TRUST_CLASS_LABEL[r.tier_at_request] },
    { key: 'status', label: 'Status', render: (r) => r.status },
    // PF P20: a dispatched or pending row carries no outcome.
    { key: 'outcome', label: 'Outcome', render: (r) => (r.outcome ? <StatusBadge status={r.outcome} /> : '—') },
    { key: 'commitment', label: 'Commitment', render: (r) => r.commitment_id ?? '—' },
    // PF P21: a 0/1 indicator, and 0 on every outbound row by construction — so it is inbound-only.
    ...(direction === 'inbound'
      ? [{ key: 'guard', label: 'Guard trip', render: (r: InquiryLogRow) => (r.guard_trip_count ? 'Yes' : 'No') } as Column<InquiryLogRow>]
      : []),
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Link
          href={`/account/sonar/inquiries/${r.inquiry_id}`}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:text-navy"
        >
          View
          <DetailChevron />
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} keyFn={(r) => r.inquiry_id} emptyMessage="No inquiries." />;
}
