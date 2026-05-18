'use client';

import Link from 'next/link';
import type { AuditRun } from '@haiwave/protocol';
import { DataTable, type Column } from '@/components';

const columns: Column<AuditRun>[] = [
  {
    key: 'triggered_at',
    label: 'Triggered',
    nowrap: true,
    render: (r) => (
      <Link
        className="text-teal hover:text-navy"
        href={`/account/sonar/audit/runs/${r.run_id}`}
      >
        {new Date(r.triggered_at).toLocaleString()}
      </Link>
    ),
  },
  {
    key: 'products',
    label: 'Products',
    align: 'right',
    nowrap: true,
    render: (r) => r.scope_snapshot.resolved_products.length,
  },
  {
    key: 'gaps',
    label: 'Gaps',
    align: 'right',
    nowrap: true,
    render: (r) => r.gap_count ?? '—',
  },
  {
    key: 'hops',
    label: 'Hops',
    align: 'right',
    nowrap: true,
    render: (r) => r.hop_count ?? '—',
  },
  {
    key: 'duration',
    label: 'Duration',
    align: 'right',
    nowrap: true,
    render: (r) => {
      const ms = r.completed_at
        ? new Date(r.completed_at).getTime() - new Date(r.triggered_at).getTime()
        : null;
      return ms !== null ? `${(ms / 1000).toFixed(1)}s` : '—';
    },
  },
  {
    key: 'status',
    label: 'Status',
    nowrap: true,
    render: (r) => r.status,
  },
];

export function RunsTable({ runs }: { runs: AuditRun[] }) {
  return (
    <DataTable
      columns={columns}
      data={runs}
      keyFn={(r) => r.run_id}
      emptyMessage="No runs yet."
    />
  );
}
