'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';

interface CreateAgentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateAgentModal({ open, onClose, onCreate }: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the agent');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create agent">
      <label className="block text-sm font-medium text-charcoal" htmlFor="agent-name">
        Name
      </label>
      <input
        id="agent-name"
        className="mt-1 w-full rounded border border-slate/30 p-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Procurement bot"
      />
      {error && <p className="mt-2 text-sm text-problem">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-charcoal"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm disabled:opacity-50"
          onClick={submit}
          disabled={busy || !name.trim()}
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
