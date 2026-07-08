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
export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<AgentCredential | undefined>(undefined);

  async function refresh() {
    const res = await fetch('/api/account/agents');
    const body = (await res.json()) as { agents: AgentSummary[] };
    setAgents(body.agents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/account/agents');
      const body = (await res.json()) as { agents: AgentSummary[] };
      if (cancelled) return;
      setAgents(body.agents ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(name: string) {
    const res = await fetch('/api/account/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Could not create the agent');
    const cred = (await res.json()) as AgentCredential;
    setCreateOpen(false);
    setRevealed(cred);
    await refresh();
  }

  async function rotate(agentId: string) {
    const res = await fetch(`/api/account/agents/${agentId}/rotate`, { method: 'POST' });
    if (!res.ok) return;
    setRevealed((await res.json()) as AgentCredential);
  }

  async function revoke(agentId: string) {
    const res = await fetch(`/api/account/agents/${agentId}/revoke`, { method: 'POST' });
    if (res.ok) await refresh();
  }

  if (loading) {
    return <p className="text-sm text-slate">Loading agents…</p>;
  }

  return (
    <div>
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
