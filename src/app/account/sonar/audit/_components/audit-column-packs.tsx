import Link from 'next/link';
import { Pill } from '@/components/pill';
import { formatCadence } from '@/components/sonar/observations';
import type { ColumnPack } from '@/components/sonar/observations';
import type { RunTemplate } from '@haiwave/protocol';

type AuditTemplate = Extract<RunTemplate, { observation_class: 'audit' }>;

function formatScope(scope: AuditTemplate['scope']): string {
  const parts: string[] = [`depth ${scope.depth_limit}`];
  parts.push(scope.authorization_basis === 'key_scoped' ? 'key-scoped' : 'bilateral');
  return parts.join(' · ');
}

function formatNextFire(t: AuditTemplate): string {
  if (t.cadence.kind === 'manual_only') return '—';
  // The BFF does not return next_scheduled_at; surface the cadence description
  // as a proxy so users understand when the next fire will be.
  return formatCadence(t.cadence);
}

export const auditConfigurationsColumnPack: ColumnPack<AuditTemplate> = {
  // Widths match the historical scheduled-queue/history-queue grid so the two
  // tables stay vertically aligned column-for-column on the audit page.
  columns: [
    {
      key: 'name',
      label: 'Name',
      width: '26%',
      render: (row) => (
        <Link
          href={`/account/sonar/audit/definitions/${row.template_id}`}
          className="text-teal hover:underline font-medium"
        >
          {row.template_name}
        </Link>
      ),
    },
    {
      key: 'cadence',
      label: 'Cadence',
      width: '14%',
      render: (row) => (
        <span className="text-charcoal">{formatCadence(row.cadence)}</span>
      ),
    },
    {
      key: 'next_fire',
      label: 'Next fire',
      width: '16%',
      render: (row) => (
        <span className="text-slate text-xs">{formatNextFire(row)}</span>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      width: '14%',
      render: (row) => (
        <span className="text-slate text-xs">{formatScope(row.scope)}</span>
      ),
    },
    {
      // Placeholder cell — keeps the column count aligned with the runs
      // table; templates have no domestic-resolution indicator.
      key: 'placeholder',
      label: '',
      width: '12%',
      render: () => null,
    },
    {
      key: 'status',
      label: 'Status',
      width: '10%',
      render: (row) => (
        <Pill category="status" value={row.enabled ? 'enabled' : 'disabled'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8%',
      render: (row) => (
        <Link
          href={`/account/sonar/audit/definitions/${row.template_id}`}
          className="text-xs text-teal hover:underline"
        >
          Edit
        </Link>
      ),
    },
  ],
};
