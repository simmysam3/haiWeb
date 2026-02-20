"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { Card } from "@/components/card";
import { MOCK_AGENTS, MockAgent } from "@/lib/mock-data";
// BFF route available for individual agent status: /api/account/agents/[agentId]
// No list endpoint exists yet, so agents are loaded from mock data.
// When a list endpoint is added, wire it with:
//   import { useApi } from "@/lib/use-api";
//   const { data: agents } = useApi({ url: "/api/account/agents", fallback: MOCK_AGENTS });

function keyAgeColor(days: number): string {
  if (days === 0) return "bg-slate/10 text-slate";
  if (days < 180) return "bg-success/10 text-success";
  if (days < 365) return "bg-warning/10 text-warning";
  return "bg-problem/10 text-problem";
}

function keyAgeLabel(days: number): string {
  if (days === 0) return "Not generated";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function AgentsPanel() {
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerStep, setRegisterStep] = useState(0);
  const [newAgentId] = useState(() => crypto.randomUUID());
  const [newTypes, setNewTypes] = useState({ cs: true, sales: true, procurement: true });
  const [decommissionAgent, setDecommissionAgent] = useState<MockAgent | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleRegister() {
    const newAgent: MockAgent = {
      id: `a-${newAgentId.slice(0, 8)}-${newAgentId.slice(9, 13)}-${newAgentId.slice(14, 18)}-${newAgentId.slice(19, 23)}-${newAgentId.slice(24)}`,
      status: "offline",
      types: [
        { key: "cs_agent_key", label: "Customer Service", enabled: newTypes.cs, age_days: newTypes.cs ? 0 : 0 },
        { key: "sales_agent_key", label: "Inside Sales", enabled: newTypes.sales, age_days: newTypes.sales ? 0 : 0 },
        { key: "procurement_agent_key", label: "Procurement", enabled: newTypes.procurement, age_days: newTypes.procurement ? 0 : 0 },
      ],
      last_heartbeat: "",
      consecutive_failures: 0,
      created_at: new Date().toISOString(),
    };
    setAgents([...agents, newAgent]);
    setRegisterOpen(false);
    setRegisterStep(0);
    showToast("Agent registered successfully");
  }

  function handleDecommission() {
    if (!decommissionAgent) return;
    setAgents(agents.filter((a) => a.id !== decommissionAgent.id));
    setDecommissionAgent(null);
    showToast("Agent decommissioned. 24-hour grace period started.");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  }

  const envConfig = `HAIWAVE_AGENT_ID=${newAgentId}
HAIWAVE_PARTICIPANT_ID=p-apex-001
HAIWAVE_AUTH_URL=https://auth.haiwave.io/realms/haiwave-network
HAIWAVE_CLIENT_ID=haiwave-agent-p-apex-001
HAIWAVE_CLIENT_SECRET=mock-secret-${newAgentId.slice(0, 8)}
HAIWAVE_API_URL=https://api.haiwave.io
${newTypes.cs ? `HAIWAVE_CS_AGENT_KEY=cs-key-${newAgentId.slice(0, 8)}` : "# HAIWAVE_CS_AGENT_KEY="}
${newTypes.sales ? `HAIWAVE_SALES_AGENT_KEY=sales-key-${newAgentId.slice(0, 8)}` : "# HAIWAVE_SALES_AGENT_KEY="}
${newTypes.procurement ? `HAIWAVE_PROCUREMENT_AGENT_KEY=proc-key-${newAgentId.slice(0, 8)}` : "# HAIWAVE_PROCUREMENT_AGENT_KEY="}`;

  return (
    <>
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button onClick={() => setRegisterOpen(true)}>Register New Agent</Button>
      </div>

      <div className="space-y-6">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-charcoal">{agent.id.slice(0, 16)}...</span>
                    <button onClick={() => copyToClipboard(agent.id)} className="text-xs text-teal-dark hover:underline">
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-slate mt-0.5">Created {new Date(agent.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={agent.status} />
                <Button size="sm" variant="danger" onClick={() => setDecommissionAgent(agent)}>
                  Decommission
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {agent.types.map((t) => (
                <div key={t.key} className="p-3 rounded-lg border border-slate/15">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-charcoal">{t.label}</span>
                    {t.enabled ? (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${keyAgeColor(t.age_days)}`}>
                        {keyAgeLabel(t.age_days)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-slate">{t.enabled ? `Key age: ${t.age_days} days` : "No key generated"}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 text-xs text-slate">
              <span>Last heartbeat: {agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleString() : "Never"}</span>
              <span>Failures: {agent.consecutive_failures}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Register Modal */}
      <Modal open={registerOpen} onClose={() => { setRegisterOpen(false); setRegisterStep(0); }} title="Register New Agent" width="max-w-lg">
        {registerStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Agent Instance ID</label>
              <div className="flex items-center gap-2">
                <input type="text" value={newAgentId} readOnly className="flex-1 px-3 py-2 border border-slate/20 rounded-lg text-sm bg-light-gray font-mono" />
                <Button size="sm" variant="secondary" onClick={() => copyToClipboard(newAgentId)}>Copy</Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Agent Types</label>
              <div className="space-y-2">
                {[
                  { key: "cs" as const, label: "Customer Service" },
                  { key: "sales" as const, label: "Inside Sales" },
                  { key: "procurement" as const, label: "Procurement" },
                ].map((type) => (
                  <label key={type.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTypes[type.key]}
                      onChange={(e) => setNewTypes({ ...newTypes, [type.key]: e.target.checked })}
                      className="accent-teal"
                    />
                    <span className="text-sm text-charcoal">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setRegisterOpen(false); setRegisterStep(0); }}>Cancel</Button>
              <Button onClick={() => setRegisterStep(1)}>Generate Keys</Button>
            </div>
          </div>
        )}

        {registerStep === 1 && (
          <div className="space-y-4">
            <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
              These keys will only be shown once. Copy or download them now.
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Configuration</label>
              <pre className="p-3 bg-navy text-white text-xs rounded-lg overflow-x-auto font-mono whitespace-pre-wrap">{envConfig}</pre>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => copyToClipboard(envConfig)}>Copy Config</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const blob = new Blob([envConfig], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `.env.agent-${newAgentId.slice(0, 8)}`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download .env
              </Button>
              <Button onClick={handleRegister}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Decommission Modal */}
      <Modal open={!!decommissionAgent} onClose={() => setDecommissionAgent(null)} title="Decommission Agent">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to decommission agent <strong className="font-mono">{decommissionAgent?.id.slice(0, 16)}...</strong>?
          </p>
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
            This agent will have a 24-hour grace period before credentials are revoked. After that, it cannot reconnect.
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDecommissionAgent(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDecommission}>Decommission</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
