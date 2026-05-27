import Link from 'next/link';
import { Pill } from '@/components/pill';
import {
  formatCadence,
  formatRelative,
  formatRunLabel,
} from '@/components/sonar/observations';
import type { ColumnPack } from '@/components/sonar/observations';
import type { RunTemplate, WatcherRun } from '@haiwave/protocol';

type WatcherTemplate = Extract<RunTemplate, { observation_class: 'watcher' }>;

export type EnrichedWatcherRun = WatcherRun & {
  template_name?: string;
};

function formatWatcherScope(scope: WatcherTemplate['scope']): string {
  const parts: string[] = [`depth ${scope.depth_limit}`];
  parts.push(`${scope.signal_types.length} signals`);
  parts.push(`${scope.skus.length || scope.counterparties.length} components`);
  return parts.join(' · ');
}

function formatScopeSnapshot(run: WatcherRun): string {
  const parts: string[] = [`depth ${run.depth_limit}`];
  parts.push(`${run.signal_types.length} signals`);
  return parts.join(' · ');
}

function lifespanLabel(template: WatcherTemplate): string {
  if (template.cadence.kind === 'manual_only') {
    return template.retention_days
      ? `Manual · expires in ${template.retention_days}d`
      : 'Manual · until cancelled';
  }
  return template.retention_days
    ? `${formatCadence(template.cadence)} · expires in ${template.retention_days}d`
    : formatCadence(template.cadence);
}

export const watcherConfigurationsColumnPack: ColumnPack<WatcherTemplate> = {
  columns: [
    {
      key: 'name',
      label: 'Name',
      width: '26%',
      render: (row) => (
        <Link
          href={`/account/sonar/watchers/definitions/${row.template_id}`}
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
        <span className="text-charcoal">{lifespanLabel(row)}</span>
      ),
    },
    {
      key: 'next_fire',
      label: 'Next fire',
      width: '16%',
      render: (row) => (
        <span className="text-slate text-xs">
          {row.cadence.kind === 'manual_only' ? '—' : formatCadence(row.cadence)}
        </span>
      ),
    },
    {
      key: 'scope',
      label: 'Scope',
      width: '14%',
      render: (row) => (
        <span className="text-slate text-xs">{formatWatcherScope(row.scope)}</span>
      ),
    },
    {
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
          href={`/account/sonar/watchers/definitions/${row.template_id}`}
          className="text-xs text-teal hover:underline"
        >
          Edit
        </Link>
      ),
    },
  ],
};

export function buildWatcherHistoryColumnPack(): ColumnPack<EnrichedWatcherRun> {
  return {
    columns: [
      {
        key: 'name',
        label: 'Name',
        width: '26%',
        render: (run) => (
          <Link
            href={`/account/sonar/watchers/${run.run_id}`}
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
        key: 'signals',
        label: 'Signals',
        width: '12%',
        render: (run) => (
          <span className="inline-flex items-center gap-1">
            {run.signal_types.includes('lead_time_distribution') && (
              <Pill category="signal_type" value="LT" />
            )}
            {run.signal_types.includes('capacity_utilization_band') && (
              <Pill category="signal_type" value="CAP" />
            )}
            {run.signal_types.includes('delivery_event') && (
              <Pill category="signal_type" value="DEL" />
            )}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (run) => <Pill category="run_status" value={run.status} />,
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '8%',
        render: (run) => (
          <Link
            href={`/account/sonar/watchers/${run.run_id}`}
            className="text-xs text-teal hover:underline"
          >
            Open
          </Link>
        ),
      },
    ],
  };
}
