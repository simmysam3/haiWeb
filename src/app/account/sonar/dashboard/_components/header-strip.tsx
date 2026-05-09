import { ThrottledRunsPanel } from '@/components/sonar/throttled-runs-panel';
import { RefreshButton } from './refresh-button';
import { RunAllButton } from './run-all-button';

interface Props {
  totalPartners: number;
  lastRunAt: string | null;
  throttledCounts: { audit: number; type2: number; total: number } | null;
  failedRunsLast30d: number | null;
  enabledTemplateCount?: number;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-charcoal">{value}</div>
    </div>
  );
}

export function HeaderStrip({
  totalPartners,
  lastRunAt,
  throttledCounts,
  failedRunsLast30d,
  enabledTemplateCount = 0,
}: Props) {
  const lastRunDisplay = lastRunAt ? new Date(lastRunAt).toLocaleString() : 'Never';
  const failedDisplay = failedRunsLast30d === null ? '—' : String(failedRunsLast30d);

  return (
    <div className="space-y-4">
      <ThrottledRunsPanel counts={throttledCounts} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total partners observed" value={totalPartners} />
        <Tile label="Last run" value={lastRunDisplay} />
        <Tile
          label="Throttled runs"
          value={throttledCounts === null ? '—' : throttledCounts.total}
        />
        <Tile label="Failed runs (30d)" value={failedDisplay} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <RefreshButton />
        <RunAllButton enabledTemplateCount={enabledTemplateCount} />
      </div>
    </div>
  );
}
