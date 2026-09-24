import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroEstimate } from '@/lib/sourcing-map/__fixtures__/vomero';
import { RunButton } from '../run-button';

describe('RunButton', () => {
  it('stays disabled with its described reason (the first failing rule, a running execution, or open changes) and shows the estimate once ready (AC 10)', () => {
    const onRun = vi.fn();
    const notReady = { ...vomeroEstimate, readiness: { ready: false, first_failing_rule: 'mix_not_100', detail: 'Court Classic: the mix totals 99.98%, not 100%.' } };
    const { rerender } = render(<RunButton estimate={notReady} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    const run = screen.getByRole('button', { name: 'Run' });
    expect(run).toBeDisabled();
    expect(run).toHaveAccessibleDescription('Court Classic: the mix totals 99.98%, not 100%.');
    rerender(<RunButton estimate={{ ...vomeroEstimate, readiness: { ready: false, first_failing_rule: 'drops_outside_window', detail: null } }} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription("The run's component need-dates span more than 104 weeks.");
    rerender(<RunButton estimate={vomeroEstimate} blockedReason={null} running busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('An execution is running.');
    rerender(<RunButton estimate={vomeroEstimate} blockedReason="Apply or close Configure before running." running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('Apply or close Configure before running.');
    rerender(<RunButton estimate={{ ...vomeroEstimate, responders_short: [{ participant_id: '5a1e0000-0000-4000-8000-000000000103', legal_name: 'Arno Pelli', probes_planned: 2, remaining_allowance: 1 }] }} blockedReason={null} running={false} busy={false} onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled();
    expect(screen.getByText('5 slots · 7 probes (up to 10 with re-probes)')).toBeInTheDocument();
    expect(screen.getByText('Arno Pelli has 1 probe left this hour for 2 planned.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).toHaveBeenCalled();
  });

  it('says "1 slot" and "1 probe" in the singular, as the responders line does (R4)', () => {
    render(<RunButton estimate={{ ...vomeroEstimate, slot_count: 1, probe_count: 1, probe_count_worst_case: 3 }} blockedReason={null} running={false} busy={false} onRun={() => undefined} />);
    expect(screen.getByText('1 slot · 1 probe (up to 3 with re-probes)')).toBeInTheDocument();
  });
});
