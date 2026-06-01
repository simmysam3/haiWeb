import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapacityBandPanel } from '../capacity-band-panel';

describe('<CapacityBandPanel>', () => {
  it('renders the 4-segment band strip with current highlighted when direct', () => {
    render(
      <CapacityBandPanel
        synthesisMode="direct"
        payload={{ band: 'high', observed_at: '2026-05-27T10:00:00Z' }}
      />,
    );
    // 'high' utilization surfaces as 'Limited' availability.
    expect(screen.getByLabelText('Current availability: Limited')).toBeInTheDocument();
  });

  it('renders the modal band + distribution when aggregated', () => {
    render(
      <CapacityBandPanel
        synthesisMode="aggregated_derivative"
        payload={{
          modal_band: 'high',
          distribution: { low: 1, moderate: 1, high: 3, at_capacity: 0 },
        }}
      />,
    );
    expect(screen.getByText(/typical availability/i)).toBeInTheDocument();
    expect(screen.getByText('Limited')).toBeInTheDocument();
  });

  it('renders the absent treatment when redacted_gap', () => {
    render(<CapacityBandPanel synthesisMode="redacted_gap" payload={null} />);
    expect(screen.getByText(/capacity signal not shared/i)).toBeInTheDocument();
  });
});
