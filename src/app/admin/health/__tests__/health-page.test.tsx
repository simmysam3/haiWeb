import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthPage from '../page';

/**
 * Broker P3 T6 (P7c): the Network Health cards carry the DERIVED
 * availability taxonomy — Healthy / Quiet / Unreachable / Suspended. The
 * probe-era cards (Heartbeat Success, Agents Probation, uptime-from-
 * administrative-status, the constant-zero "Mean heartbeat response") are
 * retired with their machine; no card may name the dead mechanism or serve
 * a number with no real source.
 */
describe('admin Network Health page (P7c)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  });

  it('renders the four availability cards', () => {
    render(<HealthPage />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Quiet')).toBeInTheDocument();
    expect(screen.getByText('Unreachable')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('retires the probe-era cards and never names the dead mechanism', () => {
    render(<HealthPage />);
    expect(screen.queryByText(/heartbeat/i)).toBeNull();
    expect(screen.queryByText(/probation/i)).toBeNull();
    expect(screen.queryByText(/Agent Uptime/)).toBeNull();
    expect(screen.queryByText(/Avg Response Time/)).toBeNull();
  });
});
