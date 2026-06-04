'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/data-table';
import { RiskTierPills } from './risk-tier-pills';
import { DetailChevron } from '@/components/sonar/observations';
import type { RegistrationListItem } from '@/lib/registration-types';

interface Props {
  rows: RegistrationListItem[];
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/**
 * Client-side table adapter for the registration holding-pen queue.
 *
 * The ColumnPack is built HERE (inside the `'use client'` component) — its
 * `render` closures cannot cross the RSC→client boundary, so the RSC page
 * passes only plain `rows` data and this component owns the column shape.
 */
export function RegistrationsTable({ rows }: Props) {
  const columns: Column<RegistrationListItem>[] = [
    {
      key: 'legal_entity_name',
      label: 'Legal entity',
      render: (r) => <span className="font-medium text-navy">{r.legal_entity_name}</span>,
    },
    {
      key: 'country_of_origin',
      label: 'Country',
      render: (r) => <span className="tabular-nums">{r.country_of_origin}</span>,
      nowrap: true,
    },
    {
      key: 'risk_tier',
      label: 'Risk tier',
      render: (r) => <RiskTierPills tier={r.risk_tier} />,
      nowrap: true,
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (r) => <span className="text-slate">{formatSubmitted(r.submitted_at)}</span>,
      nowrap: true,
    },
    {
      key: 'detail',
      label: '',
      align: 'right',
      nowrap: true,
      render: (r) => (
        <Link
          href={`/account/admin/registrations/${r.id}`}
          aria-label={`Review registration for ${r.legal_entity_name}`}
          className="group inline-flex"
        >
          <DetailChevron />
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      keyFn={(r) => r.id}
      emptyMessage="No pending registration requests."
    />
  );
}
