import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SignalType, SkuAsk, WatcherRunStatus } from '@haiwave/protocol';
import { UnqualifiedWatchBanner } from '../unqualified-watch-banner';

const SOFT: [SignalType, ...SignalType[]] = ['soft_quoted_lead_time'];
const ASK: SkuAsk = { sku: 'SKU-1', ask_quantity: 25, target_days: 18 };

function renderBanner(props: {
  signalTypes?: [SignalType, ...SignalType[]];
  softQuoteCount?: number;
  skuAsks?: SkuAsk[] | undefined;
  status?: WatcherRunStatus;
}) {
  return render(
    <UnqualifiedWatchBanner
      signalTypes={props.signalTypes ?? SOFT}
      softQuoteCount={props.softQuoteCount ?? 0}
      skuAsks={props.skuAsks}
      templateId="33333333-3333-3333-3333-333333333333"
      status={props.status ?? 'complete'}
    />,
  );
}

describe('<UnqualifiedWatchBanner>', () => {
  it('renders nothing when the soft-quote signal was never requested', () => {
    const { container } = renderBanner({ signalTypes: ['published_lead_time'] });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when soft quotes were produced', () => {
    const { container } = renderBanner({ softQuoteCount: 3, skuAsks: [ASK] });
    expect(container).toBeEmptyDOMElement();
  });

  // 'running' — results are still landing. 'failed' — a thrown failure never
  // reached synthesis while a terminate-driven one did, and we cannot tell which
  // from here, so we do not claim a cause. 'cancelled' — deliberately stopped.
  // 'throttled' is deliberately NOT in this list: see the test below.
  it.each<WatcherRunStatus>(['running', 'failed', 'cancelled'])(
    'renders nothing for a %s run, whose empty results prove nothing',
    (status) => {
      const { container } = renderBanner({ status, skuAsks: [] });
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('still reports on a partial run, which did reach soft-quote synthesis', () => {
    renderBanner({ status: 'partial', skuAsks: [] });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // A throttled run has already been through soft-quote synthesis — the
  // orchestrator returns 'throttled' normally, and synthesis runs after
  // persistResults and before finalStatus is even read. Resuming does not
  // re-synthesize, so the count is final and the outcome is knowable.
  it('reports on a throttled run, which has already been through synthesis', () => {
    renderBanner({ status: 'throttled', skuAsks: [] });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no per-SKU forward-demand ask was defined/i,
    );
  });

  it('states the cause confidently when asks were recorded as empty', () => {
    renderBanner({ skuAsks: [] });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no per-SKU forward-demand ask was defined/i,
    );
    expect(screen.getByRole('link', { name: /forward-demand ask/i })).toHaveAttribute(
      'href',
      '/account/sonar/watchers/definitions/33333333-3333-3333-3333-333333333333',
    );
  });

  it('hedges when the run predates ask recording', () => {
    renderBanner({ skuAsks: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent(/was not recorded for this run/i);
    // Must NOT assert a cause it cannot know.
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /no per-SKU forward-demand ask was defined/i,
    );
  });

  // The hedge has to hold in every element, not just the middle sentence. A
  // pre-3.54 run may well have had asks — headlining it "Unqualified watch" or
  // offering "Add a forward-demand ask" asserts the cause the prose declines to
  // state, and the template it would link to may already carry that ask.
  it('names no cause in the headline or the CTA when asks were never recorded', () => {
    renderBanner({ skuAsks: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent(/no soft quote resolved/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/unqualified watch/i);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does headline an unqualified watch when the run recorded no asks', () => {
    renderBanner({ skuAsks: [] });
    expect(screen.getByRole('alert')).toHaveTextContent(/unqualified watch/i);
  });

  // The copy must describe the signals this watcher actually asked for, not a
  // hardcoded pair. order_fulfillment_history is equally non-ask-gated.
  it('names the baseline signals that were actually requested', () => {
    renderBanner({
      signalTypes: ['soft_quoted_lead_time', 'order_fulfillment_history'],
      skuAsks: [],
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/order state/i);
    expect(alert).not.toHaveTextContent(/published lead time/i);
    expect(alert).not.toHaveTextContent(/capacity/i);
  });

  it('drops the baseline clause when the soft quote was the only signal requested', () => {
    renderBanner({ signalTypes: ['soft_quoted_lead_time'], skuAsks: [] });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/only signal requested/i);
    expect(alert).not.toHaveTextContent(/baseline only/i);
  });

  it('reports a resolution failure when asks existed but no quote resolved', () => {
    renderBanner({ skuAsks: [ASK] });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be resolved/i);
    // Asks exist — pointing at the asks field would be wrong.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
