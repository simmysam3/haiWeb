import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroEstimate } from '@/lib/sourcing-map/__fixtures__/vomero';
import { mayWaitEstimate } from '@/app/sourcing-map/__fixtures__/sp2';
import { RunButton } from '../run-button';

describe('RunButton', () => {
  it('stays disabled with its described reason (the first failing rule, a running execution, or open changes) and shows the estimate once ready (AC 10)', () => {
    const onRun = vi.fn();
    const notReady = { ...vomeroEstimate, readiness: { ready: false, first_failing_rule: 'mix_not_100', detail: 'Court Classic: the mix totals 99.98%, not 100%.' } };
    const { rerender } = render(<RunButton estimate={notReady} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    const run = screen.getByRole('button', { name: 'Run' });
    // LW-a: Run is aria-disabled for every reason, never `disabled`, and a press then does nothing.
    expect(run).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(run);
    expect(onRun).not.toHaveBeenCalled();
    expect(run).toHaveAccessibleDescription('Court Classic: the mix totals 99.98%, not 100%.');
    rerender(<RunButton estimate={{ ...vomeroEstimate, readiness: { ready: false, first_failing_rule: 'drops_outside_window', detail: null } }} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription("The run's component need-dates span more than 104 weeks.");
    rerender(<RunButton estimate={vomeroEstimate} blockedReason={null} running busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('An execution is running.');
    rerender(<RunButton estimate={vomeroEstimate} blockedReason="Apply or close Configure before running." running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('Apply or close Configure before running.');
    rerender(<RunButton estimate={{ ...vomeroEstimate, responders_short: [{ participant_id: '5a1e0000-0000-4000-8000-000000000103', legal_name: 'Arno Pelli', probes_planned: 2, remaining_allowance: 1 }] }} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText('5 slots · 7 probes (up to 10 with re-probes)')).toBeInTheDocument();
    expect(screen.getByText('Arno Pelli has 1 probe left this hour for 2 planned.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).toHaveBeenCalled();
  });

  it('says "1 slot" and "1 probe" in the singular, as the responders line does (R4)', () => {
    render(<RunButton estimate={{ ...vomeroEstimate, slot_count: 1, probe_count: 1, probe_count_worst_case: 3 }} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    expect(screen.getByText('1 slot · 1 probe (up to 3 with re-probes)')).toBeInTheDocument();
  });

  it('says it is checking readiness until the estimate arrives, and a running execution outranks open changes (M4)', () => {
    const { rerender } = render(<RunButton estimate={null} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('Checking whether the run is ready…');
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-disabled', 'true');
    rerender(<RunButton estimate={vomeroEstimate} blockedReason="Apply or close Configure before running." running busy={false} onRun={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('An execution is running.');
  });

  it('stays focusable through its press, its request and "An execution is running.": aria-disabled, never disabled, and inert (LW-a)', () => {
    const onRun = vi.fn();
    const { rerender } = render(<RunButton estimate={vomeroEstimate} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    const run = screen.getByRole('button', { name: 'Run' });
    run.focus();
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledTimes(1);
    rerender(<RunButton estimate={vomeroEstimate} blockedReason={null} running={false} busy onRun={onRun} />);
    expect(run).toHaveAttribute('aria-busy', 'true');
    expect(run).toHaveAttribute('aria-disabled', 'true');
    expect(run).not.toBeDisabled();
    expect(run).toHaveFocus();
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledTimes(1);
    rerender(<RunButton estimate={vomeroEstimate} blockedReason={null} running busy={false} onRun={onRun} />);
    expect(run).toHaveAccessibleDescription('An execution is running.');
    expect(run).toHaveAttribute('aria-disabled', 'true');
    expect(run).not.toHaveAttribute('aria-busy');
    expect(run).not.toBeDisabled();
    expect(run).toHaveFocus();
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('adds "; <responder> may need to wait" to the estimate line for a responder planning more probes than its allowance, and nothing when none does (spec §12.5, G-2)', () => {
    const { rerender } = render(<RunButton estimate={mayWaitEstimate} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    const counts = screen.getByText('4 slots · 6 probes (up to 9 with re-probes)');
    expect(screen.getByText('; Arno Pelli may need to wait')).toBeInTheDocument();
    expect(counts.parentElement!.textContent).toContain('4 slots · 6 probes (up to 9 with re-probes); Arno Pelli may need to wait');
    // the SP1 allowance warning stays beside it
    expect(screen.getByText('Arno Pelli has 1 probe left this hour for 2 planned.')).toBeInTheDocument();
    rerender(<RunButton estimate={vomeroEstimate} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    expect(screen.queryByText(/may need to wait/)).toBeNull();
    // a responder whose allowance covers its plan does not wait
    rerender(<RunButton estimate={{ ...vomeroEstimate, responders_short: [{ participant_id: '5a1e0000-0000-4000-8000-000000000103', legal_name: 'Arno Pelli', probes_planned: 1, remaining_allowance: 1 }] }} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    expect(screen.queryByText(/may need to wait/)).toBeNull();
  });
});
