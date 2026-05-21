import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/account/sonar/requests',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { DirectionTabs } from '../direction-tabs';

beforeEach(() => {
  mockPush.mockReset();
  currentSearch = '';
});

describe('DirectionTabs — v.1.37 IA', () => {
  it('renders three tabs with counts', () => {
    render(
      <DirectionTabs awaitingMeCount={3} awaitingThemCount={5} totalCount={12} />,
    );
    expect(screen.getByRole('button', { name: /Awaiting me/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Awaiting them/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('clicking Them pushes ?direction=them', () => {
    render(<DirectionTabs awaitingMeCount={0} awaitingThemCount={0} totalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Awaiting them/ }));
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?direction=them');
  });

  it('clicking All pushes ?direction=all', () => {
    render(<DirectionTabs awaitingMeCount={0} awaitingThemCount={0} totalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests?direction=all');
  });

  it('clicking Me clears the direction param (me is implicit default)', () => {
    currentSearch = 'direction=them&item_type=nomination';
    render(<DirectionTabs awaitingMeCount={0} awaitingThemCount={0} totalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Awaiting me/ }));
    expect(mockPush).toHaveBeenCalledWith(
      '/account/sonar/requests?item_type=nomination',
    );
  });

  it('honors legacy `awaiting` alias from v1.35 redirects', () => {
    currentSearch = 'awaiting=them';
    render(<DirectionTabs awaitingMeCount={0} awaitingThemCount={0} totalCount={0} />);
    // The Them tab is the active one — clicking it would push the same URL,
    // but the visible underline lights up under "Awaiting them" via the
    // shared <Tabs> primitive. Smoke-test by clicking Me to confirm state
    // moves away from Them correctly.
    fireEvent.click(screen.getByRole('button', { name: /Awaiting me/ }));
    expect(mockPush).toHaveBeenCalledWith('/account/sonar/requests');
  });
});
