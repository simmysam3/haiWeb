"use client";

import { useState } from "react";
import { Tabs } from "@/components/tabs";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, Column } from "@/components/data-table";
import {
  MOCK_DIRECTORY,
  MOCK_ACCESS_REQUESTS,
  MOCK_PARTNERS,
  MockDirectoryCompany,
  MockAccessRequest,
  MockPartner,
} from "@/lib/mock-data";

export function PartnersPanel() {
  const [activeTab, setActiveTab] = useState("directory");
  const [directory] = useState(MOCK_DIRECTORY);
  const [requests, setRequests] = useState(MOCK_ACCESS_REQUESTS);
  const [partners, setPartners] = useState(MOCK_PARTNERS);
  const [search, setSearch] = useState("");
  const [connectCompany, setConnectCompany] = useState<MockDirectoryCompany | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [removePartner, setRemovePartner] = useState<MockPartner | null>(null);
  const [banPartner, setBanPartner] = useState<MockPartner | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
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
    }]);
    showToast(`Approved connection with ${req.company_name}`);
  }

  function handleDecline(req: MockAccessRequest) {
    setRequests(requests.filter((r) => r.id !== req.id));
    showToast(`Declined connection from ${req.company_name}`);
  }

  function handleRemove() {
    if (!removePartner) return;
    setPartners(partners.filter((p) => p.id !== removePartner.id));
    setRemovePartner(null);
    showToast(`Removed partnership with ${removePartner.company_name}`);
  }

  function handleBan() {
    if (!banPartner) return;
    setPartners(partners.filter((p) => p.id !== banPartner.id));
    setBanPartner(null);
    showToast(`Banned ${banPartner.company_name}`);
  }

  function handleConnect() {
    if (!connectCompany) return;
    setConnectCompany(null);
    setConnectMessage("");
    showToast(`Connection request sent to ${connectCompany.company_name}`);
  }

  const filteredDirectory = directory.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase()) ||
    c.location.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { key: "directory", label: "Directory", count: directory.length },
    { key: "queue", label: "Approval Queue", count: requests.length },
    { key: "active", label: "Active", count: partners.length },
  ];

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
      render: (p) => <StatusBadge status={p.status} />,
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
          <Button size="sm" variant="ghost" onClick={() => setRemovePartner(p)}>Remove</Button>
          <Button size="sm" variant="ghost" onClick={() => setBanPartner(p)}>Ban</Button>
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

      {/* Queue Tab */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <p className="text-sm text-slate text-center py-8">No pending connection requests.</p>
            </Card>
          ) : (
            requests.map((req) => (
              <Card key={req.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-charcoal">{req.company_name}</p>
                    <p className="text-xs text-slate">{req.location} &middot; {req.industry}</p>
                    <p className="text-xs text-slate mt-1">From: {req.contact_name}</p>
                    <p className="text-sm text-charcoal mt-2">{req.message}</p>
                    <p className="text-xs text-slate mt-2">Requested {new Date(req.requested_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <Button size="sm" onClick={() => handleApprove(req)}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDecline(req)}>Decline</Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Active Tab */}
      {activeTab === "active" && (
        <div className="bg-white rounded-lg border border-slate/15">
          <DataTable columns={partnerColumns} data={partners} keyFn={(p) => p.id} emptyMessage="No active partnerships." />
        </div>
      )}

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

      {/* Ban Modal */}
      <Modal open={!!banPartner} onClose={() => setBanPartner(null)} title="Ban Trading Partner">
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
