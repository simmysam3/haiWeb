'use client';

import { RunHistoryTable } from '@/components/sonar/observations';
import {
  buildAuditHistoryColumnPack,
  type EnrichedAuditRun,
} from './audit-column-packs';

interface Props {
  initialRows: EnrichedAuditRun[];
  auditorCountry: string | undefined;
}

/**
 * Client wrapper around <RunHistoryTable> for the audit page. Owns the
 * column-pack construction here (rather than on the server) so the render
 * functions don't have to cross the server→client boundary as props — Next.js
 * 16 refuses to serialize functions through Client Component props.
 */
export function AuditHistoryTable({ initialRows, auditorCountry }: Props) {
  return (
    <RunHistoryTable<EnrichedAuditRun>
      initialRows={initialRows}
      columns={buildAuditHistoryColumnPack(auditorCountry)}
      pollEndpoint="/api/account/sonar/audit/runs"
      keyFn={(r) => r.run_id}
      emptyMessage='No audit runs yet. Trigger a run from a configuration or use the "+ New Audit" action above.'
    />
  );
}
