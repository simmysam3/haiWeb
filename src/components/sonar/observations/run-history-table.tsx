'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import type { ColumnPack } from './column-pack';

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

  if (rows.length === 0) {
    return <p className="text-sm text-slate italic">{emptyMessage}</p>;
  }

  const hasWidths = columns.columns.some((c) => c.width);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {hasWidths && (
          <colgroup>
            {columns.columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            {columns.columns.map((c) => (
              <th
                key={c.key}
                className="py-2 pr-3"
                style={{ textAlign: c.align ?? 'left' }}
                title={c.headerTitle}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyFn(row)}
              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              {columns.columns.map((c) => (
                <td
                  key={c.key}
                  className="py-2 pr-3"
                  style={{ textAlign: c.align ?? 'left' }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
