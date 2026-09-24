import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroExecution, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ExecutionPicker } from '../execution-picker';

describe('ExecutionPicker', () => {
  it('lists executions newest first with their status and selects an earlier one (AC 18)', () => {
    const older = { ...vomeroExecution, execution_id: VOMERO_IDS.executionOld, status: 'failed' as const, failure_reason: 'interrupted' as const, created_at: '2026-09-20T08:00:00.000Z', started_at: '2026-09-20T08:00:00.000Z' };
    const onSelect = vi.fn();
    render(<ExecutionPicker executions={[older, vomeroExecution]} selectedId={VOMERO_IDS.execution} onSelect={onSelect} />);
    const picker = screen.getByLabelText('Result');
    expect(Array.from((picker as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      'Sep 23, 10:40 UTC · completed', 'Sep 20, 08:00 UTC · failed',
    ]);
    fireEvent.change(picker, { target: { value: VOMERO_IDS.executionOld } });
    expect(onSelect).toHaveBeenCalledWith(VOMERO_IDS.executionOld);
  });
});
