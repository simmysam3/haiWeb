import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroExecution } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ExecutionBanner } from '../execution-state';

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
});
