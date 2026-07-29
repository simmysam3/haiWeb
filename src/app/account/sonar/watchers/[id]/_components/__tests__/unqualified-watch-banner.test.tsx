import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SignalType, SkuAsk } from '@haiwave/protocol';
import { UnqualifiedWatchBanner } from '../unqualified-watch-banner';

const SOFT: [SignalType, ...SignalType[]] = ['soft_quoted_lead_time'];
const ASK: SkuAsk = { sku: 'SKU-1', ask_quantity: 25, target_days: 18 };

function renderBanner(props: {
  signalTypes?: [SignalType, ...SignalType[]];
  softQuoteCount?: number;
  skuAsks?: SkuAsk[] | undefined;
}) {
  return render(
    <UnqualifiedWatchBanner
      signalTypes={props.signalTypes ?? SOFT}
      softQuoteCount={props.softQuoteCount ?? 0}
      skuAsks={props.skuAsks}
      templateId="33333333-3333-3333-3333-333333333333"
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
