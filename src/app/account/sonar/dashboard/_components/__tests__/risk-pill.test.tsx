import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskPill } from '../risk-pill';

describe('RiskPill', () => {
  it('green renders with text label "normal" + role status', () => {
    render(<RiskPill color="green" label="normal" />);
    const pill = screen.getByText(/normal/i);
    expect(pill).toBeInTheDocument();
  });

  it.each([
    ['green', 'normal'],
    ['yellow', 'elevated'],
    ['red', 'critical'],
  ] as const)('%s pill displays its label %s', (color, label) => {
    render(<RiskPill color={color} label={label} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('includes ARIA label for screen readers (WCAG 2.1 AA)', () => {
    render(<RiskPill color="red" label="critical" />);
    const node = screen.getByText('critical').closest('span');
    expect(node?.getAttribute('aria-label')).toMatch(/risk: critical/i);
  });
});
