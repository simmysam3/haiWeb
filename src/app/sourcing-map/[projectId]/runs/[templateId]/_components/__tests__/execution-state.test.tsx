import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroExecution } from '@/lib/sourcing-map/__fixtures__/vomero';
import { AnswersAsOf, ExecutionBanner } from '../execution-state';

describe('execution states', () => {
  it('says what state the execution is in, never showing a failed or running one as finished (AC 17)', () => {
    const { rerender } = render(<ExecutionBanner execution={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('No execution yet. Configure the run, then press Run.');
    rerender(<ExecutionBanner execution={{ ...vomeroExecution, status: 'running', probes_done: 3 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Probing: 3 of 7 probes answered');
    rerender(<ExecutionBanner execution={{ ...vomeroExecution, status: 'failed', failure_reason: 'interrupted' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This execution failed: it was interrupted by a restart. Run it again for a fresh result.');
    rerender(<ExecutionBanner execution={{ ...vomeroExecution, status: 'cancelled' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.');
    // Lane pre-empt: the failure alert does not outlive the failed execution.
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<ExecutionBanner execution={vomeroExecution} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "Answers as of", warns only once answers are more than 7 days old, and shows nothing without a timestamp (AC 18)', () => {
    const asOf = '2026-09-23T10:42:00.000Z';
    const { rerender, container } = render(<AnswersAsOf asOf={asOf} now={new Date('2026-09-30T10:42:00.000Z')} />);
    expect(screen.getByText('Answers as of Sep 23, 10:42 UTC')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<AnswersAsOf asOf={asOf} now={new Date('2026-09-30T10:42:00.001Z')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Answers are more than 7 days old; run again for fresh answers.');
    rerender(<AnswersAsOf asOf={null} now={new Date('2030-01-01T00:00:00.000Z')} />);
    expect(container).toBeEmptyDOMElement();
  });
});
