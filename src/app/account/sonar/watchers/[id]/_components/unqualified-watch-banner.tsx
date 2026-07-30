import Link from 'next/link';
import type { SignalType, SkuAsk, WatcherRunStatus } from '@haiwave/protocol';
import { describeBaselineSignals, requestsSoftQuote } from '@/lib/soft-quote';

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

// A zero soft-quote count only carries meaning once it is final.
//
// Synthesis itself is NOT the discriminator: haiCore runs it unconditionally
// after persistResults and before finalStatus is read, so every status the
// orchestrator returns normally — complete, throttled, cancelled, and
// terminate-driven failed — has already been through it. Only a thrown
// exception skips synthesis, and that lands as 'failed' too.
//
// So the gate is about whether we can honestly attribute a cause:
//   complete            — the walk finished; the count is final. Report.
//   partial             — declared in the protocol enum and in the
//                         watcher_runs status check constraint, but NEVER
//                         written by any code path today: the orchestrator
//                         only ever returns complete/throttled/cancelled/
//                         failed, and nothing assigns 'partial' directly.
//                         Kept for parity with the complete|partial pair that
//                         watcher-run-service.ts:409 and watcher-drift-service
//                         already treat as succeeded, so a future writer lights
//                         this up rather than silently skipping it.
//   throttled          — synthesis ran, and resuming never re-synthesizes, so
//                        the count will never change. Report. (ThrottleBanner
//                        explains the budget; it does not explain the quote.)
//   running            — results are still landing. Say nothing.
//   failed             — indistinguishable from here: a thrown failure never
//                        reached synthesis, a terminate-driven one did. We
//                        cannot tell, so we do not claim. RunFailureBanner owns it.
//   cancelled          — deliberately stopped; attributing a configuration or
//                        resolution cause to an interrupted run over-claims.
const SETTLED_STATUSES: readonly WatcherRunStatus[] = ['complete', 'partial', 'throttled'];

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

  // Named from what this run actually requested. A watcher that asked for
  // neither published lead time nor capacity must not be told those are what
  // it got, and order-fulfillment history is equally non-ask-gated.
  const baseline = describeBaselineSignals(signalTypes);
  const remainder = baseline
    ? `The signals below are baseline only — ${baseline} — not qualified against an ask.`
    : 'It was the only signal requested, so this run has no other results to show.';

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">{headline}</p>
      {asksExisted ? (
        <p className="mt-1">
          A soft-quoted lead time was requested and a forward-demand ask was defined, but the
          quote could not be resolved for this run. {remainder}
        </p>
      ) : (
        <p className="mt-1">
          A soft-quoted lead time was requested but no quote was resolved for a quantity.{' '}
          {recorded
            ? 'No per-SKU forward-demand ask was defined for this run.'
            : 'Whether an ask was defined was not recorded for this run.'}{' '}
          {remainder}
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
