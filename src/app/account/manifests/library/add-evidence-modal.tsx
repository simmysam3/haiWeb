'use client';

import { useState } from 'react';
import type { LibraryElement } from '@/lib/library-types';
import { Modal } from '@/components/modal';

interface AddEvidenceModalProps {
  element: LibraryElement | null;
  onClose: () => void;
  onSaved: () => void;
}

const FIELD_LABELS: Record<'standard' | 'issuer' | 'cert_number' | 'scope', string> = {
  standard: 'Standard',
  issuer: 'Issuer',
  cert_number: 'Certificate number',
  scope: 'Scope',
};

const MAX_BYTES = 10 * 1024 * 1024;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(n: string): string {
  return n.padStart(2, '0');
}

/**
 * One reusable document from GET /api/account/library/documents. Contract
 * (haiCore built in parallel): wrapped envelope {documents: [...]} with
 * artifact_id/title/element_key/origin/mime_type/file_size_bytes/source_url/
 * has_file/created_at per document; the BFF passes it through verbatim.
 * The modal only consumes the fields below.
 */
interface LibraryDocument {
  artifact_id: string;
  title: string;
  origin: string;
  created_at: string | null;
}

const ORIGIN_LABELS: Record<string, string> = {
  upload: 'uploaded',
  url: 'linked',
  auto_gathered: 'gathered',
};

function describeDocument(doc: LibraryDocument): string {
  const origin = ORIGIN_LABELS[doc.origin] ?? doc.origin;
  // Defensive: omit the date when haiCore nulls/omits the timestamp.
  const date = typeof doc.created_at === 'string' ? ` ${doc.created_at.slice(0, 10)}` : '';
  return `${doc.title} — ${origin}${date}`;
}

/**
 * Pulls a human-readable message out of whatever the BFF returned. On a 4xx,
 * with-hai-core.ts forwards haiCore's body verbatim ({error:{code,message}});
 * on a 500 / missing body it falls back to {error: "<string>"}. Handle both.
 */
