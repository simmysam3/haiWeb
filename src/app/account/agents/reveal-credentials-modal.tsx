'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { toEnvBlock } from '@/lib/agent-env';
import type { AgentCredential } from '@/lib/haiwave-api';

interface RevealCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  credential?: AgentCredential;
}

export function RevealCredentialsModal({ open, onClose, credential }: RevealCredentialsModalProps) {
  const [copied, setCopied] = useState(false);
  if (!credential) return null;
  const env = toEnvBlock(credential);

  async function copy() {
    try {
      await navigator.clipboard.writeText(env);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — user can still select the text
    }
  }

  function download() {
    const blob = new Blob([env], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose} title="Agent credentials" width="max-w-lg">
      <p className="text-sm text-slate">
        This secret is <strong className="text-charcoal">shown only once</strong>. Copy or download it
        now — you can rotate it later if you lose it, but you cannot view it again.
      </p>
      <pre className="mt-3 block w-full overflow-x-auto rounded bg-navy/5 p-3 font-mono text-xs">
        {env}
      </pre>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-charcoal"
          onClick={download}
        >
          Download .env
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
          onClick={copy}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          type="button"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-charcoal"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
