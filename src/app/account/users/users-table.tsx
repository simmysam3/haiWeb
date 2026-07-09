"use client";

import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/data-table";
import { StatusBadge, STATUS_LABELS } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import type { MockUser } from "@/lib/mock-types";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";

const ROLES = [
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
] as const;


export function UsersTable() {
  const { data: apiUsers } = useApi<MockUser[]>({ url: "/api/account/users", fallback: [] });
  const [users, setUsers] = useState<MockUser[]>(apiUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<MockUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("buyer_view_only");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editRole, setEditRole] = useState<string>("");
  const { toast, showToast } = useToast();

  useEffect(() => {
    setUsers(apiUsers);
  }, [apiUsers]);

  function closeInvite() {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteError(null);
  }

  async function handleInvite() {
    setInviteError(null);
    // The BFF requires all three; without them the invite 400s. Validate up
    // front rather than firing a request we know will fail.
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      setInviteError("Email, first name, and last name are all required.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/account/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        // Surface the real BFF error; do NOT add an optimistic row for a user
        // that was never created.
        const body = await res.json().catch(() => ({}));
        setInviteError(body.error ?? `Could not send the invitation (${res.status}).`);
        return;
      }
      const created = await res.json();
      const newUser: MockUser = {
        id: created.id,
        email: created.email ?? inviteEmail,
        first_name: created.first_name ?? inviteFirstName,
        last_name: created.last_name ?? inviteLastName,
        role: (created.role ?? inviteRole) as MockUser["role"],
        job_title: "",
        phone: "",
        status: "active",
        last_login: "Never",
      };
      setUsers((prev) => [...prev, newUser]);
      showToast(`Invitation sent to ${newUser.email}`);
      closeInvite();
    } catch {
      setInviteError("Could not reach the server. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  function handleEditRole() {
    if (!editUser || !editRole) return;
    setUsers(users.map((u) => u.id === editUser.id ? { ...u, role: editRole as MockUser["role"] } : u));
    const userId = editUser.id;
    setEditUser(null);
    showToast("Role updated");

    fetch(`/api/account/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole }),
    }).catch(() => {});
  }

  function handleDeactivate() {
    if (!deactivateUser) return;
    setUsers(users.map((u) => u.id === deactivateUser.id ? { ...u, status: "disabled" as const } : u));
    const userId = deactivateUser.id;
    setDeactivateUser(null);
    showToast("User deactivated");

    fetch(`/api/account/users/${userId}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  const columns: Column<MockUser>[] = [
    {
      key: "name",
      label: "Name",
      render: (u) => (
        <div>
          <p className="font-medium text-charcoal">{u.first_name} {u.last_name}</p>
          <p className="text-xs text-slate">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (u) => <StatusBadge status={u.role} />,
    },
    {
      key: "status",
      label: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "last_login",
      label: "Last Login",
      render: (u) => <span className="text-slate">{u.last_login === "Never" ? "Never" : new Date(u.last_login).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (u) => u.role === "account_owner" ? null : (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditUser(u); setEditRole(u.role); }}>
            Edit Role
          </Button>
          {u.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => setDeactivateUser(u)}>
              Deactivate
            </Button>
          )}
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

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15 flex justify-between items-center">
          <p className="text-sm text-slate">{users.length} users</p>
          <Button size="sm" onClick={() => setInviteOpen(true)}>Invite User</Button>
        </div>
        <DataTable columns={columns} data={users} keyFn={(u) => u.id} />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={closeInvite} title="Invite User">
        <div className="space-y-4">
          {inviteError && (
            <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
              {inviteError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-first-name" className="block text-sm font-medium text-charcoal mb-1">First Name</label>
              <input
                id="invite-first-name"
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                placeholder="Jordan"
              />
            </div>
            <div>
              <label htmlFor="invite-last-name" className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
              <input
                id="invite-last-name"
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                placeholder="Reyes"
              />
            </div>
          </div>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-charcoal mb-1">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{STATUS_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeInvite}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit Role">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Change role for <strong>{editUser?.first_name} {editUser?.last_name}</strong>
          </p>
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{STATUS_LABELS[r] ?? r}</option>
            ))}
          </select>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditRole}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateUser} onClose={() => setDeactivateUser(null)} title="Deactivate User">
        <p className="text-sm text-charcoal mb-4">
          Are you sure you want to deactivate <strong>{deactivateUser?.first_name} {deactivateUser?.last_name}</strong>? They will lose access to the portal.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeactivateUser(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeactivate}>Deactivate</Button>
        </div>
      </Modal>
    </>
  );
}
