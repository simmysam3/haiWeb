import { getActiveScopes } from '../../_lib/scopes';
import { NoScopesCTA } from '../../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../../_shared/scopes-error-banner';
import { ScopeEntryForm } from './scope-entry-form';
import { Panel } from '@/components';

export default async function Page() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return <div className="p-6"><ScopesErrorBanner status={scopesResult.status} /></div>;
  }
  if (scopesResult.scopes.length === 0) {
    return <div className="p-6"><NoScopesCTA context="dashboard" /></div>;
  }
  return (
    <div className="p-6 space-y-6">
      <Panel className="p-4">
        <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-2">
          Compose an Evidence Response
        </h2>
        <p className="text-sm text-slate mb-3">
          An Evidence Response is an episodic compliance document you produce on
          demand for a counterparty audit, regulator request, or one-off
          inquiry. Unlike Posture (which tracks coverage continuously), each
          Evidence Response is scoped, dispatched once, and persisted as an
          immutable artifact in the Response Log.
        </p>
        <ol className="text-sm text-slate space-y-1 list-decimal list-inside">
          <li>
            <span className="font-medium text-navy">Scope</span>
            {' '}— pick the counterparty and products this response covers.
          </li>
          <li>
            <span className="font-medium text-navy">Dispatch</span>
            {' '}— choose cached evidence from a recent compliance audit, or trigger a fresh run.
          </li>
          <li>
            <span className="font-medium text-navy">Review</span>
            {' '}— inspect the tree, annotate per node, attest origin entries.
          </li>
          <li>
            <span className="font-medium text-navy">Export</span>
            {' '}— render to PDF / HTML / JSON. The exported document is hash-pinned and saved to the Response Log.
          </li>
        </ol>
      </Panel>
      <ScopeEntryForm />
    </div>
  );
}
