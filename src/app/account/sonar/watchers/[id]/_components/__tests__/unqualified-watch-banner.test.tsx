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

  // An empty soft-quote count only means something once the run has settled.
  // Soft quotes are synthesized after the orchestrator returns, so `results` is
  // empty for the whole in-flight window and for any run that threw — and
  // failed/cancelled runs already have <RunFailureBanner> naming the real cause.
  it.each<WatcherRunStatus>(['running', 'throttled', 'failed', 'cancelled'])(
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

  it('reports a resolution failure when asks existed but no quote resolved', () => {
    renderBanner({ skuAsks: [ASK] });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be resolved/i);
    // Asks exist — pointing at the asks field would be wrong.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
