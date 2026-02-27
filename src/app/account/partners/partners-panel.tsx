"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/tabs";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { ScoreBar } from "@/components/score-bar";
import { DataTable, Column } from "@/components/data-table";
import { CompanyProfileModal } from "@/components/company-profile-modal";
import { ApprovalRules } from "./approval-rules";
import { useApi } from "@/lib/use-api";
import {
  MOCK_DIRECTORY,
  MOCK_ACCESS_REQUESTS,
  MOCK_PARTNERS,
  MOCK_SESSION,
  MockDirectoryCompany,
  MockAccessRequest,
  MockPartner,
} from "@/lib/mock-data";

type SortKey = "newest" | "score" | "age";

function ageLabel(days: number) {
  if (days <= 7) return { text: "New", color: "text-success bg-success/10" };
  if (days <= 21) return { text: `${days}d`, color: "text-slate bg-slate/10" };
  if (days <= 28) return { text: "Expiring Soon", color: "text-warning bg-warning/10" };
  return { text: "Expires", color: "text-problem bg-problem/10" };
}

export function PartnersPanel() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "directory";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [directory, setDirectory] = useState(MOCK_DIRECTORY);
  const [requests, setRequests] = useState(MOCK_ACCESS_REQUESTS);
  const [partners, setPartners] = useState(MOCK_PARTNERS);
  const [search, setSearch] = useState("");
  const [connectCompany, setConnectCompany] = useState<MockDirectoryCompany | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [removePartner, setRemovePartner] = useState<MockPartner | null>(null);
  const [banPartner, setBanPartner] = useState<MockPartner | null>(null);
  const [invitePartner, setInvitePartner] = useState<MockPartner | null>(null);
  const [downgradePartner, setDowngradePartner] = useState<MockPartner | null>(null);
  const [profileRequest, setProfileRequest] = useState<MockAccessRequest | null>(null);
  const [toast, setToast] = useState("");

  // Queue filters & sort
  const [queueSort, setQueueSort] = useState<SortKey>("newest");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueTypeFilter, setQueueTypeFilter] = useState<"all" | "approved" | "trading_pair">("all");
  const [queueInviteFilter, setQueueInviteFilter] = useState<"all" | "with_invite" | "without_invite">("all");

  // ─── BFF API Integration (initial load only) ─────────────
  // Directory loads once — search filtering is done client-side.
  // After initial load, local state is the source of truth so that
  // optimistic updates from actions (approve, connect, etc.) persist.
  const [initialLoaded, setInitialLoaded] = useState(false);
  const directoryApi = useApi<MockDirectoryCompany[]>({ url: '/api/account/directory', fallback: MOCK_DIRECTORY, enabled: !initialLoaded });
  const connectionsApi = useApi<MockAccessRequest[]>({ url: '/api/account/connections', fallback: MOCK_ACCESS_REQUESTS, enabled: !initialLoaded });
  const partnersApi = useApi<MockPartner[]>({ url: '/api/account/partners', fallback: MOCK_PARTNERS, enabled: !initialLoaded });

  useEffect(() => {
    if (initialLoaded) return;
    const allDone = !directoryApi.loading && !connectionsApi.loading && !partnersApi.loading;
    if (allDone) {
      setDirectory(directoryApi.data);
      setRequests(connectionsApi.data);
      setPartners(partnersApi.data);
      setInitialLoaded(true);
    }
  }, [directoryApi.data, directoryApi.loading, connectionsApi.data, connectionsApi.loading, partnersApi.data, partnersApi.loading, initialLoaded]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ─── Queue Actions ──────────────────────────────────────────

  function updateDirectoryStatus(companyId: string, status: MockDirectoryCompany["connection_status"]) {
    setDirectory((prev) => prev.map((c) => c.id === companyId ? { ...c, connection_status: status } : c));
  }

  function findDirectoryIdForRequest(req: MockAccessRequest): string | undefined {
    return directory.find((c) => c.company_name === req.company_name)?.id;
  }

  function handleApprove(req: MockAccessRequest) {
    setRequests(requests.filter((r) => r.id !== req.id));
    setPartners([...partners, {
      id: `p-${req.id}`,
      company_name: req.company_name,
      status: "approved",
      manifest_progress: 0,
      established_at: new Date().toISOString(),
      location: req.location,
      industry: req.industry,
      invite_yours: false,
      invite_theirs: req.invite,
      connection_id: `conn-${req.id}`,
    }]);
    const dirId = findDirectoryIdForRequest(req);
    if (dirId) updateDirectoryStatus(dirId, "approved");
    showToast(`Approved connection with ${req.company_name}`);
    // Fire-and-forget: persist approval to BFF
    fetch(`/api/account/connections/${req.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
  }

  function handleApproveWithInvite(req: MockAccessRequest) {
    const newStatus = req.invite ? "trading_pair" : "approved";
    setRequests(requests.filter((r) => r.id !== req.id));
    setPartners([...partners, {
      id: `p-${req.id}`,
      company_name: req.company_name,
      status: newStatus,
      manifest_progress: 0,
      established_at: new Date().toISOString(),
      location: req.location,
      industry: req.industry,
      invite_yours: true,
      invite_theirs: req.invite,
      connection_id: `conn-${req.id}`,
    }]);
    const dirId = findDirectoryIdForRequest(req);
    if (dirId) updateDirectoryStatus(dirId, newStatus === "trading_pair" ? "trading_pair" : "approved");
    showToast(`Approved as trading partner — ${req.company_name}${req.invite ? " (Trading Pair Active)" : " (Pending their proposal)"}`);
    // Fire-and-forget: persist approval + invite to BFF
    fetch(`/api/account/connections/${req.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', invite: true }) });
  }

  function handleDecline(req: MockAccessRequest) {
    setRequests(requests.filter((r) => r.id !== req.id));
    const dirId = findDirectoryIdForRequest(req);
    if (dirId) updateDirectoryStatus(dirId, "none");
    showToast(`Declined connection from ${req.company_name}`);
    // Fire-and-forget: persist denial to BFF
    fetch(`/api/account/connections/${req.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deny' }) });
  }

  // ─── Partner Actions ────────────────────────────────────────

  function handleRemove() {
    if (!removePartner) return;
    setPartners(partners.filter((p) => p.id !== removePartner.id));
    updateDirectoryStatus(removePartner.id, "none");
    setRemovePartner(null);
    showToast(`Removed partnership with ${removePartner.company_name}`);
  }

  function handleBan() {
    if (!banPartner) return;
    setPartners(partners.filter((p) => p.id !== banPartner.id));
    updateDirectoryStatus(banPartner.id, "banned");
    setBanPartner(null);
    showToast(`Banned ${banPartner.company_name}`);
    fetch('/api/account/connections/blocked', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_participant_id: banPartner.id }) });
  }

  function handleDowngrade() {
    if (!downgradePartner) return;
    setPartners(partners.map((p) =>
      p.id === downgradePartner.id
        ? { ...p, status: "approved" as const, invite_yours: false, invite_theirs: false }
        : p,
    ));
    updateDirectoryStatus(downgradePartner.id, "approved");
    setDowngradePartner(null);
    showToast(`Downgraded ${downgradePartner.company_name} to Approved`);
    fetch('/api/account/connections/downgrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: downgradePartner.connection_id, target_state: 'approved' }) });
  }

  function handleConnect() {
    if (!connectCompany) return;
    updateDirectoryStatus(connectCompany.id, "pending");
    // Fire-and-forget: send connection request to BFF
    fetch('/api/account/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_participant_id: connectCompany.id, message: connectMessage }) });
    setConnectCompany(null);
    setConnectMessage("");
    showToast(`Connection request sent to ${connectCompany.company_name}`);
  }

  function handleSetInvite() {
    if (!invitePartner) return;
    const newInviteYours = !invitePartner.invite_yours;
    const newStatus = newInviteYours && invitePartner.invite_theirs ? "trading_pair" : "approved";
    setPartners(partners.map((p) => {
      if (p.id !== invitePartner.id) return p;
      return { ...p, invite_yours: newInviteYours, status: newStatus };
    }));
    updateDirectoryStatus(invitePartner.id, newStatus);
    const action = invitePartner.invite_yours ? "Withdrew trading pair proposal from" : "Proposed trading pair with";
    showToast(`${action} ${invitePartner.company_name}`);
    // Fire-and-forget: persist invite toggle to BFF
    fetch(`/api/account/connections/${invitePartner.connection_id}/invite`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite: newInviteYours }) });
    setInvitePartner(null);
  }

  // ─── Filtered / Sorted Queue ────────────────────────────────

  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // Text search
    if (queueSearch) {
      const lower = queueSearch.toLowerCase();
      result = result.filter((r) => r.company_name.toLowerCase().includes(lower));
    }

    // Type filter
    if (queueTypeFilter !== "all") {
      result = result.filter((r) => r.request_type === queueTypeFilter);
    }

    // Invite filter
    if (queueInviteFilter === "with_invite") {
      result = result.filter((r) => r.invite);
    } else if (queueInviteFilter === "without_invite") {
      result = result.filter((r) => !r.invite);
    }

    // Sort
    if (queueSort === "newest") {
      result.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    } else if (queueSort === "score") {
      result.sort((a, b) => (b.behavioral_score ?? -1) - (a.behavioral_score ?? -1));
    } else {
      result.sort((a, b) => b.age_days - a.age_days);
    }

    return result;
  }, [requests, queueSearch, queueTypeFilter, queueInviteFilter, queueSort]);

  // ─── Directory ──────────────────────────────────────────────

  const filteredDirectory = directory.filter((c) =>
    c.id !== MOCK_SESSION.participant.id && (
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase())
    )
  );

  // ─── Tabs ───────────────────────────────────────────────────

  const tabs = [
    { key: "directory", label: "Directory", count: directory.length },
    { key: "queue", label: "Approval Queue", count: requests.length },
    { key: "active", label: "Active", count: partners.length },
    { key: "rules", label: "Rules" },
  ];

  // ─── Active Tab Columns ─────────────────────────────────────

  const partnerColumns: Column<MockPartner>[] = [
    {
      key: "company",
      label: "Company",
      render: (p) => (
        <div>
          <p className="font-medium text-charcoal">{p.company_name}</p>
          <p className="text-xs text-slate">{p.location}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (p) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={p.status} />
          {p.invite_yours && p.invite_theirs && (
            <span className="text-xs text-success font-medium">Trading Pair Active</span>
          )}
        </div>
      ),
    },
    {
      key: "invite",
      label: "Invite Status",
      render: (p) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className={p.invite_yours ? "text-teal" : "text-slate"}>
            Your Invite: {p.invite_yours ? "Sent" : "Not Sent"}
          </span>
          <span className={p.invite_theirs ? "text-teal" : "text-slate"}>
            Their Invite: {p.invite_theirs ? "Received" : "Not Received"}
          </span>
        </div>
      ),
    },
    {
      key: "manifest",
      label: "Manifest Progress",
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-slate/10 rounded-full overflow-hidden">
            <div className="h-full bg-teal rounded-full" style={{ width: `${p.manifest_progress}%` }} />
          </div>
          <span className="text-xs text-slate">{p.manifest_progress}%</span>
        </div>
      ),
    },
    {
      key: "established",
      label: "Established",
      render: (p) => <span className="text-slate">{new Date(p.established_at).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={p.invite_yours ? "ghost" : "secondary"}
            onClick={() => setInvitePartner(p)}
          >
            {p.invite_yours ? "Withdraw Trading Pair" : "Propose Trading Pair"}
          </Button>
          {p.status === "trading_pair" && (
            <Button size="sm" variant="ghost" onClick={() => setDowngradePartner(p)}>Downgrade</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setRemovePartner(p)}>Remove</Button>
          <Button size="sm" variant="ghost" onClick={() => setBanPartner(p)}>Block</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Directory Tab */}
      {activeTab === "directory" && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, industry, or location..."
              className="w-full px-4 py-2.5 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {filteredDirectory.map((company) => (
              <Card key={company.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-charcoal">{company.company_name}</p>
                    <p className="text-xs text-slate mt-0.5">{company.location} &middot; {company.industry}</p>
                    <p className="text-xs text-slate mt-2">{company.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {company.connection_status === "none" ? (
                    <Button size="sm" onClick={() => setConnectCompany(company)}>
                      Request Connection
                    </Button>
                  ) : (
                    <StatusBadge status={company.connection_status} />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Queue Tab — v1.6 Overhaul */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder="Search company name..."
              className="flex-1 min-w-[200px] px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
            <select
              value={queueTypeFilter}
              onChange={(e) => setQueueTypeFilter(e.target.value as typeof queueTypeFilter)}
              className="px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="all">All Types</option>
              <option value="approved">Connection Only</option>
              <option value="trading_pair">Trading Pair</option>
            </select>
            <select
              value={queueInviteFilter}
              onChange={(e) => setQueueInviteFilter(e.target.value as typeof queueInviteFilter)}
              className="px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="all">All Invites</option>
              <option value="with_invite">With Invite</option>
              <option value="without_invite">Without Invite</option>
            </select>
            <select
              value={queueSort}
              onChange={(e) => setQueueSort(e.target.value as SortKey)}
              className="px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              <option value="newest">Newest First</option>
              <option value="score">By Score</option>
              <option value="age">By Age</option>
            </select>
          </div>

          {/* Queue Cards */}
          {filteredRequests.length === 0 ? (
            <Card>
              <p className="text-sm text-slate text-center py-8">No pending connection requests.</p>
            </Card>
          ) : (
            filteredRequests.map((req) => {
              const age = ageLabel(req.age_days);
              return (
                <Card key={req.id}>
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-charcoal text-base">{req.company_name}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${age.color}`}>
                            {age.text}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            req.request_type === "trading_pair"
                              ? "bg-navy/10 text-navy"
                              : "bg-slate/10 text-slate"
                          }`}>
                            {req.request_type === "trading_pair" ? "Trading Pair Request" : "Connection Request"}
                          </span>
                          {req.invite && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-orange/10 text-orange font-medium">
                              Invite
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate mt-0.5">
                          {req.location} &middot; {req.business_type} &middot; {req.region}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => handleApprove(req)}>Approve</Button>
                        <Button size="sm" onClick={() => handleApproveWithInvite(req)}>
                          Approve as Trading Partner
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDecline(req)}>Deny</Button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-charcoal">{req.company_description}</p>

                    {/* Details Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Score */}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Behavioral Score</p>
                        {req.behavioral_score !== null ? (
                          <div className="space-y-1">
                            <span className={`text-lg font-bold ${
                              req.behavioral_score >= 90 ? "text-success" :
                              req.behavioral_score >= 70 ? "text-teal" : "text-problem"
                            }`}>
                              {req.behavioral_score}
                            </span>
                            <span className="text-xs text-slate ml-1">/ 100</span>
                            <ScoreBar label="" value={req.behavioral_score} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate italic">New to Network</span>
                        )}
                      </div>

                      {/* Member Since */}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Member Since</p>
                        <p className="text-sm text-charcoal">
                          {req.network_member_since
                            ? new Date(req.network_member_since).toLocaleDateString()
                            : "New to Network"}
                        </p>
                        <p className="text-xs text-slate mt-0.5">
                          Request Age: {req.age_days} day{req.age_days !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Contact */}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Contact</p>
                        <p className="text-sm text-charcoal">{req.contact_name}</p>
                        <p className="text-xs text-slate mt-0.5">{req.industry}</p>
                      </div>
                    </div>

                    {/* Product Lines */}
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {req.product_lines.map((line) => (
                          <span
                            key={line}
                            className="px-2 py-0.5 text-xs bg-teal/10 text-teal-dark rounded-full"
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    {req.message && (
                      <div className="border-t border-slate/10 pt-3">
                        <p className="text-xs text-slate italic">&ldquo;{req.message}&rdquo;</p>
                      </div>
                    )}

                    {/* View Full Profile */}
                    <div className="border-t border-slate/10 pt-2">
                      <button
                        onClick={() => setProfileRequest(req)}
                        className="text-xs text-teal hover:text-teal-dark font-medium"
                      >
                        View Full Profile &rarr;
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Active Tab */}
      {activeTab === "active" && (
        <div className="bg-white rounded-lg border border-slate/15">
          <DataTable columns={partnerColumns} data={partners} keyFn={(p) => p.id} emptyMessage="No active partnerships." />
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === "rules" && <ApprovalRules />}

      {/* Company Profile Modal (from queue) */}
      <CompanyProfileModal
        open={!!profileRequest}
        onClose={() => setProfileRequest(null)}
        company={profileRequest ? {
          company_name: profileRequest.company_name,
          business_type: profileRequest.business_type,
          company_description: profileRequest.company_description,
          location: profileRequest.location,
          behavioral_score: profileRequest.behavioral_score,
          product_lines: profileRequest.product_lines,
          network_member_since: profileRequest.network_member_since,
          request_type: profileRequest.request_type,
          industry: profileRequest.industry,
        } : null}
      />

      {/* Connect Modal */}
      <Modal open={!!connectCompany} onClose={() => setConnectCompany(null)} title="Request Connection">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Send a connection request to <strong>{connectCompany?.company_name}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Message (optional)</label>
            <textarea
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              placeholder="Why would you like to connect?"
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setConnectCompany(null)}>Cancel</Button>
            <Button onClick={handleConnect}>Send Request</Button>
          </div>
        </div>
      </Modal>

      {/* Invite Consent Modal */}
      <Modal open={!!invitePartner} onClose={() => setInvitePartner(null)} title={invitePartner?.invite_yours ? "Withdraw Trading Pair" : "Propose Trading Pair"}>
        <div className="space-y-4">
          {invitePartner?.invite_yours ? (
            <>
              <p className="text-sm text-charcoal">
                Withdraw your trading pair proposal from <strong>{invitePartner.company_name}</strong>?
              </p>
              <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
                If they have also proposed, the trading pair will be deactivated. No new agent-to-agent transactions will be initiated.
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-charcoal">
                Propose a trading pair with <strong>{invitePartner?.company_name}</strong>?
              </p>
              <div className="bg-teal/5 border border-teal/20 rounded-lg px-4 py-3 text-sm text-teal-dark">
                <p className="font-medium mb-1">How Trading Pairs Work</p>
                <p>A trading pair is activated when both parties propose. Once active, your agents can transact directly — search inventory, exchange quotes, and place orders. Connection fees begin at the start of the next billing period ($100/mo per pair).</p>
              </div>
              {invitePartner?.invite_theirs && (
                <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
                  {invitePartner.company_name} has already proposed. Confirming yours will immediately activate the trading pair.
                </div>
              )}
            </>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setInvitePartner(null)}>Cancel</Button>
            <Button onClick={handleSetInvite}>
              {invitePartner?.invite_yours ? "Withdraw" : "Propose Trading Pair"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Modal */}
      <Modal open={!!removePartner} onClose={() => setRemovePartner(null)} title="Remove Partnership">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Remove partnership with <strong>{removePartner?.company_name}</strong>?
          </p>
          {removePartner?.status === "trading_pair" && (
            <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
              Active orders in flight will not be cancelled, but no new orders can be initiated. Connection fee billing stops at end of billing period.
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setRemovePartner(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRemove}>Remove</Button>
          </div>
        </div>
      </Modal>

      {/* Downgrade Modal */}
      <Modal open={!!downgradePartner} onClose={() => setDowngradePartner(null)} title="Downgrade to Approved">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Downgrade <strong>{downgradePartner?.company_name}</strong> from Trading Pair to Approved?
          </p>
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
            Both trading pair invites will be withdrawn. Active orders in flight will not be cancelled, but no new agent-to-agent transactions can be initiated. Connection fee billing stops at end of billing period.
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDowngradePartner(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDowngrade}>Downgrade</Button>
          </div>
        </div>
      </Modal>

      {/* Ban Modal */}
      <Modal open={!!banPartner} onClose={() => setBanPartner(null)} title="Block Trading Partner">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Permanently ban <strong>{banPartner?.company_name}</strong>?
          </p>
          <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
            This will permanently prevent them from sending connection requests. This can only be reversed by you.
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setBanPartner(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleBan}>Ban Permanently</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
