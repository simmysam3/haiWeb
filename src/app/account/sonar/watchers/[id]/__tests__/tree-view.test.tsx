import { describe, it, expect } from 'vitest';
import { act } from 'react';
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
    expect(screen.getByTestId('id-chip')).toBeInTheDocument();
  });
  it('shows "Vendor Name Not Disclosed" when identity_redacted', () => {
    render(<TreeView node={node({ identity_redacted: true, participant_id: 'p-secret', vendor_legal_name: 'Should Not Appear' })} />);
    expect(screen.getByText('Vendor Name Not Disclosed')).toBeInTheDocument();
    expect(screen.queryByTestId('id-chip')).toBeNull();
  });
  it('shows "Vendor Name Not Disclosed" for an unauthorized gap node', () => {
    render(<TreeView node={node({ participant_id: 'p2', gap: { kind: 'unauthorized', hint: 'no_trading_pair' } as ObservationNode['gap'] })} />);
    expect(screen.getByText('Vendor Name Not Disclosed')).toBeInTheDocument();
  });
  it('shows "Unknown — no network record" for a non_participant gap leaf', () => {
    render(<TreeView node={node({ gap: { kind: 'non_participant' } as ObservationNode['gap'] })} />);
    expect(screen.getByText('Unknown — no network record')).toBeInTheDocument();
  });
  it('shows "Vendor Name Not Disclosed" for a participant with no resolvable name', () => {
    render(<TreeView node={node({ participant_id: 'p5' })} />);
    expect(screen.getByText('Vendor Name Not Disclosed')).toBeInTheDocument();
  });
});

