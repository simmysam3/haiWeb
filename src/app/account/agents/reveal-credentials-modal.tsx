'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { secretEnvLine, toConfigEnvBlock } from '@/lib/agent-env';
import type { AgentCredential } from '@/lib/haiwave-api';

interface RevealCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  credential?: AgentCredential;
}

export function RevealCredentialsModal({ open, onClose, credential }: RevealCredentialsModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!credential) return null;
  const secret = secretEnvLine(credential);

  async function copySecret() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
    }
  }

  function downloadConfig() {
    // Non-secret config only — the secret stays out of the file (commented
    // placeholder marks where it goes). `agent.env` not `.env`: Chrome sanitizes
    // a leading-dot download name to `env`/`download`.
    const blob = new Blob([toConfigEnvBlock(credential!) + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent.env';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose} title="Agent credentials" width="max-w-lg">
      <p className="text-sm text-slate">
        This is your agent&apos;s <strong className="text-charcoal">client secret</strong> — it is
        <strong className="text-charcoal"> shown only once</strong>. Copy it into your secret store now;
        you can rotate it later if you lose it, but you cannot view it again.
      </p>
      <pre className="mt-3 block w-full overflow-x-auto rounded bg-navy/5 p-3 font-mono text-xs">
        {secret}
      </pre>
      {copyFailed && (
        <p role="alert" className="mt-1 text-xs text-problem">
          Copy failed — select the line above and copy it manually.
        </p>
      )}

      <p className="mt-4 text-sm text-slate">
        Everything else the agent needs is non-secret and stable — download it as a config
        <code className="mx-1 rounded bg-navy/5 px-1 py-0.5 font-mono text-xs">.env</code> (it carries a
        commented placeholder where the secret slots in).
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-charcoal"
          onClick={downloadConfig}
        >
          Download config .env
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
          onClick={copySecret}
        >
          {copied ? 'Copied ✓' : 'Copy secret'}
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
