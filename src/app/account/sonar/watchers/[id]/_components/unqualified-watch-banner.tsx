import Link from 'next/link';
import type { SignalType, SkuAsk, WatcherRunStatus } from '@haiwave/protocol';
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
  status: WatcherRunStatus;
}

// A zero soft-quote count only carries meaning once the run has settled. Soft
// quotes are synthesized after the orchestrator returns (watcher-run-service.ts
// persists them right after persistResults), so `results` is empty for the whole
// in-flight window and for any run that threw. Both 'complete' and 'partial'
// have been through synthesis; the rest have not.
const SETTLED_STATUSES: readonly WatcherRunStatus[] = ['complete', 'partial'];

export function UnqualifiedWatchBanner({
  signalTypes,
  softQuoteCount,
  skuAsks,
  templateId,
  status,
}: Props) {
  if (!requestsSoftQuote(signalTypes)) return null;
  if (!SETTLED_STATUSES.includes(status)) return null;
  if (softQuoteCount > 0) return null;

  const asksExisted = (skuAsks?.length ?? 0) > 0;
  const recorded = skuAsks !== undefined;

  // Every element has to stay three-state. Branching the headline or the CTA on
  // `!asksExisted` alone lumps `undefined` (never recorded) in with `[]`
  // (recorded, none) and asserts a cause on the one row that cannot know it —
  // the same mutable-value-over-immutable-history mistake this feature exists to
  // prevent, one layer up. A pre-3.54 run may have had asks and failed to
  // resolve for sourcing reasons, so it gets a neutral outcome and no CTA.
  const headline = asksExisted
    ? 'Soft quote unresolved'
    : recorded
      ? 'Unqualified watch'
      : 'No soft quote resolved';

  // Only worth pointing at the asks field when we know for a fact there were
  // none. Otherwise the link may send the user to a template that already has
  // the ask configured.
  const canPointAtTheAsk = recorded && !asksExisted;

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">{headline}</p>
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
      {canPointAtTheAsk && templateId && (
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