describe('TreeView compliance sliver tone', () => {
  // The sliver only renders with complianceBar; its accessible meaning is the
  // title attribute. We assert tone via that title text. Binary by design:
  // green = origin resolved, red = gap or no resolved origin.
  const GREEN = 'Source resolved — origin verified for this node';
  const RED =
    'Not resolved — provenance gap or no origin disclosed for this node';

  // Build a node with a specific country_of_origin sentinel.
  const withCountry = (country: string): ObservationNode =>
    node({
      payload: {
        kind: 'audit', product_id: null, disclosure_data: null, class_ids: [],
        origin: { country_of_origin: country, state_province: null, city: null,
          plant_address: null, plant_identifier: null, vendor_name: null },
        operational_status: { lead_time_meets: null, capacity: null, delivery_state: null },
      } as ObservationNode['payload'],
    });

  it('is green when origin resolved + direct', () => {
    render(<TreeView node={node({})} complianceBar />);
    expect(screen.getByTitle(GREEN)).toBeInTheDocument();
  });

  it('is green for an AGGREGATED node whose origin resolved (regression)', () => {
    // A covered aggregated_derivative vendor (origin US-WA) must stay green —
    // disclosure method must not downgrade resolved coverage.
    render(
      <TreeView
        node={node({ synthesis_mode: 'aggregated_derivative' })}
        complianceBar
      />,
    );
    expect(screen.getByTitle(GREEN)).toBeInTheDocument();
  });

  it("is RED when country is the 'XX' unknown sentinel (regression)", () => {
    // The reported bug: a depth-3 node with Origin 'XX' rendered green. 'XX' is
    // haiCore's unknown-country sentinel — no real origin → red.
    render(<TreeView node={withCountry('XX')} complianceBar />);
    expect(screen.getByTitle(RED)).toBeInTheDocument();
  });

  it("is RED for the legacy '<unknown>' sentinel too", () => {
    render(<TreeView node={withCountry('<unknown>')} complianceBar />);
    expect(screen.getByTitle(RED)).toBeInTheDocument();
  });

  it('is red on a gap node', () => {
    render(
      <TreeView
        node={node({ gap: { kind: 'unauthorized' } as ObservationNode['gap'] })}
        complianceBar
      />,
    );
    expect(screen.getByTitle(RED)).toBeInTheDocument();
  });

  it('COLLAPSED green parent shows RED when a descendant is unresolved (regression)', () => {
    // A green (origin-resolved) root with a red XX child. Rendered collapsed
    // (depth>=2), only the parent's sliver shows — it must surface the buried
    // red so the user sees the cue without expanding.
    const parent = node({ components: [withCountry('XX')] });
    render(<TreeView node={parent} depth={2} complianceBar />);
    // Parent's sliver is red (worst-of-subtree); no green sliver anywhere.
    // (jsdom keeps <details> children in the DOM regardless of open state, so
    // the red leaf also contributes a RED title — hence getAllByTitle.)
    expect(screen.getAllByTitle(RED).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTitle(GREEN)).not.toBeInTheDocument();
  });

  it('EXPANDED green parent shows its own GREEN tone (child draws its own bar)', () => {
    // Same tree rendered expanded (depth<2): the parent shows its own green,
    // and the red child renders its own red bar — both tones present.
    const parent = node({ components: [withCountry('XX')] });
    render(<TreeView node={parent} depth={0} complianceBar />);
    expect(screen.getByTitle(GREEN)).toBeInTheDocument();
    expect(screen.getByTitle(RED)).toBeInTheDocument();
  });

  it('mirrors the live Great Lakes tree: collapsed depth-1 is RED via a depth-3 XX leaf', () => {
    // Exact shape from audit_run_results for GLH-BF-SH-BN-001:
    //   d1 US (green) -> d2 US (green) -> d3 XX identity_redacted leaf (red).
    // Collapsing d1 must surface the buried d3 red. Rendered at depth=0 so d1
    // starts OPEN, then we collapse it and assert the parent's tone flips red.
    const d3 = withCountry('XX');
    const d2 = node({
      components: [d3],
      payload: {
        kind: 'audit', product_id: null, disclosure_data: null, class_ids: [],
        origin: { country_of_origin: 'US', state_province: 'US-OR', city: null,
          plant_address: null, plant_identifier: null, vendor_name: null },
        operational_status: { lead_time_meets: null, capacity: null, delivery_state: null },
      } as ObservationNode['payload'],
    });
    const d1 = node({
      vendor_legal_name: 'Great Lakes Hardware — Cleveland, OH',
      components: [d2],
    });
    const { container } = render(<TreeView node={d1} depth={0} complianceBar />);
    // d1 starts expanded (depth 0): its own bar is green.
    const d1Details = container.querySelector('details') as HTMLDetailsElement;
    const d1Bar = () => d1Details.querySelector(':scope > span[title]') as HTMLElement;
    expect(d1Bar().getAttribute('title')).toBe(GREEN);
    // Collapse d1 → its bar must become worst-of-subtree = red. Wrap the native
    // <details> toggle in act() so React flushes the onToggle setOpen re-render
    // before we read the DOM (without act(), the assertion races the re-render).
    act(() => {
      d1Details.open = false;
      d1Details.dispatchEvent(new Event('toggle', { bubbles: true }));
    });
    expect(d1Bar().getAttribute('title')).toBe(RED);
  });
});

describe('TreeView attestation/annotation overlay (v1.34 P8)', () => {
  const baseAuditNode = node({
    participant_id: '33333333-3333-3333-3333-333333333333',
    vendor_legal_name: 'Acme',
    depth_level: 0,
    payload: { kind: 'audit', product_id: 'SKU-1', disclosure_data: null, class_ids: [],
      origin: { country_of_origin: 'US', state_province: null, city: null,
        plant_address: null, plant_identifier: null, vendor_name: null },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } },
  });

  it('overlay absent: renders no attestation pills (run-detail unchanged)', () => {
    render(<TreeView node={baseAuditNode} />);
    expect(screen.queryByText(/third party audited/i)).toBeNull();
  });

  it('overlay present: renders an attestation pill per entry + Annotate on gap', () => {
    const key = `${baseAuditNode.participant_id}|SKU-1|0`;
    render(
      <TreeView
        node={baseAuditNode}
        overlay={{
          byNodeKey: new Map([[key, {
            attestations: [{ entry_type: null, attestation_kind: 'unsubstantiated_gap' }],
            currentAnnotation: null,
          }]]),
          onAnnotate: () => {},
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /annotate/i })).toBeInTheDocument();
  });
});
