import '@testing-library/jest-dom/vitest';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddEvidenceModal } from '../add-evidence-modal';
import type { LibraryElement } from '@/lib/library-types';

afterEach(() => vi.restoreAllMocks());

function makeElement(over: Partial<LibraryElement> & { key: string; label: string }): LibraryElement {
  return {
    kind: 'artifact',
    validity: false,
    modal_fields: [],
    attribute: null,
    artifacts: [],
    policies: {
      share: { premier: false, trading_pair: false, connection: false, qualified: false },
      require: { premier: false, trading_pair: false, connection: false, qualified: false },
    },
    gap: false,
    ...over,
  };
}

const artifactEl = makeElement({
  key: 'iso_9001_cert',
  label: 'ISO 9001 Certificate',
  kind: 'artifact',
  validity: true,
  modal_fields: ['standard', 'issuer', 'cert_number', 'scope'],
});

const booleanAttrEl = makeElement({
  key: 'liability_cap_present',
  label: 'Liability Cap Present',
  kind: 'attribute',
  value_type: 'boolean',
});

const structuredAttrEl = makeElement({
  key: 'address',
  label: 'HQ Address',
  kind: 'attribute',
  value_type: 'structured',
});

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
}

it('artifact element offers Upload and URL modes with registry-driven fields and valid-until', () => {
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByRole('radio', { name: /upload/i })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /url/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^standard$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^issuer$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/certificate number/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^scope$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/valid until/i)).toBeInTheDocument();
});

it('URL mode posts JSON with entered fields', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<AddEvidenceModal element={artifactEl} onClose={onClose} onSaved={onSaved} />);

  fireEvent.click(screen.getByRole('radio', { name: /url/i }));
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'My Cert' } });
  fireEvent.change(screen.getByLabelText(/source url/i), { target: { value: 'https://example.com/cert.pdf' } });
  fireEvent.change(screen.getByLabelText(/^standard$/i), { target: { value: 'ISO 9001' } });
  fireEvent.change(screen.getByLabelText(/valid until/i), { target: { value: '2027-01-01' } });

  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/account/library/artifacts/url');
  expect(init.method).toBe('POST');
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    element_key: 'iso_9001_cert',
    title: 'My Cert',
    source_url: 'https://example.com/cert.pdf',
    standard: 'ISO 9001',
    valid_until: '2027-01-01T00:00:00Z',
  });
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

