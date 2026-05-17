import Link from 'next/link';

interface Props {
  averageResponseRate: number | null;
  partnerCount: number;
}

export function PhantomDemandCard({ averageResponseRate, partnerCount }: Props) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-charcoal">Phantom demand health</h2>
        <Link href="/account/sonar/phantom-demand/dashboard" className="text-xs text-teal hover:underline">
          View details →
        </Link>
      </div>
      {averageResponseRate === null ? (
        <p className="text-sm text-slate italic">
          No runs yet —{' '}
          <Link
            href="/account/sonar/templates/new?observation_class=phantom_demand"
            className="not-italic text-teal hover:underline"
          >
            run your first phantom demand probe →
          </Link>
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate">Avg response rate</dt>
            <dd className="text-lg font-semibold text-charcoal">{(averageResponseRate * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Partners probed</dt>
            <dd className="text-lg font-semibold text-charcoal">{partnerCount}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
