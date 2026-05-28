import Link from 'next/link';
import { Pill } from '@/components/pill';
import {
  DetailChevron,
  formatCadence,
  formatRelative,
  formatRunLabel,
} from '@/components/sonar/observations';
import type { ColumnPack } from '@/components/sonar/observations';
import type { RunTemplate, SignalType, WatcherRun } from '@haiwave/protocol';

type WatcherTemplate = Extract<RunTemplate, { observation_class: 'watcher' }>;

export type EnrichedWatcherRun = WatcherRun & {
  template_name?: string | null;
};

// v.1.43 Plan 3 Task E4 — signal_type → short chip label. Mirrors the
// abbreviations registered in `pill.tsx` (PILL_DEFINITIONS.signal_type) and
// the picker pills in <WatcherScopePicker>. Exhaustive over SignalType so
// adding a new protocol enum value forces a label update at compile time.
const SIGNAL_TYPE_CHIP_LABELS: Record<SignalType, string> = {
  lead_time_distribution: 'LT',
  capacity_utilization_band: 'CAP',
  delivery_event: 'DEL',
  published_lead_time: 'PLT',
  quoted_lead_time: 'QLT',
};

// When a scope/run carries this many or more signal types, render a single
// "N signals" count with a tooltip listing them instead of N individual
// chips. Keeps the table cell compact at the wide end of the signal-type
// catalogue (currently 5).
const SIGNAL_CHIP_COLLAPSE_THRESHOLD = 4;

function signalChipLabel(sig: SignalType): string {
  return SIGNAL_TYPE_CHIP_LABELS[sig] ?? sig;
}

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

function renderSignalChips(signalTypes: readonly SignalType[]) {
  if (signalTypes.length >= SIGNAL_CHIP_COLLAPSE_THRESHOLD) {
    const labels = signalTypes.map(signalChipLabel).join(', ');
    return (
      <span
        className="text-xs text-slate"
        title={labels}
      >
        {signalTypes.length} signals
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {signalTypes.map((sig) => (
        <Pill key={sig} category="signal_type" value={signalChipLabel(sig)} />
      ))}
    </span>
  );
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
          aria-label={`Edit ${row.template_name}`}
          className="group inline-flex"
        >
          <DetailChevron />
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
        render: (run) => renderSignalChips(run.signal_types),
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
            aria-label={`Open ${formatRunLabel(run)}`}
            className="group inline-flex"
          >
            <DetailChevron />
          </Link>
        ),
      },
    ],
  };
}
