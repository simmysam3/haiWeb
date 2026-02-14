export default function AgentsPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Agents
      </h1>
      <p className="text-slate mb-8">
        Provision and monitor your HAIWAVE agent deployments.
      </p>

      <div className="bg-white rounded-lg border border-slate/15 p-6 space-y-4">
        <p className="text-sm text-slate">
          Agent provisioning: register new agents, generate per-type API keys
          (CS, Inside Sales, Procurement), download configuration, view agent
          status (Active/Jailed/Probation/Offline), key age indicators,
          heartbeat history, decommission agents.
        </p>
        <p className="text-sm text-slate">
          Chat frontend deployment: public Git repo reference, local config file
          pattern, key-based routing.
        </p>
      </div>
    </div>
  );
}
