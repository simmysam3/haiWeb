'use client';

import { RunHistoryTable } from '@/components/sonar/observations';
import {
  buildAuditHistoryColumnPack,
  type EnrichedAuditRun,
} from './audit-column-packs';

interface Props {
  initialRows: EnrichedAuditRun[];
  auditorCountry: string | undefined;
  /** v1.85 — when set, the poll is scoped to this audit's runs (definition page). */
  templateId?: string;
  emptyMessage?: string;
}

/**
 * Client wrapper around <RunHistoryTable> for the audit list and definition
 * pages. Owns the column-pack construction here (rather than on the server)
 * so the render functions don't have to cross the server→client boundary as
 * props — Next.js 16 refuses to serialize functions through Client Component
 * props.
 */
export function AuditHistoryTable({ initialRows, auditorCountry, templateId, emptyMessage }: Props) {
  const pollEndpoint = templateId
    ? `/api/account/sonar/audit/runs?template_id=${encodeURIComponent(templateId)}`
    : '/api/account/sonar/audit/runs';
  return (
    <RunHistoryTable<EnrichedAuditRun>
      initialRows={initialRows}
      columns={buildAuditHistoryColumnPack(auditorCountry)}
      pollEndpoint={pollEndpoint}
      keyFn={(r) => r.run_id}
      emptyMessage={
        emptyMessage ??
        'No audit runs yet. Trigger a run from a configuration or use the "+ New Audit" action above.'
      }
    />
  );
}
