import { fetchBffJson } from '@/lib/server-fetch';
import type { RunTemplate } from '@haiwave/protocol';

interface DefinitionsPayload {
  templates: RunTemplate[];
}

/**
 * "Has the caller configured any audit templates?" — used by <BacklogTabs />
 * to decide whether to show the "Start here" badge on the Gaps tab for
 * first-run users. Falls back to true on fetch error so the badge stays
 * hidden rather than misleadingly suggesting "you have nothing set up"
 * when in fact we just couldn't reach haiCore.
 *
 * Audit templates only (the BacklogTabs surface is audit-side); watcher
 * and phantom_demand templates are deliberately excluded.
 */
export async function hasAuditScopes(): Promise<boolean> {
  const result = await fetchBffJson<DefinitionsPayload>(
    '/api/account/sonar/audit/definitions',
  );
  if (result.kind !== 'ok') return true;
  return result.data.templates.some((t) => t.observation_class === 'audit');
}
