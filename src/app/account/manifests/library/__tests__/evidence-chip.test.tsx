import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceChip } from '../evidence-chip';
import { GapBadge } from '../gap-badge';
import { Pill } from '@/components/pill';
import type { LibraryElement } from '@/lib/library-types';

afterEach(() => vi.restoreAllMocks());

const baseEl: LibraryElement = {
  key: 'iso_9001_cert',
  label: 'ISO 9001 Certificate',
  kind: 'artifact',
  validity: true,
  modal_fields: [],
  attribute: null,
  artifacts: [],
  policies: {
    share: { premier: true, trading_pair: true, connection: true, qualified: true },
    require: { premier: false, trading_pair: false, connection: false, qualified: false },
  },
  gap: true,
};

describe('EvidenceChip', () => {
  it('renders the add state for a gapped artifact element', () => {
    render(<EvidenceChip element={baseEl} onAdd={() => {}} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('renders an uploaded document as a file link with status pill and validity date', () => {
    const el: LibraryElement = {
      ...baseEl,
      gap: false,
      artifacts: [
        {
          id: 'a1',
          elementKey: 'iso_9001_cert',
          title: 'ISO 9001:2015',
          status: 'active',
          origin: 'upload',
          sourceTier: 'document_backed',
          sourceUrl: null,
          mimeType: 'application/pdf',
          validFrom: null,
          validUntil: '2028-03-01T00:00:00Z',
          affirmedBy: null,
          affirmedAt: null,
        },
      ],
    };
    render(<EvidenceChip element={el} onAdd={() => {}} />);
    const link = screen.getByRole('link', { name: /ISO 9001:2015/ });
    expect(link.getAttribute('href')).toBe('/api/account/library/artifacts/a1/file');
    expect(screen.getByText(/valid until/i)).toBeInTheDocument();
  });

  it('renders a url-origin document linking to its source', () => {
    const el: LibraryElement = {
      ...baseEl,
      key: 'terms_of_sale',
      gap: false,
      artifacts: [
        {
          id: 'a2',
          elementKey: 'terms_of_sale',
          title: 'Terms',
          status: 'active',
          origin: 'url',
          sourceTier: 'document_backed',
          sourceUrl: 'https://example.com/terms',
          mimeType: null,
          validFrom: null,
          validUntil: null,
          affirmedBy: null,
          affirmedAt: null,
        },
      ],
    };
    render(<EvidenceChip element={el} onAdd={() => {}} />);
    expect(screen.getByRole('link', { name: /Terms/ }).getAttribute('href')).toBe(
      'https://example.com/terms',
    );
  });

  it('renders attribute values with boolean formatting', () => {
    const el: LibraryElement = {
      ...baseEl,
      key: 'liability_cap_present',
      kind: 'attribute',
      value_type: 'boolean',
      gap: false,
      attribute: {
        id: 'at1',
        elementKey: 'liability_cap_present',
        valueJson: true,
        status: 'active',
        sourceTier: 'self_declared',
        evidenceArtifactId: null,
        validUntil: null,
        affirmedBy: null,
      },
    };
    render(<EvidenceChip element={el} onAdd={() => {}} />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('GapBadge renders the needed marker with tooltip', () => {
    render(<GapBadge />);
    expect(screen.getByText('Needed')).toBeInTheDocument();
  });
});

describe('library pill definitions', () => {
  it('renders library_status="expired" with the problem tone and no dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Pill category="library_status" value="expired" />);
    const pill = container.querySelector('[data-testid="pill"]');
    expect(pill?.className).toContain('text-problem');
    expect(warn).not.toHaveBeenCalled();
  });

  it('resolves every new library_status and library_source value without dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        {['draft', 'active', 'expired', 'superseded', 'revoked'].map((v) => (
          <Pill key={`s-${v}`} category="library_status" value={v} />
        ))}
        {['self_declared', 'auto_gathered', 'document_backed', 'verified'].map((v) => (
          <Pill key={`src-${v}`} category="library_source" value={v} />
        ))}
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
