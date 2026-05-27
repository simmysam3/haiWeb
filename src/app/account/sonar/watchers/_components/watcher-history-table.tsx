'use client';

import { RunHistoryTable } from '@/components/sonar/observations';
import {
  buildWatcherHistoryColumnPack,
  type EnrichedWatcherRun,
} from './watcher-column-packs';

interface Props {
  initialRows: EnrichedWatcherRun[];
}

/**
 * Client wrapper around <RunHistoryTable> for the watcher list + definition
 * detail pages. Builds the column pack client-side so the inline render
 * functions don't cross the server→client boundary (see memory:
 * [[haiweb-column-pack-server-client-boundary]]).
 */
export function WatcherHistoryTable({ initialRows }: Props) {
  return (
    <RunHistoryTable<EnrichedWatcherRun>
      initialRows={initialRows}
      columns={buildWatcherHistoryColumnPack()}
      pollEndpoint="/api/account/sonar/watcher/runs"
      keyFn={(r) => r.run_id}
      emptyMessage='No watcher runs yet. Create a watcher and trigger a run, or wait for a scheduled cadence to fire.'
    />
  );
}
