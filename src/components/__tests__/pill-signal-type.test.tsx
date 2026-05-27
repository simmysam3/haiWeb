import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pill } from '../pill';

// v.1.43 Plan 2 Task 4 — abbreviated signal-type pill codes for the watcher
// CounterpartiesGrid summary chips, WatcherScopePicker checkboxes, and
// watcher column packs. Adapter for the test plan's title= assertion: this
// codebase wires Pill tooltips through aria-describedby → sibling
// role="tooltip" / sr-only span, matching the existing pill.test.tsx pattern.
describe('<Pill category="signal_type">', () => {
  function tooltipText(): string | null {
    const pill = screen.getByTestId('pill');
    const id = pill.getAttribute('aria-describedby');
    if (!id) return null;
    return document.getElementById(id)?.textContent ?? null;
  }

  it('renders LT pill with the lead-time definition tooltip', () => {
    render(<Pill category="signal_type" value="LT" />);
    expect(screen.getByText('LT')).toBeInTheDocument();
    expect(tooltipText()).toMatch(/lead.?time/i);
  });

  it('renders CAP pill with the capacity-band definition tooltip', () => {
    render(<Pill category="signal_type" value="CAP" />);
    expect(screen.getByText('CAP')).toBeInTheDocument();
    expect(tooltipText()).toMatch(/capacity/i);
  });

  it('renders DEL pill with the delivery-event definition tooltip', () => {
    render(<Pill category="signal_type" value="DEL" />);
    expect(screen.getByText('DEL')).toBeInTheDocument();
    expect(tooltipText()).toMatch(/deliver/i);
  });
});
