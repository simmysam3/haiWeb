import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardAlertBar } from '../dashboard-alert-bar';

/**
 * The System Dashboard's alert bar.
 *
 * It is not a status tile: it exists only to interrupt. When nothing is wrong
 * it must render NOTHING — no empty container, no "all clear" row — so that
 * its mere presence on the page is the signal.
 */
describe('DashboardAlertBar', () => {
  it('renders nothing when there is no active issue', () => {
    const { container } = render(
      <DashboardAlertBar agentsOnline={3} accountStatus="active" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('alerts when no agents are online', () => {
    render(<DashboardAlertBar agentsOnline={0} accountStatus="active" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no agents online/i);
  });

  it('alerts when the account is suspended', () => {
    render(<DashboardAlertBar agentsOnline={3} accountStatus="suspended" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/suspended/i);
  });

  it('shows both conditions at once, most severe first', () => {
    render(<DashboardAlertBar agentsOnline={0} accountStatus="suspended" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/suspended/i);
    expect(alert).toHaveTextContent(/no agents online/i);
    // A suspended account is blocking; no agents online is degraded. The
    // blocking one must read first.
    const text = alert.textContent ?? '';
    expect(text.search(/suspended/i)).toBeLessThan(text.search(/no agents online/i));
  });

  // The honesty rule this whole dashboard is built on: null means "we could
  // not find out", which is NOT the same as "it is broken". haiCore being
  // unreachable must never masquerade as the account being suspended or the
  // fleet being down — those are specific accusations.
  it('stays silent when the inputs are unknown', () => {
    const { container } = render(
      <DashboardAlertBar agentsOnline={null} accountStatus={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // A count we DO know to be zero is a real problem worth interrupting for,
  // even while the account status is unknown.
  it('still alerts on a known zero when the other input is unknown', () => {
    render(<DashboardAlertBar agentsOnline={0} accountStatus={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no agents online/i);
  });
});
