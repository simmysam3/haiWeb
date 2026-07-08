'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/card';
import { StatusBadge } from '@/components/status-badge';
import { IdChip } from '@/components/id-chip';
import { CreateAgentModal } from './create-agent-modal';
import { RevealCredentialsModal } from './reveal-credentials-modal';
import type { AgentSummary, AgentCredential } from '@/lib/haiwave-api';

/**
 * Live agents list. Fetches the participant's provisioned agents from the BFF
 * (which forwards to haiCore) and supports create → one-time credential
 * reveal, rotate (new secret, also revealed once), and revoke.
 */
/**
 * Pull a human-readable message out of a BFF error response. The BFF forwards
 * haiCore 4xx bodies verbatim (`{ error: { code, message } }`) and shapes its
 * own 5xx as `{ error: "<message>" }`, so tolerate both — and a non-JSON body
 * (e.g. an edge/proxy 502 HTML page) by falling back to a safe default.
 */
async function bffErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const err = (await res.json())?.error as unknown;
    if (typeof err === 'string' && err.trim()) return err;
    if (err && typeof err === 'object') {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
  } catch {
    // Non-JSON body — fall through to the default.
  }
  return fallback;
}

export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<AgentCredential | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadAgents() {
    try {
      const res = await fetch('/api/account/agents');
      if (!res.ok) {
        // An outage must be a distinct, visible state — never render as the
        // "no agents provisioned yet" empty state, which reads as success.
        setLoadError(await bffErrorMessage(res, 'Could not load your agents. Please retry.'));
        return;
      }
      const body = (await res.json()) as { agents?: AgentSummary[] };
      setAgents(body.agents ?? []);
      setLoadError(null);
    } catch {
      // Network failure or a non-JSON body — treat as an outage, not empty.
      setLoadError('Could not load your agents. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  async function create(name: string) {
    const res = await fetch('/api/account/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      // Surface the real cause (400 name / 403 role / 500 Keycloak) so the
      // create modal shows it, rather than a generic swallow.
      throw new Error(await bffErrorMessage(res, 'Could not create the agent'));
    }
    const cred = (await res.json()) as AgentCredential;
    setCreateOpen(false);
    setRevealed(cred);
    await loadAgents();
  }

  async function rotate(agentId: string) {
    setActionError(null);
    const res = await fetch(`/api/account/agents/${agentId}/rotate`, { method: 'POST' });
    if (!res.ok) {
      setActionError(await bffErrorMessage(res, 'Could not rotate the secret. Please retry.'));
      return;
    }
    setRevealed((await res.json()) as AgentCredential);
  }

  async function revoke(agentId: string) {
    setActionError(null);
    const res = await fetch(`/api/account/agents/${agentId}/revoke`, { method: 'POST' });
    if (!res.ok) {
      setActionError(await bffErrorMessage(res, 'Could not revoke the agent. Please retry.'));
      return;
    }
    await loadAgents();
  }

  if (loading) {
    return <p className="text-sm text-slate">Loading agents…</p>;
  }

  if (loadError) {
    return (
      <Card>
        <div className="text-center py-8 max-w-md mx-auto">
          <p className="text-sm font-medium text-problem mb-1">Could not load your agents</p>
          <p className="text-sm text-slate mb-5">{loadError}</p>
          <button
            type="button"
            className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void loadAgents();
            }}
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-problem/20 bg-problem/5 px-4 py-3 text-sm text-problem"
        >
          {actionError}
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
          onClick={() => setCreateOpen(true)}
        >
          Create agent
        </button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <div className="text-center py-8 max-w-md mx-auto">
            <p className="text-sm font-medium text-charcoal mb-1">
              No agents provisioned yet
            </p>
            <p className="text-sm text-slate mb-5">
              HAIWAVE agents run on your own infrastructure. Download the agent
              client and follow the configuration guide — it walks you through
              getting your agent keys and connecting to the network.
            </p>
            <Link
              href="/account/agent-software"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
            >
              Get the client &amp; configuration guide from Agent Software
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {agent.name ?? 'Unnamed agent'}
                  </p>
                  <IdChip id={agent.client_id} className="text-sm" />
                  <p className="text-xs text-slate mt-0.5">
                    Registered {new Date(agent.registered_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={agent.status} />
                  <Link
                    href="/account/agent-health"
                    className="text-sm text-teal hover:text-teal-dark"
                  >
                    Health
                  </Link>
                  {agent.status !== 'revoked' && (
                    <>
                      <button
                        type="button"
                        className="text-sm font-medium text-navy hover:text-charcoal"
                        onClick={() => rotate(agent.id)}
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-problem hover:opacity-80"
                        onClick={() => revoke(agent.id)}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateAgentModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} />
      <RevealCredentialsModal
        open={revealed !== undefined}
        onClose={() => setRevealed(undefined)}
        credential={revealed}
      />
    </div>
  );
}
