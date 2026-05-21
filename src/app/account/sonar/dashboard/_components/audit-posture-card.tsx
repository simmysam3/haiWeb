import Link from 'next/link';

interface Props {
  totalCompliant: number;
  totalNonCompliant: number;
  totalPartial: number;
}

export function AuditPostureCard({ totalCompliant, totalNonCompliant, totalPartial }: Props) {
  const total = totalCompliant + totalNonCompliant + totalPartial;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-charcoal">Compliance posture</h2>
        <Link href="/account/sonar/posture/working-list" className="text-xs text-teal hover:underline">
          View details →
        </Link>
      </div>
      {total === 0 ? (
        <p className="text-sm text-slate italic">
          No runs yet —{' '}
          <Link
            href="/account/sonar/templates/new?observation_class=audit"
            className="not-italic text-teal hover:underline"
          >
            start your first audit →
          </Link>
        </p>
      ) : (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate">Compliant</dt>
            <dd className="text-lg font-semibold text-emerald-700">{totalCompliant}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Partial</dt>
            <dd className="text-lg font-semibold text-amber-700">{totalPartial}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Non-compliant</dt>
            <dd className="text-lg font-semibold text-rose-700">{totalNonCompliant}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
