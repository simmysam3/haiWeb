import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskPill } from '../risk-pill';

describe('RiskPill', () => {
  it('keeps its label and aria, and adds a definition tooltip', () => {
    render(<RiskPill color="red" label="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/critically high/i);
  });

  it.each([
    ['green', 'normal'],
    ['yellow', 'elevated'],
    ['red', 'critical'],
  ] as const)('renders the %s/%s label', (color, label) => {
    render(<RiskPill color={color} label={label} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
