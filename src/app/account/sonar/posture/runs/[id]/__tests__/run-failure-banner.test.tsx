import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunFailureBanner } from '../run-failure-banner';

describe('RunFailureBanner', () => {
  it('renders nothing for non-failed runs', () => {
    const { container } = render(
      <RunFailureBanner status="complete" errorMessage={null} resultsCount={60} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an alert explaining the failure when status is failed', () => {
    render(
      <RunFailureBanner
        status="failed"
        errorMessage="something went wrong"
        resultsCount={0}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/this run failed/i);
  });

  it('tells the user prior results are still shown when resultsCount > 0', () => {
    render(
      <RunFailureBanner status="failed" errorMessage="boom" resultsCount={60} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/60 result/i);
  });

  it('always surfaces the technical error_message verbatim', () => {
    render(
      <RunFailureBanner
        status="failed"
        errorMessage='duplicate key value violates unique constraint "idx_sku_obligations_unique_active"'
        resultsCount={60}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'idx_sku_obligations_unique_active',
    );
  });

  it('adds a plain-language hint for a post-processing duplicate-key conflict', () => {
    render(
      <RunFailureBanner
        status="failed"
        errorMessage='duplicate key value violates unique constraint "idx_sku_obligations_unique_active"'
        resultsCount={60}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/post-processing/i);
  });

  it('does not crash and stays generic when error_message is null', () => {
    render(
      <RunFailureBanner status="failed" errorMessage={null} resultsCount={0} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/this run failed/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/no error detail/i);
  });
});
