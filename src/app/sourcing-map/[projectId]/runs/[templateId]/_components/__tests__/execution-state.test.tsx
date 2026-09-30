import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroExecution } from '@/lib/sourcing-map/__fixtures__/vomero';
import { throttledDetail } from '@/app/sourcing-map/__fixtures__/sp2';
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

  it("says a throttled execution is waiting for the responder's hourly allowance until the hour, from the summary; keeps Cancel live; falls back when nothing or no one is named (spec §12.5, G-41, G-52, Review Focus 4)", () => {
    const onCancel = vi.fn();
    const bare = { ...throttledDetail.execution, waiting_on: null };
    const { rerender } = render(<ExecutionBanner execution={bare} onCancel={onCancel} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for an hourly allowance — the run continues on its own.');
    expect(screen.getByRole('button', { name: 'Cancel execution' })).toBeInTheDocument();
    // the summary names the responder (G-41)
    rerender(<ExecutionBanner execution={throttledDetail.execution} onCancel={onCancel} />);
    expect(screen.getByRole('status')).toHaveTextContent("Waiting for Arno Pelli's hourly allowance until 11:00 UTC — the run continues on its own.");
    // G-52: a responder below tier 1 has a null name and is not named
    rerender(<ExecutionBanner execution={{ ...throttledDetail.execution, waiting_on: { responder_name: null, refill_at: '2027-03-01T11:00:00.000Z' } }} onCancel={onCancel} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for an hourly allowance — the run continues on its own.');
    expect(screen.queryByText(/Probing:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    // without a cancel handler (a read of someone else's run) there is no button, as for probing
    rerender(<ExecutionBanner execution={throttledDetail.execution} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tolerates more probes answered than planned after a resume (G-23): the count never reads "8 of 6"', () => {
    const { rerender } = render(<ExecutionBanner execution={{ ...vomeroExecution, status: 'running', probes_planned: 6, probes_done: 8 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Probing: 8 probes answered (6 planned; some re-dispatched after a wait)');
    rerender(<ExecutionBanner execution={{ ...vomeroExecution, status: 'running', probes_planned: 6, probes_done: 6 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Probing: 6 of 6 probes answered');
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
