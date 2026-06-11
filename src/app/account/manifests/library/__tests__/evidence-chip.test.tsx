import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('skips a superseded artifact and links the active one', () => {
    const el: LibraryElement = {
      ...baseEl,
      gap: false,
      artifacts: [
        {
          id: 'old',
          elementKey: 'iso_9001_cert',
          title: 'ISO 9001:2008 (old)',
          status: 'superseded',
          origin: 'upload',
          sourceTier: 'document_backed',
          sourceUrl: null,
          mimeType: 'application/pdf',
          validFrom: null,
          validUntil: null,
          affirmedBy: null,
          affirmedAt: null,
        },
        {
          id: 'new',
          elementKey: 'iso_9001_cert',
          title: 'ISO 9001:2015 (active)',
          status: 'active',
          origin: 'upload',
          sourceTier: 'document_backed',
          sourceUrl: null,
          mimeType: 'application/pdf',
          validFrom: null,
          validUntil: null,
          affirmedBy: null,
          affirmedAt: null,
        },
      ],
    };
    render(<EvidenceChip element={el} onAdd={() => {}} />);
    expect(screen.getByRole('link', { name: /active/ }).getAttribute('href')).toBe(
      '/api/account/library/artifacts/new/file',
    );
    expect(screen.queryByRole('link', { name: /old/ })).not.toBeInTheDocument();
  });

  it('GapBadge renders the needed marker with a definition tooltip', () => {
    render(<GapBadge />);
    expect(screen.getByText('Needed')).toBeInTheDocument();
    const pill = screen.getByTestId('pill');
    const describedby = pill.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby as string)).toHaveTextContent(
      /no document or value on file/i,
    );
  });
});

describe('EvidenceChip draft actions', () => {
  const draftArtifactEl: LibraryElement = {
    ...baseEl,
    gap: false,
    artifacts: [
      {
        id: 'dr1',
        elementKey: 'iso_9001_cert',
        title: 'ISO 9001 (gathered)',
        status: 'draft',
        origin: 'auto_gathered',
        sourceTier: 'auto_gathered',
        sourceUrl: 'https://example.com/cert',
        mimeType: null,
        validFrom: null,
        validUntil: null,
        affirmedBy: null,
        affirmedAt: null,
      },
    ],
  };

  it('renders Accept/Reject for a draft artifact and fires the callback with (id, action)', () => {
    const onDraftAction = vi.fn();
    render(<EvidenceChip element={draftArtifactEl} onAdd={() => {}} onDraftAction={onDraftAction} />);
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    expect(onDraftAction).toHaveBeenCalledWith('dr1', 'affirm');
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onDraftAction).toHaveBeenCalledWith('dr1', 'reject');
  });

  it('renders Accept/Reject for a draft attribute using the attribute id', () => {
    const el: LibraryElement = {
      ...baseEl,
      key: 'liability_cap_present',
      kind: 'attribute',
      gap: false,
      attribute: {
        id: 'at-draft',
        elementKey: 'liability_cap_present',
        valueJson: true,
        status: 'draft',
        sourceTier: 'auto_gathered',
        evidenceArtifactId: null,
        validUntil: null,
        affirmedBy: null,
      },
    };
    const onDraftAction = vi.fn();
    render(<EvidenceChip element={el} onAdd={() => {}} onDraftAction={onDraftAction} />);
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    expect(onDraftAction).toHaveBeenCalledWith('at-draft', 'affirm');
  });

  it('omits the buttons when the displayed item is not a draft', () => {
    const el: LibraryElement = {
      ...draftArtifactEl,
      artifacts: [{ ...draftArtifactEl.artifacts[0], status: 'active' }],
    };
    render(<EvidenceChip element={el} onAdd={() => {}} onDraftAction={() => {}} />);
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull();
  });

  it('omits the buttons when onDraftAction is not provided', () => {
    render(<EvidenceChip element={draftArtifactEl} onAdd={() => {}} />);
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull();
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
