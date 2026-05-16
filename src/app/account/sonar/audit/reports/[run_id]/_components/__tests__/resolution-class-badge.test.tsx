import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResolutionClassBadge } from '../resolution-class-badge';

describe('ResolutionClassBadge', () => {
  it.each([
    ['agentic_eligible', 'Agentic eligible', 'text-teal'],
    ['out_of_band', 'Out of band', 'text-orange'],
    ['pending', 'Pending', 'text-slate'],
  ] as const)('renders %s with label %s and class containing %s', (cls, label, colorClass) => {
    render(<ResolutionClassBadge resolution_class={cls} />);
    const badge = screen.getByText(label);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain(colorClass);
  });

  it('carries a definition tooltip', () => {
    render(<ResolutionClassBadge resolution_class="agentic_eligible" />);
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/agent-to-agent/i);
  });
});
