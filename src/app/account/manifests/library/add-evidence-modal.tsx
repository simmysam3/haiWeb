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
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [validUntil, setValidUntil] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
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

    // url mode
    if (!/^https?:\/\//.test(sourceUrl)) {
      setError('Enter a URL starting with http:// or https://');
      return;
    }
    await send('/api/account/library/artifacts/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        element_key: element.key,
        title,
        source_url: sourceUrl,
        ...optionalFields(),
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

            {mode === 'upload' ? (
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
              <Field label="Valid until">
                <input
                  type="date"
                  className={inputClass}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </Field>
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
