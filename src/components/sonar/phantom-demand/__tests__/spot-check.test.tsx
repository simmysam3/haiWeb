import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SpotCheckBanner } from '../spot-check-banner';
import { SpotCheckTooltip } from '../spot-check-tooltip';
import { MesUnavailable } from '../mes-unavailable';

describe('SpotCheckBanner', () => {
  it('renders without capturedAt', () => {
    render(<SpotCheckBanner />);
    expect(screen.getByText(/best-effort spot check/i)).toBeInTheDocument();
  });
  it('renders captured-at time when provided', () => {
    render(<SpotCheckBanner capturedAt="2026-05-28T12:00:00Z" />);
    expect(screen.getByText(/snapshot taken at/i)).toBeInTheDocument();
  });
});

describe('SpotCheckTooltip', () => {
  it('wraps children with title attribute', () => {
    render(<SpotCheckTooltip>3 days</SpotCheckTooltip>);
    const span = screen.getByText('3 days');
    expect(span).toHaveAttribute('title', expect.stringMatching(/non-binding/i));
  });
});

describe('MesUnavailable', () => {
  it('renders the badge', () => {
    render(<MesUnavailable />);
    expect(screen.getByText(/MES unavailable/i)).toBeInTheDocument();
  });
});
