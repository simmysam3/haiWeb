import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pill } from '../pill';

afterEach(() => vi.restoreAllMocks());

describe('Pill', () => {
  it('renders the value as the label by default', () => {
    render(<Pill category="run_status" value="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('resolves the definition from the embedded map and exposes it via aria-describedby', () => {
    render(<Pill category="run_status" value="failed" />);
    const pill = screen.getByTestId('pill');
    const describedby = pill.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby as string)).toHaveTextContent(
      /run (stopped|terminated) before completing/i,
    );
  });

  it('appends "Reason:" with the dynamic detail for error states', () => {
    render(
      <Pill
        category="run_status"
        value="failed"
        detail='duplicate key value violates unique constraint "idx_x"'
      />,
    );
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/Reason:/);
    expect(tip).toHaveTextContent('idx_x');
  });

  it('uses an explicit definition override and skips the map', () => {
    render(<Pill definition="Inbound probe limit">Limit</Pill>);
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent('Inbound probe limit');
    expect(screen.getByText('Limit')).toBeInTheDocument();
  });

  it('dev-warns when no definition resolves', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Pill category="run_status" value="not_a_real_status" />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[Pill] no definition'),
      expect.anything(),
    );
  });

  it('shows tooltip on focus and hides on Escape', async () => {
    const user = userEvent.setup();
    render(<Pill category="run_status" value="failed" />);
    const pill = screen.getByTestId('pill');
    await user.tab();
    expect(pill).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
