'use client';

import Link from 'next/link';
import type { EvidenceResponseListItem } from '@haiwave/protocol';
import { DataTable, type Column } from '@/components';

export function ResponsesTable({ rows }: { rows: EvidenceResponseListItem[] }) {
  const columns: Column<EvidenceResponseListItem>[] = [
    {
      key: 'response_id',
      label: 'Response ID',
      render: (r) => (
        <Link
          href={`/account/sonar/requests/evidence/responses/${r.response_id}`}
          className="text-teal hover:text-navy font-mono text-xs"
        >
          {r.response_id}
        </Link>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      render: (r) => (
        <span className="text-xs text-slate">
          {r.scope_shape} · {r.sku_count} SKU(s)
        </span>
      ),
    },
    {
      key: 'recipient',
      label: 'Recipient',
      render: (r) => (
        <span className="text-xs">
          {r.recipient_name} · <span className="text-slate">{r.recipient_type}</span>
        </span>
      ),
    },
    {
      key: 'exported_at',
      label: 'Exported',
      render: (r) => (
        <span className="text-xs text-slate whitespace-nowrap">
          {new Date(r.exported_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'document_hash',
      label: 'Hash',
      render: (r) => (
        <span className="font-mono text-xs text-slate" title={r.document_hash}>
          {r.document_hash.slice(0, 12)}…
        </span>
      ),
    },
    {
      key: 'download',
      label: 'Download',
      render: (r) => (
        <a
          href={`/api/account/sonar/compliance/evidence/responses/${r.response_id}/document?format=pdf`}
          download
          className="text-xs text-teal hover:text-navy font-medium"
        >
          PDF
        </a>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      keyFn={(r) => r.response_id}
      emptyMessage={
        <span className="text-sm text-slate">No evidence responses yet.</span>
      }
    />
  );
}
