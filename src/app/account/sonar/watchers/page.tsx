import Link from 'next/link';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { ConfigurationsTable } from '@/components/sonar/observations';
import { NeedsTriageStrip } from './_components/needs-triage-strip';
import { watcherConfigurationsColumnPack } from './_components/watcher-column-packs';
import { WatcherHistoryTable } from './_components/watcher-history-table';
import type { RunTemplate, WatcherRun } from '@haiwave/protocol';

interface DefinitionsPayload {
  templates: RunTemplate[];
}
interface RunsPayload {
  runs: WatcherRun[];
}

type WatcherTemplate = Extract<RunTemplate, { observation_class: 'watcher' }>;
function isWatcherTemplate(t: RunTemplate): t is WatcherTemplate {
  return t.observation_class === 'watcher';
}

export default async function WatchersListPage() {
  const [defsResult, runsResult] = await Promise.all([
    fetchBffJson<DefinitionsPayload>('/api/account/sonar/watcher/definitions'),
    fetchBffJson<RunsPayload>('/api/account/sonar/watcher/runs'),
  ]);

  const allDefinitions = defsResult.kind === 'ok' ? defsResult.data.templates : [];
  const runs = runsResult.kind === 'ok' ? runsResult.data.runs : [];
  const watcherTemplates = allDefinitions.filter(isWatcherTemplate);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Watchers"
        description={
          <>
            <strong className="text-charcoal">Supply-chain resilience monitoring.</strong>{' '}
            Continuous drift detection across your trading network. Schedule recurring sweeps
            or fire ad-hoc checks; the triage strip surfaces configs needing immediate
            attention, while gap-tier scores drive your long-arc vendor curation.
          </>
        }
        actions={
          <Link
            href="/account/sonar/watchers/new"
            className="shrink-0 whitespace-nowrap rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
          >
            + New Watcher
          </Link>
        }
      />

      <NeedsTriageStrip />

      {defsResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load watcher configurations (
          {defsResult.status !== 0 ? `HTTP ${defsResult.status}` : 'network error'}). Configurations
          list may be incomplete.
        </div>
      )}

      <section aria-labelledby="watcher-configs-heading" className="space-y-3">
        <h2
          id="watcher-configs-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Configurations
        </h2>
        <ConfigurationsTable
          rows={watcherTemplates}
          columns={watcherConfigurationsColumnPack}
          keyFn={(t) => t.template_id}
          emptyMessage="No watcher configurations yet. Create one to start monitoring vendor signals."
        />
      </section>

      {runsResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load run history (
          {runsResult.status !== 0 ? `HTTP ${runsResult.status}` : 'network error'}). History may
          be incomplete.
        </div>
      )}

      <section aria-labelledby="watcher-history-heading" className="space-y-3">
        <h2
          id="watcher-history-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Watcher history
        </h2>
        <WatcherHistoryTable initialRows={runs} />
      </section>
    </div>
  );
}
