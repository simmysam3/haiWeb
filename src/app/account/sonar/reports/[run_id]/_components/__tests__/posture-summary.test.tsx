import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostureSummary } from '../posture-summary';
import { makeAggregateReport } from '../__fixtures__/aggregate-report';

describe('PostureSummary', () => {
  it('renders the six counts from the posture_summary slice', () => {
    const summary = makeAggregateReport().posture_summary;
    render(<PostureSummary summary={summary} />);
    expect(screen.getByText('Vendors').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Compliant').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Partially compliant').nextSibling).toHaveTextContent('0');
    expect(screen.getByText('Non-compliant').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Products').nextSibling).toHaveTextContent('5');
    expect(screen.getByText('Gaps').nextSibling).toHaveTextContent('3');
  });
});
