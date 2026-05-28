import Link from 'next/link';
import { Pill } from '@/components/pill';
import {
  formatCadence,
  formatRelative,
  formatRunLabel,
} from '@/components/sonar/observations';
import type { ColumnPack } from '@/components/sonar/observations';
import type { AuditRun, RunTemplate } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from '../_lib/country-flags';

type AuditTemplate = Extract<RunTemplate, { observation_class: 'audit' }>;

// Enriched shape returned by the list BFF (template_id → name join is added
// by HaiWeb; total_skus and fully_resolved_skus_by_country come straight off
// the protocol envelope).
export type EnrichedAuditRun = AuditRun & {
  template_name?: string;
};

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

function formatScopeSnapshot(run: AuditRun): string {
  const parts: string[] = [`depth ${run.depth_limit}`];
  // Key-scoped runs pin provenance_key_id on the scope snapshot.
  if (run.scope_snapshot?.provenance_key_id) {
    parts.push('key-scoped');
  } else {
    parts.push('bilateral');
  }
  return parts.join(' · ');
}

/**
 * Build the audit history column pack. Takes auditor_country as an argument
 * because the Domestic column needs the participant's home-country code to
 * pick the correct flag — that value lives on the runs response envelope
 * and is read at render time on the page.
 */
export function buildAuditHistoryColumnPack(
  auditorCountry: string | undefined,
): ColumnPack<EnrichedAuditRun> {
  const FlagComponent = auditorCountry ? FLAG_COMPONENTS[auditorCountry] : undefined;
  return {
    // Widths mirror auditConfigurationsColumnPack so the two tables align
    // vertically column-for-column on the audit page.
    columns: [
      {
        key: 'name',
        label: 'Name',
        width: '26%',
        render: (run) => (
          <Link
            href={`/account/sonar/audit/${run.run_id}`}
            className="text-teal hover:underline font-medium"
          >
            {formatRunLabel(run)}
          </Link>
        ),
      },
      {
        key: 'source',
        label: 'Source',
        width: '14%',
        render: (run) =>
          run.run_origin ? (
            <Pill category="run_origin" value={run.run_origin} />
          ) : (
            <span className="text-slate text-xs">—</span>
          ),
      },
      {
        key: 'run_at',
        label: 'Run at',
        width: '16%',
        render: (run) => (
          <span
            className="text-slate text-xs"
            title={new Date(run.triggered_at).toLocaleString()}
          >
            {formatRelative(run.triggered_at)}
          </span>
        ),
      },
      {
        key: 'scope',
        label: 'Scope',
        width: '14%',
        render: (run) => (
          <span className="text-slate text-xs">{formatScopeSnapshot(run)}</span>
        ),
      },
      {
        key: 'domestic',
        label: 'Domestic',
        width: '12%',
        headerTitle:
          'SKUs whose components fully resolved to your home country / total SKUs in the run',
        render: (run) => {
          const total = run.total_skus ?? null;
          if (total == null || total === 0) {
            return <span className="text-slate">—</span>;
          }
          const domestic = auditorCountry
            ? run.fully_resolved_skus_by_country?.[auditorCountry] ?? 0
            : 0;
          return (
            <span
              className="inline-flex items-center gap-1.5 text-charcoal"
              title={
                auditorCountry
                  ? `${domestic} of ${total} SKUs fully resolved as ${auditorCountry}-origin`
                  : `${total} SKUs (auditor country unknown)`
              }
            >
              {FlagComponent && (
                <FlagComponent className="h-3 w-auto rounded-sm shadow-sm" />
              )}
              <span className="font-mono">
                {domestic}/{total}
              </span>
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (run) => (
          <Pill
            category="run_status"
            value={run.status}
            detail={run.error_message ?? undefined}
          />
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '8%',
        render: (run) => (
          <Link
            href={`/account/sonar/audit/${run.run_id}`}
            className="text-xs text-teal hover:underline"
          >
            Open
          </Link>
        ),
      },
    ],
  };
}
