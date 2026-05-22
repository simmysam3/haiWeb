import Link from 'next/link';
import { Pill } from '@/components/pill';
import { formatCadence } from '../../templates/_lib/format-cadence';
import type { RunTemplate } from '@haiwave/protocol';

interface Props {
  rows: RunTemplate[];
}

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

function isAuditTemplate(t: RunTemplate): t is AuditTemplate {
  return t.observation_class === 'audit';
}

export function ScheduledQueue({ rows }: Props) {
  const auditRows = rows.filter(isAuditTemplate);

  if (auditRows.length === 0) {
    return (
      <p className="text-sm text-slate italic">
        No recurring audit configurations. Create a configuration and set a
        daily, weekly, or event-triggered cadence to see it here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {/* Shared 6-col grid — kept identical to history-queue for vertical alignment */}
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Cadence</th>
            <th className="py-2 pr-3">Next fire</th>
            <th className="py-2 pr-3">Scope</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {auditRows.map((row) => (
            <tr
              key={row.template_id}
              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              <td className="py-2 pr-3">
                <Link
                  href={`/account/sonar/audit/definitions/${row.template_id}`}
                  className="text-teal hover:underline font-medium"
                >
                  {row.template_name}
                </Link>
              </td>
              <td className="py-2 pr-3 text-charcoal">
                {formatCadence(row.cadence)}
              </td>
              <td className="py-2 pr-3 text-slate text-xs">
                {formatNextFire(row)}
              </td>
              <td className="py-2 pr-3 text-slate text-xs">
                {formatScope(row.scope)}
              </td>
              <td className="py-2 pr-3">
                <Pill
                  category="status"
                  value={row.enabled ? 'enabled' : 'disabled'}
                />
              </td>
              <td className="py-2">
                <Link
                  href={`/account/sonar/audit/definitions/${row.template_id}`}
                  className="text-xs text-teal hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
