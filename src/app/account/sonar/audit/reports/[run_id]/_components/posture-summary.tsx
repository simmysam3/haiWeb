import type { PostureSummary as PostureSummaryType } from '@/lib/haiwave-api';

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'compliant' | 'partial' | 'noncompliant' }) {
  const toneClass =
    tone === 'compliant' ? 'text-teal' :
    tone === 'partial' ? 'text-orange' :
    tone === 'noncompliant' ? 'text-problem' :
    'text-charcoal';
  return (
    <div className="rounded-md border border-slate/20 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate">{label}</div>
      <div className={`mt-1 font-display text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}

export function PostureSummary({ summary }: { summary: PostureSummaryType }) {
  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Posture summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Vendors" value={summary.total_vendors} />
        <Stat label="Compliant" value={summary.compliant_count} tone="compliant" />
        <Stat label="Partially compliant" value={summary.partially_compliant_count} tone="partial" />
        <Stat label="Non-compliant" value={summary.non_compliant_count} tone="noncompliant" />
        <Stat label="Products" value={summary.total_products} />
        <Stat label="Gaps" value={summary.total_gaps} />
      </div>
    </section>
  );
}