it('upload mode posts FormData with the file and rejects oversize client-side', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  const { unmount } = render(
    <AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />,
  );

  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Doc' } });
  const file = new File([new Uint8Array(8)], 'doc.pdf', { type: 'application/pdf' });
  const input = screen.getByLabelText(/file/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/account/library/artifacts');
  expect(init.method).toBe('POST');
  expect(init.body).toBeInstanceOf(FormData);
  expect((init.body as FormData).get('element_key')).toBe('iso_9001_cert');
  expect((init.body as FormData).get('file')).toBeTruthy();
  unmount();

  // Second render: oversize file rejected client-side, no fetch.
  fetchMock.mockClear();
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Big' } });
  const bigFile = new File([new Uint8Array(8)], 'big.pdf', { type: 'application/pdf' });
  Object.defineProperty(bigFile, 'size', { value: 10 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [bigFile] } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/10MB/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('boolean attribute renders Yes/No select and PUTs a real boolean', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  const onSaved = vi.fn();
  render(<AddEvidenceModal element={booleanAttrEl} onClose={vi.fn()} onSaved={onSaved} />);

  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: 'true' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/account/library/attributes/liability_cap_present');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual({ value: true });
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

it('structured attribute rejects invalid JSON without fetching', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={structuredAttrEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not json' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/valid JSON/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('attribute_with_evidence shows the helper line', () => {
  const el = makeElement({
    key: 'insurance',
    label: 'Insurance',
    kind: 'attribute_with_evidence',
    value_type: 'string',
  });
  render(<AddEvidenceModal element={el} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText(/matching document element/i)).toBeInTheDocument();
});

it('shows the API error and stays open on failure', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: () =>
      Promise.resolve({ error: { code: 'BAD', message: 'justification of at least 10 characters required' } }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const onClose = vi.fn();
  render(<AddEvidenceModal element={booleanAttrEl} onClose={onClose} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/justification of at least 10 characters required/i)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('clears a stale error when switching modes', async () => {
  vi.stubGlobal('fetch', okFetch());
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /url/i }));
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'X' } });
  fireEvent.change(screen.getByLabelText(/source url/i), { target: { value: 'ftp://nope' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByText(/http:\/\//i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: /upload/i }));
  expect(screen.queryByText(/http:\/\//i)).not.toBeInTheDocument();
});

it('rejects a non-object structured value without fetching', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={structuredAttrEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByRole('textbox'), { target: { value: '[1,2,3]' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/JSON object/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('renders nothing when element is null', () => {
  const { container } = render(<AddEvidenceModal element={null} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it('artifact element offers an Existing document mode; attribute elements do not', () => {
  const { unmount } = render(
    <AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />,
  );
  expect(screen.getByRole('radio', { name: /existing document/i })).toBeInTheDocument();
  unmount();
  render(<AddEvidenceModal element={booleanAttrEl} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.queryByRole('radio', { name: /existing document/i })).toBeNull();
});

const DOCUMENTS = {
  documents: [
    {
      artifact_id: 'a1',
      title: 'Quality Manual',
      element_key: 'quality_manual',
      origin: 'upload',
      mime_type: 'application/pdf',
      file_size_bytes: 1234,
      source_url: null,
      has_file: true,
      created_at: '2026-06-10T12:00:00Z',
    },
    {
      artifact_id: 'a2',
      title: 'Insurance Certificate',
      element_key: 'insurance_cert',
      origin: 'url',
      mime_type: null,
      file_size_bytes: null,
      source_url: 'https://example.com/ins.pdf',
      has_file: false,
      created_at: '2026-05-01T00:00:00Z',
    },
    {
      artifact_id: 'a3',
      title: 'Legacy Drawing',
      element_key: 'tech_drawing',
      origin: 'auto_gathered',
      mime_type: 'application/pdf',
      file_size_bytes: 5678,
      source_url: null,
      has_file: true,
      created_at: null, // defensive: haiCore may omit/null the timestamp
    },
  ],
};

function documentsFetch(listBody: unknown = DOCUMENTS) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/account/library/documents') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(listBody) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
}

it('selecting Existing document fetches the library documents and populates the dropdown; picking one prefills the title', async () => {
  const fetchMock = documentsFetch();
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/account/library/documents'),
  );

  const select = (await screen.findByLabelText(/^document$/i)) as HTMLSelectElement;
  expect(
    screen.getByRole('option', { name: 'Quality Manual — uploaded 2026-06-10' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'Insurance Certificate — linked 2026-05-01' }),
  ).toBeInTheDocument();
  // Null created_at: the date is simply omitted from the label.
  expect(
    screen.getByRole('option', { name: 'Legacy Drawing — gathered' }),
  ).toBeInTheDocument();

  fireEvent.change(select, { target: { value: 'a1' } });
  expect((screen.getByLabelText(/^title$/i) as HTMLInputElement).value).toBe('Quality Manual');
});

it('re-selecting a document re-prefills an untouched title but never clobbers a user-edited one', async () => {
  vi.stubGlobal('fetch', documentsFetch());
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));
  const select = (await screen.findByLabelText(/^document$/i)) as HTMLSelectElement;
  const title = screen.getByLabelText(/^title$/i) as HTMLInputElement;

  // Untouched title follows the selection.
  fireEvent.change(select, { target: { value: 'a1' } });
  expect(title.value).toBe('Quality Manual');
  fireEvent.change(select, { target: { value: 'a2' } });
  expect(title.value).toBe('Insurance Certificate');

  // A user edit sticks across re-selection.
  fireEvent.change(title, { target: { value: 'My Custom Title' } });
  fireEvent.change(select, { target: { value: 'a1' } });
  expect(title.value).toBe('My Custom Title');
});

it('shows a friendly empty state when the library has no reusable documents', async () => {
  // PO 2026-06-11: drafts are excluded from reuse (haiCore filters them out),
  // so the empty state nudges toward accepting/adding rather than uploading.
  vi.stubGlobal('fetch', documentsFetch({ documents: [] }));
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));

  expect(
    await screen.findByText(/no reusable documents yet — accept or add one first\./i),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText(/^document$/i)).toBeNull();
});

it('existing-document mode posts element_key + source_artifact_id + title + optional fields', async () => {
  const fetchMock = documentsFetch();
  vi.stubGlobal('fetch', fetchMock);
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<AddEvidenceModal element={artifactEl} onClose={onClose} onSaved={onSaved} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));
  const select = await screen.findByLabelText(/^document$/i);
  fireEvent.change(select, { target: { value: 'a1' } });
  // Title prefilled from the document, but editable.
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Quality Manual (QMS)' } });
  fireEvent.change(screen.getByLabelText(/^issuer$/i), { target: { value: 'TUV' } });
  fireEvent.change(screen.getByLabelText(/valid until/i), { target: { value: '2027-01-01' } });

  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/library/artifacts/from-existing',
      expect.anything(),
    ),
  );
  const call = fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === '/api/account/library/artifacts/from-existing',
  )!;
  const init = call[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({
    element_key: 'iso_9001_cert',
    source_artifact_id: 'a1',
    title: 'Quality Manual (QMS)',
    issuer: 'TUV',
    valid_until: '2027-01-01T00:00:00Z',
  });
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

it('existing-document mode requires a selected document before posting', async () => {
  const fetchMock = documentsFetch();
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));
  await screen.findByLabelText(/^document$/i);
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/choose a document to reuse/i)).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.filter(
      (c: unknown[]) => c[0] === '/api/account/library/artifacts/from-existing',
    ),
  ).toHaveLength(0);
});

