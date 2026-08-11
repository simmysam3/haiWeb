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
      <DashboardAlertBar agents={{ total: 3, jailed: 0, jailedNames: [] }} accountStatus="active" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // "Down" is haiCore's own `jailed` status — the state its heartbeat machine
  // puts an agent in after 3 consecutive failed probes — not a freshness
  // window invented here. Reusing it means the alert agrees with what the
  // Agents page shows, and with the state the probation path recovers from.
  it('alerts when an agent is jailed', () => {
    render(<DashboardAlertBar agents={{ total: 3, jailed: 1, jailedNames: ['Agent1'] }} accountStatus="active" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/1 of 3/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/unreachable/i);
  });

  // Every agent jailed is the fleet being down: nothing can answer an RFQ.
  // That is blocking, not degraded.
  it('escalates when every agent is jailed', () => {
    render(<DashboardAlertBar agents={{ total: 2, jailed: 2, jailedNames: ['Agent1', 'Agent2'] }} accountStatus="active" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no agents are reachable/i);
  });

  // An account that has not provisioned an agent yet is in a SETUP state, not
  // a fault state. The previous rule (alert when the active count is zero)
  // could not tell those apart and would have interrupted every new account.
  it('says nothing when the account simply has no agents yet', () => {
    const { container } = render(
      <DashboardAlertBar agents={{ total: 0, jailed: 0, jailedNames: [] }} accountStatus="active" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('alerts when the account is suspended', () => {
    render(<DashboardAlertBar agents={{ total: 3, jailed: 0, jailedNames: [] }} accountStatus="suspended" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/suspended/i);
  });

  it('shows both conditions at once, most severe first', () => {
    render(<DashboardAlertBar agents={{ total: 3, jailed: 1, jailedNames: ['Agent1'] }} accountStatus="suspended" />);
    const alert = screen.getByRole('alert');
    const text = alert.textContent ?? '';
    expect(text).toMatch(/suspended/i);
    expect(text).toMatch(/unreachable/i);
    // A suspended account is blocking; one jailed agent of several is
    // degraded. The blocking one must read first.
    expect(text.search(/suspended/i)).toBeLessThan(text.search(/unreachable/i));
  });

  // The honesty rule this whole dashboard is built on: null means "we could
  // not find out", which is NOT the same as "it is broken". haiCore being
  // unreachable must never masquerade as the account being suspended or the
  // fleet being down — those are specific accusations.
  it('stays silent when the inputs are unknown', () => {
    const { container } = render(<DashboardAlertBar agents={null} accountStatus={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still alerts on a known jailed agent when the other input is unknown', () => {
    render(<DashboardAlertBar agents={{ total: 3, jailed: 1, jailedNames: ['Agent1'] }} accountStatus={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unreachable/i);
  });
});

describe('DashboardAlertBar heartbeat alert', () => {
  it('names the jailed agents and links to the Agents page', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 5, jailed: 2, jailedNames: ['Arno', 'Mekong'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText(/2 of 5 agents unreachable/)).toBeInTheDocument();
    expect(screen.getByText(/Unreachable: Arno, Mekong/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check agent health/i })).toHaveAttribute(
      'href',
      '/account/agents',
    );
    expect(screen.queryByText(/Agent Management/)).toBeNull();
  });
  it('caps the name list at two and counts the rest', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 6, jailed: 4, jailedNames: ['Arno', 'Mekong', 'Vomero', 'Apex'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText(/Unreachable: Arno, Mekong \+2 more/)).toBeInTheDocument();
  });
  it('all-jailed stays blocking and still names agents', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 2, jailed: 2, jailedNames: ['Arno', 'Mekong'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText('No agents are reachable')).toBeInTheDocument();
    expect(screen.getByText(/Arno, Mekong/)).toBeInTheDocument();
  });
  it('null fleet stays silent — unknown is never an accusation', () => {
    const { container } = render(<DashboardAlertBar agents={null} accountStatus="active" />);
    expect(container).toBeEmptyDOMElement();
  });
});
