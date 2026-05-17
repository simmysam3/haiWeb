import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeView } from '../tree-view';
import type { ObservationNode } from '@haiwave/protocol';

function node(over: Partial<ObservationNode>): ObservationNode {
  return {
    participant_id: null, vendor_legal_name: null, depth_level: 2,
    components: [], gap: null, synthesis_mode: 'direct', identity_redacted: false,
    payload: { kind: 'audit', product_id: null, disclosure_data: null, class_ids: [],
      origin: { country_of_origin: 'US', state_province: 'WA', city: null,
        plant_address: null, plant_identifier: null, vendor_name: null },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } },
    ...over,
  } as ObservationNode;
}

describe('TreeView label taxonomy', () => {
  it('shows real legal name when disclosed', () => {
    render(<TreeView node={node({ participant_id: 'p1', vendor_legal_name: 'Great Lakes Hardware' })} />);
    expect(screen.getByText('Great Lakes Hardware')).toBeInTheDocument();
  });
  it('shows "Vendor Name Not Disclosed" when identity_redacted', () => {
    render(<TreeView node={node({ identity_redacted: true })} />);
    expect(screen.getByText('Vendor Name Not Disclosed')).toBeInTheDocument();
  });
  it('shows "Vendor Name Not Disclosed" for an unauthorized gap node', () => {
    render(<TreeView node={node({ participant_id: 'p2', gap: { kind: 'unauthorized', hint: 'no_trading_pair' } as ObservationNode['gap'] })} />);
    expect(screen.getByText('Vendor Name Not Disclosed')).toBeInTheDocument();
  });
  it('shows "Unknown — no network record" for a non_participant gap leaf', () => {
    render(<TreeView node={node({ gap: { kind: 'non_participant' } as ObservationNode['gap'] })} />);
    expect(screen.getByText('Unknown — no network record')).toBeInTheDocument();
  });
});