function extractError(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = (err as { message: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
  }
  return null;
}

export function AddEvidenceModal({ element, onClose, onSaved }: AddEvidenceModalProps) {
  if (element === null) return null;
  return <AddEvidenceForm key={element.key} element={element} onClose={onClose} onSaved={onSaved} />;
}

function AddEvidenceForm({
  element,
  onClose,
  onSaved,
}: {
  element: LibraryElement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'upload' | 'url' | 'existing'>('upload');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  // Valid-until is segmented month/year/day, all pre-selected to today (PO
  // 2026-06-11): expiry dates are rarely day-sensitive, so the picker state at
  // submit time is captured as intentional — a value is always present.
  const today = new Date();
  const [vuMonth, setVuMonth] = useState(String(today.getMonth() + 1));
  const [vuYear, setVuYear] = useState(String(today.getFullYear()));
  const [vuDay, setVuDay] = useState(String(today.getDate()));
  const vuDays = daysInMonth(Number(vuYear), Number(vuMonth));
  const validUntil = `${vuYear}-${pad2(vuMonth)}-${pad2(vuDay)}`;
  // URL mode only (PO 2026-06-11): explicit "never expires", mutually exclusive
  // with a Valid-until date — haiCore stores it distinctly from a blank date.
  const [noExpiry, setNoExpiry] = useState(false);

  /** Month/year changes clamp an out-of-range day (e.g. Jan 31 → Feb 28). */
  function clampDay(year: string, month: string) {
    const max = daysInMonth(Number(year), Number(month));
    setVuDay((d) => (Number(d) > max ? String(max) : d));
  }
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<LibraryDocument[] | null>(null);
  const [docsState, setDocsState] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [selectedDocId, setSelectedDocId] = useState('');
  // Last title we auto-prefilled from a document selection. Re-selection only
  // re-prefills while the title is empty or still equal to this value — a
  // user-edited title is never clobbered.
  const [prefilledTitle, setPrefilledTitle] = useState<string | null>(null);
  const [attrValue, setAttrValue] = useState(''); // string / structured raw text
  const [boolValue, setBoolValue] = useState('false');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAttribute = element.kind === 'attribute' || element.kind === 'attribute_with_evidence';

  function setField(k: string, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  function optionalFields(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of element.modal_fields) {
      const v = fields[k]?.trim();
      if (v) out[k] = v;
    }
    if (element.validity && validUntil) out.valid_until = `${validUntil}T00:00:00Z`;
    return out;
  }

  async function loadDocuments() {
    setDocsState('loading');
    try {
      const res = await fetch('/api/account/library/documents');
      if (!res.ok) throw new Error(`GET documents: ${res.status}`);
      const body = (await res.json()) as { documents?: LibraryDocument[] };
      setDocs(Array.isArray(body.documents) ? body.documents : []);
      setDocsState('loaded');
    } catch {
      setDocsState('error');
    }
  }

  async function send(url: string, init: RequestInit) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          /* non-JSON body */
        }
        setError(extractError(body) ?? 'Save failed — try again');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Save failed — try again');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (isAttribute) {
      let value: unknown;
      if (element.value_type === 'boolean') {
        value = boolValue === 'true';
      } else if (element.value_type === 'structured') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(attrValue);
        } catch {
          setError('Enter valid JSON');
          return;
        }
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
          setError('Value must be a JSON object');
          return;
        }
        value = parsed;
      } else {
        value = attrValue;
      }
      await send(`/api/account/library/attributes/${encodeURIComponent(element.key)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      return;
    }

    // artifact
    if (mode === 'upload') {
      if (!file) {
        setError('Choose a file to upload');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('File exceeds the 10MB limit');
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('element_key', element.key);
      form.append('title', title);
      for (const [k, v] of Object.entries(optionalFields())) form.append(k, v);
      await send('/api/account/library/artifacts', { method: 'POST', body: form });
      return;
    }

    // existing-document mode — reuse a library document as evidence here
    if (mode === 'existing') {
      if (!selectedDocId) {
        setError('Choose a document to reuse');
        return;
      }
      await send('/api/account/library/artifacts/from-existing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          element_key: element.key,
          source_artifact_id: selectedDocId,
          title,
          ...optionalFields(),
        }),
      });
      return;
    }

    // url mode
    if (!/^https?:\/\//.test(sourceUrl)) {
      setError('Enter a URL starting with http:// or https://');
      return;
    }
    const urlFields = optionalFields();
    if (noExpiry) delete urlFields.valid_until;
    await send('/api/account/library/artifacts/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        element_key: element.key,
        title,
        source_url: sourceUrl,
        ...urlFields,
        ...(noExpiry ? { no_expiry: true } : {}),
      }),
    });
  }

  return (
    <Modal open onClose={onClose} title={`Add evidence — ${element.label}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        {!isAttribute && (
          <fieldset className="flex gap-4">
            <legend className="sr-only">Source</legend>
            <label className="inline-flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="mode"
                value="upload"
                checked={mode === 'upload'}
                onChange={() => {
                  setMode('upload');
                  setError(null);
                }}
              />
              Upload
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="mode"
                value="url"
                checked={mode === 'url'}
                onChange={() => {
                  setMode('url');
                  setError(null);
                }}
              />
              URL
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-charcoal">
              <input
                type="radio"
                name="mode"
                value="existing"
                checked={mode === 'existing'}
                onChange={() => {
                  setMode('existing');
                  setError(null);
                  // Fetch once on first selection; an earlier failure retries.
                  if (docsState === 'idle' || docsState === 'error') void loadDocuments();
                }}
              />
              Existing document
            </label>
          </fieldset>
        )}

        {!isAttribute && (
          <>
            <Field label="Title">
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>

            {mode === 'existing' ? (
              docsState === 'error' ? (
                <p className="text-sm text-problem">
                  Could not load your documents — reselect Existing document to retry.
                </p>
              ) : docsState === 'loaded' && docs !== null && docs.length === 0 ? (
                <p className="text-sm text-slate">
                  {/* Drafts are excluded from reuse (haiCore filters them out). */}
                  No reusable documents yet — accept or add one first.
                </p>
              ) : docsState === 'loaded' && docs !== null ? (
                <Field label="Document">
                  <select
                    className={inputClass}
                    value={selectedDocId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDocId(id);
                      const doc = docs.find((d) => d.artifact_id === id);
                      if (doc && (title === '' || title === prefilledTitle)) {
                        setTitle(doc.title);
                        setPrefilledTitle(doc.title);
                      }
                    }}
                  >
                    <option value="">Select a document…</option>
                    {docs.map((d) => (
                      <option key={d.artifact_id} value={d.artifact_id}>
                        {describeDocument(d)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm text-slate">Loading documents…</p>
              )
            ) : mode === 'upload' ? (
              <Field label="File">
                <span className="flex items-center gap-3">
                  {/* Visually-hidden native input keeps keyboard + screen-reader
                      access (focus ring shows on the styled control via peer). */}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    className="peer sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="shrink-0 cursor-pointer rounded-lg border border-slate/25 px-4 py-2 text-sm text-charcoal hover:bg-cloud peer-focus-visible:ring-2 peer-focus-visible:ring-teal/50">
                    Choose file…
                  </span>
                  <span className="truncate text-sm text-slate">
                    {file ? file.name : 'No file selected'}
                  </span>
                </span>
              </Field>
            ) : (
              <Field label="Source URL">
                <input
                  type="url"
                  className={inputClass}
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  required
                />
              </Field>
            )}

            {element.modal_fields.map((k) => (
              <Field key={k} label={FIELD_LABELS[k]}>
                <input
                  className={inputClass}
                  value={fields[k] ?? ''}
                  onChange={(e) => setField(k, e.target.value)}
                />
              </Field>
            ))}

            {element.validity && (
              <>
                <fieldset>
                  <legend className="mb-1 block text-sm font-medium text-charcoal">
                    Valid until
                  </legend>
                  <div className="flex gap-2">
                    <select
                      aria-label="Valid until month"
                      className={inputClass}
                      value={vuMonth}
                      disabled={mode === 'url' && noExpiry}
                      onChange={(e) => {
                        setVuMonth(e.target.value);
                        clampDay(vuYear, e.target.value);
                      }}
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={String(i + 1)}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Valid until day"
                      className={`${inputClass} w-24`}
                      value={vuDay}
                      disabled={mode === 'url' && noExpiry}
                      onChange={(e) => setVuDay(e.target.value)}
                    >
                      {Array.from({ length: vuDays }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Valid until year"
                      className={`${inputClass} w-28`}
                      value={vuYear}
                      disabled={mode === 'url' && noExpiry}
                      onChange={(e) => {
                        setVuYear(e.target.value);
                        clampDay(e.target.value, vuMonth);
                      }}
                    >
                      {Array.from({ length: 21 }, (_, i) => {
                        const y = today.getFullYear() + i;
                        return (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </fieldset>
                {mode === 'url' && (
                  <label className="inline-flex items-center gap-2 text-sm text-charcoal">
                    <input
                      type="checkbox"
                      checked={noExpiry}
                      onChange={(e) => {
                        setNoExpiry(e.target.checked);
                        setError(null);
                      }}
                    />
                    No document expiration
                  </label>
                )}
              </>
            )}
          </>
        )}

        {isAttribute && (
          <>
            {element.value_type === 'boolean' ? (
              <Field label="Value">
                <select
                  className={inputClass}
                  value={boolValue}
                  onChange={(e) => setBoolValue(e.target.value)}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
            ) : element.value_type === 'structured' ? (
              <Field label="Value">
                <textarea
                  className={`${inputClass} font-mono`}
                  rows={5}
                  value={attrValue}
                  onChange={(e) => setAttrValue(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Value">
                <input
                  className={inputClass}
                  value={attrValue}
                  onChange={(e) => setAttrValue(e.target.value)}
                />
              </Field>
            )}

            {element.kind === 'attribute_with_evidence' && (
              <p className="text-sm text-slate">
                Attach the supporting document via its matching document element — linking arrives in
                a later phase.
              </p>
            )}
          </>
        )}

        {error && <p className="text-sm text-problem">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate/25 px-4 py-2 text-sm text-charcoal hover:bg-cloud"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange px-4 py-2 text-sm font-medium text-white hover:bg-orange/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  'block w-full rounded-lg border border-slate/25 px-3 py-2 text-sm text-charcoal focus:border-teal focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal">{label}</span>
      {children}
    </label>
  );
}