it('existing-document mode surfaces a haiCore 404 message and stays open', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/account/library/documents') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DOCUMENTS) });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          // haiCore wire code for a missing/foreign/draft source is the
          // generic NOT_FOUND (like every library route).
          error: { code: 'NOT_FOUND', message: 'Source document no longer exists' },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const onClose = vi.fn();
  render(<AddEvidenceModal element={artifactEl} onClose={onClose} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));
  fireEvent.change(await screen.findByLabelText(/^document$/i), { target: { value: 'a1' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/source document no longer exists/i)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('shows a load-error state when the documents fetch fails', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /existing document/i }));

  expect(await screen.findByText(/could not load your documents/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/^document$/i)).toBeNull();
});

it('URL mode offers a No-document-expiration checkbox that sends no_expiry and disables the date (PO 2026-06-11)', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  const { unmount } = render(
    <AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />,
  );

  // Upload mode: no checkbox.
  expect(screen.queryByLabelText(/no document expiration/i)).toBeNull();

  fireEvent.click(screen.getByRole('radio', { name: /url/i }));
  const checkbox = screen.getByLabelText(/no document expiration/i) as HTMLInputElement;
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Evergreen Terms' } });
  fireEvent.change(screen.getByLabelText(/source url/i), { target: { value: 'https://example.com/terms' } });
  fireEvent.click(checkbox);
  expect((screen.getByLabelText(/valid until/i) as HTMLInputElement).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.no_expiry).toBe(true);
  expect(body.valid_until).toBeUndefined();
  unmount();

  // Elements without validity tracking get neither the date nor the checkbox in URL mode.
  const noValidity = makeElement({ key: 'w9_form', label: 'W-9', validity: false });
  render(<AddEvidenceModal element={noValidity} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: /url/i }));
  expect(screen.queryByLabelText(/no document expiration/i)).toBeNull();
});

it('URL mode requires either a Valid-until date or the no-expiration checkbox (PO 2026-06-11)', async () => {
  const fetchMock = okFetch();
  vi.stubGlobal('fetch', fetchMock);
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('radio', { name: /url/i }));
  fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Terms' } });
  fireEvent.change(screen.getByLabelText(/source url/i), { target: { value: 'https://example.com/terms' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/valid until date or check/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  // Providing the date satisfies the rule.
  fireEvent.change(screen.getByLabelText(/valid until/i), { target: { value: '2027-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
});

it('upload mode shows an explicit file-picker affordance with the selected filename', () => {
  render(<AddEvidenceModal element={artifactEl} onClose={vi.fn()} onSaved={vi.fn()} />);
  // Explicit control + empty state.
  expect(screen.getByText('Choose file…')).toBeInTheDocument();
  expect(screen.getByText('No file selected')).toBeInTheDocument();
  // Picking a file via the (label-associated) native input shows its name.
  const file = new File([new Uint8Array(4)], 'cert.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText(/file/i), { target: { files: [file] } });
  expect(screen.getByText('cert.pdf')).toBeInTheDocument();
  expect(screen.queryByText('No file selected')).toBeNull();
});
