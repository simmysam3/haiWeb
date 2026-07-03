'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import type { ColumnPack } from './column-pack';
import { ConfigurationsTable } from './configurations-table';

interface Props<TRun> {
  initialRows: TRun[];
  columns: ColumnPack<TRun>;
  pollEndpoint: string;
  /** Stable key extractor — typically `r => r.run_id`. */
  keyFn: (row: TRun) => string;
  /** Italic slate message when no rows. */
  emptyMessage: string;
  /**
   * Optional override for the SWR refresh interval, in milliseconds.
   * Defaults to 15_000 (matches audit page's existing cadence).
   */
  refreshInterval?: number;
  /**
   * Optional response envelope key — defaults to "runs". Lets the watcher
   * BFF return { runs: [...] } and the audit BFF return { runs: [...] }
   * with the same component.
   */
  envelopeKey?: string;
}

export function RunHistoryTable<TRun>({
  initialRows,
  columns,
  pollEndpoint,
  keyFn,
  emptyMessage,
  refreshInterval = 15_000,
  envelopeKey = 'runs',
}: Props<TRun>) {
  const { data, error } = useSWR<Record<string, TRun[]>>(
    pollEndpoint,
    jsonFetcher,
    {
      fallbackData: { [envelopeKey]: initialRows },
      refreshInterval,
    },
  );

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
      >
        Failed to load run history. Check your session and retry.
      </div>
    );
  }

  const rows = (data?.[envelopeKey] ?? []) as TRun[];

  return (
    <ConfigurationsTable rows={rows} columns={columns} keyFn={keyFn} emptyMessage={emptyMessage} />
  );
}
