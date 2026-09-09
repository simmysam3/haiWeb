import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { FacilityBlock, OriginManifest } from '@haiwave/protocol';
import { ManifestDetailDrawer } from '../manifest-detail-drawer';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const block = (over: Partial<FacilityBlock> = {}): FacilityBlock => ({
  facility_id: 'fac-design-1',
  facility_name: 'Coastal Design House',
  country_code: 'CN',
  region_code: 'CN-GD',
  facility_type: 'design_center',
  verified: true,
  verification_method: 'third_party_audit',
  last_verified_at: '2026-08-01T00:00:00.000Z',
  ...over,
});

// A manifest whose manufacturing entry is a TW fab — the spec's walk case is CN design and
// CN firmware over TW manufacture. `over` sets only the two dimension keys per case.
const manifest = (over: Partial<OriginManifest> = {}): OriginManifest =>
  ({
    origin_manifest_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    external_product_id: 'RADIO-1',
    product_name: 'Field radio',
    manifest_version: 3,
    domestic_context: 'US',
    origin_entries: [
      {
        entry_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        entry_type: 'primary_manufacture',
        facility: block({
          facility_id: 'plant-1',
          facility_name: 'Hsinchu Fab',
          country_code: 'TW',
          region_code: undefined,
          facility_type: 'fabrication',
        }),
        provenance_depth: 'facility',
        subcomponent_origins: [],
      },
    ],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-02T00:00:00.000Z',
    ...over,
  }) as OriginManifest;

async function openDrawer(body: OriginManifest) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
  render(<ManifestDetailDrawer productId="RADIO-1" productName="Field radio" onClose={() => {}} />);
  // The SKU dd is the load anchor; the product name appears twice (drawer title + dd).
  await waitFor(() => expect(screen.getByText('RADIO-1')).toBeInTheDocument());
}

// D-218 (2026-09-08): design and firmware origin are separate vendor-declared dimensions; each
// declared block gets a card, an undeclared one gets nothing at all (no placeholder, spec §6).
describe('<ManifestDetailDrawer> dimension origin cards', () => {
  it('renders a card per declared dimension, above the entries, with entity, country, site, verification and the verified badge', async () => {
    await openDrawer(
      manifest({
        design_origin: block(),
        firmware_origin: block({
          facility_id: 'fw-signer-7',
          facility_name: undefined,
          region_code: undefined,
          facility_type: 'firmware',
          verified: false,
          verification_method: 'self_declared',
          last_verified_at: undefined,
        }),
      }),
    );

    const design = screen.getByTestId('dimension-origin-design');
    expect(within(design).getByText('Design origin')).toBeInTheDocument();
    expect(within(design).getByText('Coastal Design House')).toBeInTheDocument();
    expect(within(design).getByText('(design center)')).toBeInTheDocument();
    expect(within(design).getByText('CN')).toBeInTheDocument();
    expect(within(design).getByText('CN-GD')).toBeInTheDocument();
    expect(within(design).getByText('third party audit')).toBeInTheDocument();
    expect(within(design).getByText(/2026/)).toBeInTheDocument();   // last_verified_at; locale formats the rest
    expect(within(design).getByText('Verified')).toBeInTheDocument();

    // Entity falls back to facility_id when the vendor declared no name; no Site row without a region.
    const firmware = screen.getByTestId('dimension-origin-firmware');
    expect(within(firmware).getByText('Firmware origin')).toBeInTheDocument();
    expect(within(firmware).getByText('fw-signer-7')).toBeInTheDocument();
    expect(within(firmware).queryByText('Site')).toBeNull();
    expect(within(firmware).getByText('Unverified')).toBeInTheDocument();

    // Spec §6: "two cards above the entries".
    const entriesHeading = screen.getByText('Origin entries (1)');
    expect(design.compareDocumentPosition(entriesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders only the declared dimension when the other is null', async () => {
    await openDrawer(manifest({ design_origin: block(), firmware_origin: null }));
    expect(screen.getByTestId('dimension-origin-design')).toBeInTheDocument();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
  });

  it('renders no card when the vendor declared neither dimension', async () => {
    await openDrawer(manifest({ design_origin: null, firmware_origin: null }));
    expect(screen.queryByTestId('dimension-origin-design')).toBeNull();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
    expect(screen.getByText('Origin entries (1)')).toBeInTheDocument();
  });

  it('renders no card for an old-shape manifest that carries neither key (a 3.85.0 Central)', async () => {
    await openDrawer(manifest());
    expect(screen.queryByTestId('dimension-origin-design')).toBeNull();
    expect(screen.queryByTestId('dimension-origin-firmware')).toBeNull();
  });
});
