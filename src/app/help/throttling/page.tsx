import Link from 'next/link';

export default function ThrottlingHelpPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-2xl font-semibold text-charcoal">Why am I throttled?</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Hop budgets</h2>
        <p className="text-sm text-slate mt-2">
          Every HAIWAVE participant has an hourly hop budget — the maximum number of
          observation hops your account can consume per hour across all modalities
          (Audit, Watcher, Phantom Demand). The platform default is 5,000 hops/hour.
          When you reach your budget, in-progress runs are paused until your budget
          refreshes at the next hour boundary.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Rate-limited resumable execution</h2>
        <p className="text-sm text-slate mt-2">
          Throttled runs are NOT failures. The system pauses, waits for your hop
          budget to refresh, then resumes the run from where it left off. You don&apos;t
          need to do anything — resumption is automatic.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">The 30-resumption cap</h2>
        <p className="text-sm text-slate mt-2">
          If a single run requires more than 30 resumption cycles to complete, the
          system stops the run and marks it as failed. This is a safeguard against
          runaway scope. If you see a &ldquo;resumption cap reached&rdquo; notification, review
          the scope of your run — it may be too broad — or email{' '}
          <a href="mailto:support@haiwave.ai" className="text-teal hover:underline">
            support@haiwave.ai
          </a>{' '}
          to request a higher limit.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">No-progress detection</h2>
        <p className="text-sm text-slate mt-2">
          If a run resumes but makes no observable progress across several cycles,
          the system stops it as a safety measure. If you see a &ldquo;no progress
          detected&rdquo; notification, contact support.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">How to view your current usage</h2>
        <p className="text-sm text-slate mt-2">
          The{' '}
          <Link href="/account/usage" className="text-teal hover:underline">
            Usage page
          </Link>{' '}
          shows your current-hour consumption, active runs, and a 30-day history of
          throttle events.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Higher limits</h2>
        <p className="text-sm text-slate mt-2">
          Need more headroom? Email{' '}
          <a href="mailto:support@haiwave.ai" className="text-teal hover:underline">
            support@haiwave.ai
          </a>{' '}
          and we&apos;ll get you set up.
        </p>
      </section>
    </article>
  );
}
