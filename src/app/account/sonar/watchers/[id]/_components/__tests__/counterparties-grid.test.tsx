import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CounterpartiesGrid } from '../counterparties-grid';
import { makeResult } from './counterparties-grid.test-fixtures';

describe('<CounterpartiesGrid>', () => {
  it('groups results by counterparty and renders summary rows', () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
          }),
          makeResult({
            counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            counterparty_name: 'Brass Co',
            signal_type: 'capacity_utilization_band',
            payload: {
              kind: 'direct',
              band: 'high',
              observed_at: '2026-05-27T10:00:00Z',
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('Apex')).toBeInTheDocument();
    expect(screen.getByText('Brass Co')).toBeInTheDocument();
  });

  it('aggregates null-identity rows as "Identity withheld"', () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({ counterparty_participant_id: null, tier: 2 }),
          makeResult({ counterparty_participant_id: null, tier: 2 }),
        ]}
      />,
    );
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
  });

  it('a known id with no resolvable name renders unresolved — truncated id, never the redaction chip', () => {
    render(
      <CounterpartiesGrid
        results={[makeResult({ counterparty_name: null })]}
      />,
    );
    // aaaaaaaa is the fixture id's first 8 chars.
    expect(screen.getByText(/aaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByText(/name unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText('Identity withheld')).toBeNull();
    expect(screen.queryByText('Vendor Name Not Disclosed')).toBeNull();
  });
  it('null participant id (wire redaction) still renders the chip', () => {
    render(<CounterpartiesGrid results={[makeResult({ counterparty_participant_id: null })]} />);
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
  });

  it('undisclosed rows group per sub-tier cluster with the tier-1 parent named (Ruling 4)', () => {
    const tier1A = makeResult({ result_id: 'a1111111-1111-1111-1111-111111111111', counterparty_name: 'Arno Industrial' });
    const tier1B = makeResult({
      result_id: 'b2222222-2222-2222-2222-222222222222',
      counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      counterparty_name: 'Mekong Supply',
    });
    const subA = makeResult({
      counterparty_participant_id: null, tier: 2,
      aggregated_under_tier_1: 'a1111111-1111-1111-1111-111111111111',
    });
    const subB = makeResult({
      counterparty_participant_id: null, tier: 2,
      aggregated_under_tier_1: 'b2222222-2222-2222-2222-222222222222',
    });
    render(<CounterpartiesGrid results={[tier1A, tier1B, subA, subB]} />);
    // Two distinct undisclosed groups, each attributed to its parent.
    expect(screen.getAllByText('Identity withheld')).toHaveLength(2);
    expect(screen.getByText(/Arno Industrial \+/)).toBeInTheDocument();
    expect(screen.getByText(/Mekong Supply \+/)).toBeInTheDocument();
  });

  // Grain is the SUPPLIER, not the observation cluster (owner ruling 2026-08-12).
  // haiCore mints the letter at serve time (protocol 3.67.0); the grid's only job
  // is to render each cluster's OWN alias. The fixture is run ff880a61's real
  // shape: one vendor with two tier-1 rows, hence two sub-tier clusters, which
  // before the vendor-grain mint drew two different letters. A fixture with a
  // single cluster per vendor cannot over-count and would prove nothing, and the
  // second vendor is what stops a hardcoded 'A' from passing.
  it("renders each undisclosed cluster's own supplier_alias — one vendor's two clusters share a letter, a second vendor gets its own", () => {
    const arnoParticipant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const arnoCluster1 = 'a1111111-1111-1111-1111-111111111111';
    const arnoCluster2 = 'a2222222-2222-2222-2222-222222222222';
    const mekongCluster = 'b1111111-1111-1111-1111-111111111111';

    // Same vendor, two tier-1 path roots — this is what makes two clusters.
    const tier1Arno1 = makeResult({
      result_id: arnoCluster1,
      counterparty_participant_id: arnoParticipant,
      counterparty_name: 'Arno Industrial',
    });
    const tier1Arno2 = makeResult({
      result_id: arnoCluster2,
      counterparty_participant_id: arnoParticipant,
      counterparty_name: 'Arno Industrial',
    });
    const tier1Mekong = makeResult({
      result_id: mekongCluster,
      counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      counterparty_name: 'Mekong Supply',
    });

    // Sub-tier rows as haiCore serves them: both of Arno's clusters carry the
    // SAME letter because the mint keys on the vendor behind the tier-1 root.
    const subArno1 = makeResult({
      counterparty_participant_id: null,
      tier: 2,
      aggregated_under_tier_1: arnoCluster1,
      supplier_alias: 'A',
    });
    const subArno2 = makeResult({
      counterparty_participant_id: null,
      tier: 2,
      aggregated_under_tier_1: arnoCluster2,
      supplier_alias: 'A',
    });
    const subMekong = makeResult({
      counterparty_participant_id: null,
      tier: 2,
      aggregated_under_tier_1: mekongCluster,
      supplier_alias: 'B',
    });

    render(
      <CounterpartiesGrid
        results={[tier1Arno1, tier1Arno2, tier1Mekong, subArno1, subArno2, subMekong]}
      />,
    );

    // One vendor, one letter — on BOTH of its clusters.
    expect(screen.getAllByText('Supplier A')).toHaveLength(2);
    // A different vendor keeps its own letter: the grid reads each row's alias
    // rather than a constant or the first row's.
    expect(screen.getByText('Supplier B')).toBeInTheDocument();
    // Every undisclosed cluster here has an alias, so the generic fallback —
    // what the hardcoded `alias: null` produced — must be gone entirely.
    expect(screen.queryByText('Identity withheld')).toBeNull();
  });

  it('a redacted cluster is findable by typing its parent tier-1 name (fix wave)', async () => {
    const tier1 = makeResult({
      result_id: 'a1111111-1111-1111-1111-111111111111',
      counterparty_name: 'Arno Industrial',
    });
    const sub = makeResult({
      counterparty_participant_id: null,
      tier: 2,
      aggregated_under_tier_1: 'a1111111-1111-1111-1111-111111111111',
    });
    const other = makeResult({
      counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      counterparty_name: 'Brass Co',
    });
    render(<CounterpartiesGrid results={[tier1, sub, other]} />);
    // Three distinct groups (tier1's own row, the redacted sub-tier cluster
    // attributed to it, and the unrelated named vendor) before any filtering.
    expect(screen.getByText('3 of 3 counterparties')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Arno');
    // The redacted cluster's search/sort key must incorporate parentName, not
    // just the '￿' sentinel — otherwise typing the parent's name can
    // never surface it, and it silently drops out of the "N of M" count.
    expect(screen.getByText(/Arno Industrial \+/)).toBeInTheDocument();
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
    expect(screen.queryByText('Brass Co')).toBeNull();
    expect(screen.getByText('2 of 3 counterparties')).toBeInTheDocument();
  });

  it('reveals product sub-list and signal panels when the vendor is expanded', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: null,
          }),
        ]}
      />,
    );
    // The company row is the only collapse level. Expanding it shows every
    // product and its signal panels at once — products are static labels, not
    // toggles. Because the result carries external_product_id=null, the
    // sub-item is the canonical vendor-aggregate placeholder.
    await userEvent.click(screen.getByRole('button', { name: /Apex/i }));
    expect(await screen.findByText(/Vendor-aggregate/i)).toBeInTheDocument();
    expect(screen.getByText(/sample/i)).toBeInTheDocument();
  });

  it('search input filters counterparties by name', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex Metals',
          }),
          makeResult({
            counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            counterparty_name: 'Brass Co',
            signal_type: 'capacity_utilization_band',
            payload: {
              kind: 'direct',
              band: 'high',
              observed_at: '2026-05-27T10:00:00Z',
            },
          }),
        ]}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Apex');
    expect(screen.getByText('Apex Metals')).toBeInTheDocument();
    expect(screen.queryByText('Brass Co')).toBeNull();
  });

  it('renders one product sub-row per external_product_id within a vendor (Plan 3 E3)', async () => {
    render(
      <CounterpartiesGrid
        results={[
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: 'SKU-A',
            signal_type: 'published_lead_time',
            payload: { kind: 'direct', days: 10, observed_at: '2026-05-27T10:00:00Z' },
          }),
          makeResult({
            counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            counterparty_name: 'Apex',
            external_product_id: 'SKU-B',
            signal_type: 'published_lead_time',
            payload: { kind: 'direct', days: 14, observed_at: '2026-05-27T10:00:00Z' },
          }),
        ]}
        productNameByExtId={{ 'SKU-A': 'Widget A', 'SKU-B': 'Widget B' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Apex/i }));
    // Both products surface inside the vendor row as static labels (no toggle),
    // named via the map prop.
    expect(await screen.findByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Widget B')).toBeInTheDocument();
    // Panels render immediately — the LeadTimeTriplet (Published panel shows
    // days) is visible without any per-product click.
    expect(screen.getByText('10d')).toBeInTheDocument();
  });
});
