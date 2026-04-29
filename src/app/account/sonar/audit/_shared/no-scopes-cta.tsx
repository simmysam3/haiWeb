import Link from 'next/link';

export function NoScopesCTA({
  context,
}: {
  context: 'dashboard' | 'runs';
}) {
  const copy =
    context === 'dashboard'
      ? 'Audit dashboards are driven by scopes you configure. Add at least one scope to see geographic rollups and gap data here.'
      : 'Runs appear here once you configure a scope and trigger an audit. Start by setting up your first scope.';
  return (
    <div className="rounded-lg border border-slate/15 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-charcoal mb-2">
        Start with a scope
      </h2>
      <p className="text-sm text-slate max-w-md mx-auto mb-6">{copy}</p>
      <Link
        href="/account/sonar/audit/nominations"
        className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-charcoal transition-colors"
      >
        Add your first scope →
      </Link>
    </div>
  );
}
