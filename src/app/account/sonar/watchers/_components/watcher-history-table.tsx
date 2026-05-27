'use client';

import { RunHistoryTable } from '@/components/sonar/observations';
import {
  buildWatcherHistoryColumnPack,
  type EnrichedWatcherRun,
} from './watcher-column-packs';

interface Props {
  initialRows: EnrichedWatcherRun[];
  /** When set, scopes the SWR poll to runs from this template so the
   * definition-detail history table doesn't pick up unrelated ad-hoc runs. */
  templateId?: string;
  emptyMessage?: string;
}

/**
 * Client wrapper around <RunHistoryTable> for the watcher list + definition
 * detail pages. Builds the column pack client-side so the inline render
 * functions don't cross the server→client boundary (see memory:
 * [[haiweb-column-pack-server-client-boundary]]).
 */
export function WatcherHistoryTable({ initialRows, templateId, emptyMessage }: Props) {
  const pollEndpoint = templateId
    ? `/api/account/sonar/watcher/runs?template_id=${encodeURIComponent(templateId)}`
    : '/api/account/sonar/watcher/runs';
  return (
    <RunHistoryTable<EnrichedWatcherRun>
      initialRows={initialRows}
      columns={buildWatcherHistoryColumnPack()}
      pollEndpoint={pollEndpoint}
      keyFn={(r) => r.run_id}
      emptyMessage={
        emptyMessage ??
        'No watcher runs yet. Create a watcher and trigger a run, or wait for a scheduled cadence to fire.'
      }
    />
  );
}
