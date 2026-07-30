import { describe, expect, it } from 'vitest';
import { describeBaselineSignals, requestsSoftQuote } from '../soft-quote';

// The warning copy must name the signals the watcher ACTUALLY requested.
// Hardcoding "published lead time and capacity" misdescribes a watcher that
// asked for neither, and omits order-fulfillment history, which is equally
// non-ask-gated.
describe('describeBaselineSignals', () => {
  it('lists the non-ask-gated signals that were requested', () => {
    expect(
      describeBaselineSignals([
        'published_lead_time',
        'capacity_utilization_band',
        'soft_quoted_lead_time',
      ]),
    ).toBe('published lead time and capacity utilization band');
  });

  it('names a single baseline signal without a conjunction', () => {
    expect(describeBaselineSignals(['order_fulfillment_history', 'soft_quoted_lead_time'])).toBe(
      'order state',
    );
  });

  it('returns null when the soft quote was the only signal requested', () => {
    expect(describeBaselineSignals(['soft_quoted_lead_time'])).toBeNull();
  });
});

describe('requestsSoftQuote', () => {
  it('is true when the soft-quote signal is present', () => {
    expect(requestsSoftQuote(['published_lead_time', 'soft_quoted_lead_time'])).toBe(true);
  });

  it('is false for a signal set without it', () => {
    expect(requestsSoftQuote(['published_lead_time', 'capacity_utilization_band'])).toBe(false);
  });

  it('is false for an empty signal set', () => {
    expect(requestsSoftQuote([])).toBe(false);
  });
});
