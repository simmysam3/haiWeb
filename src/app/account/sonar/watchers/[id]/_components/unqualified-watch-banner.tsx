import Link from 'next/link';
import type { SignalType, SkuAsk } from '@haiwave/protocol';
import { requestsSoftQuote } from '@/lib/soft-quote';

// A watcher may request soft_quoted_lead_time without per-SKU forward-demand
// asks. That is a valid configuration, but it silently yields no soft quote and
// drops the run page to the legacy grid. This banner names the state.
//
// The cause is read from the run's OWN recorded asks, never from the template:
// watcher scope is mutable, so adding an ask later would otherwise rewrite what
// a historical run appears to have done.

interface Props {
  signalTypes: readonly SignalType[];
  /** Count of soft_quoted_lead_time results on THIS run (not trailing history). */
  softQuoteCount: number;
  /** undefined = pre-3.54 run, asks never recorded. [] = recorded, none. */
  skuAsks: SkuAsk[] | undefined;
  templateId: string | null;
}

export function UnqualifiedWatchBanner({
  signalTypes,
  softQuoteCount,
  skuAsks,
  templateId,
}: Props) {
  if (!requestsSoftQuote(signalTypes)) return null;
  if (softQuoteCount > 0) return null;

  const asksExisted = (skuAsks?.length ?? 0) > 0;
  const recorded = skuAsks !== undefined;

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">
        {asksExisted ? 'Soft quote unresolved' : 'Unqualified watch'}
      </p>
      {asksExisted ? (
        <p className="mt-1">
          A soft-quoted lead time was requested and a forward-demand ask was defined, but the
          quote could not be resolved for this run. The signals below are baseline only.
        </p>
      ) : (
        <p className="mt-1">
          A soft-quoted lead time was requested but no quote was resolved for a quantity.{' '}
          {recorded
            ? 'No per-SKU forward-demand ask was defined for this run.'
            : 'Whether an ask was defined was not recorded for this run.'}{' '}
          The signals below are baseline only — published lead time and capacity — not
          qualified against an ask.
        </p>
      )}
      {!asksExisted && templateId && (
        <Link
          href={`/account/sonar/watchers/definitions/${templateId}`}
          className="mt-2 inline-block font-medium underline"
        >
          Add a forward-demand ask →
        </Link>
      )}
    </div>
  );
}
