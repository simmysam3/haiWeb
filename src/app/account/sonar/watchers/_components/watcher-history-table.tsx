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
  /** D-206 — when true, polls the archived list (runs=archive'd on
   * definition delete) instead of the default active list. */
  archived?: boolean;
  emptyMessage?: string;
}

/**
 * Client wrapper around <RunHistoryTable> for the watcher list + definition
 * detail pages. Builds the column pack client-side so the inline render
 * functions don't cross the server→client boundary (see memory:
 * [[haiweb-column-pack-server-client-boundary]]).
 */
export function WatcherHistoryTable({ initialRows, templateId, archived, emptyMessage }: Props) {
  const base = '/api/account/sonar/watcher/runs';
  const params = new URLSearchParams();
  if (templateId) params.set('template_id', templateId);
  if (archived) params.set('archived', 'true');
  const pollEndpoint = `${base}${params.size ? `?${params}` : ''}`;
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
