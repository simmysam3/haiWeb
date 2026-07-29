import { describe, expect, it } from 'vitest';
import { requestsSoftQuote } from '../soft-quote';

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
